"use client"

import { useState, useEffect, useCallback, useRef, useMemo, Fragment } from "react"
import { useRouter } from "next/navigation"
import {
  Activity,
  AlertTriangle,
  Blocks,
  CheckCircle2,
  ChevronDown,
  ChevronRight,
  CircleDot,
  Globe,
  Layers,
  Server,
  Timer,
  TrendingUp,
  Wifi,
  XCircle,
  Zap,
} from "lucide-react"
import { LiveClock } from "@/components/live-clock"
import { RefreshButton } from "@/components/refresh-button"
import type {
  DashboardData,
  RelayResult,
  RelayStatus,
  ScoreTier,
  EfficiencyLabel,
  BuilderResult,
  IntelligenceEvent,
  BestRelay,
  EventType,
} from "@/lib/fetch-relays"

// ── Types ─────────────────────────────────────────────────────────────────────

type RelayTransition = "RECOVERING" | "IMPROVING" | "UNDER LOAD" | "DETERIORATING" | "STABLE"

interface CompStats {
  fastestSlug: string | null
  biggestGainerSlug: string | null
  biggestLoserSlug: string | null
  mostStableSlug: string | null
  bestPerformerSlug: string | null
  historyWindowMin: number
}

// ── Temporal helpers ──────────────────────────────────────────────────────────

function countConsecutiveState(
  slug: string,
  history: DashboardData[],
  predicate: (r: RelayResult) => boolean,
): number {
  let count = 0
  for (let i = history.length - 1; i >= 0; i--) {
    const r = history[i].relays.find((r) => r.slug === slug)
    if (!r || !predicate(r)) break
    count++
  }
  return count
}

function fmtDuration(entries: number): string {
  const seconds = entries * 5
  if (seconds < 60) return `${seconds}s`
  return `~${Math.round(seconds / 60)}m`
}

// ── History-driven computations ───────────────────────────────────────────────

function computeRelayTransitions(
  relays: RelayResult[],
  history: DashboardData[],
): Map<string, RelayTransition> {
  const result = new Map<string, RelayTransition>()
  if (history.length === 0) return result
  const prev = history[history.length - 1]
  const prevMap = new Map(prev.relays.map((r) => [r.slug, r]))
  for (const relay of relays) {
    const p = prevMap.get(relay.slug)
    if (!p) continue
    if (p.status === "offline" && relay.status === "online") {
      result.set(relay.slug, "RECOVERING")
    } else if (relay.status !== "online") {
      // offline — no transition label
    } else if (relay.score.overall - p.score.overall >= 8) {
      result.set(relay.slug, "IMPROVING")
    } else if (relay.score.overall - p.score.overall <= -8) {
      result.set(relay.slug, "DETERIORATING")
    } else if (relay.latencyMs - p.latencyMs >= 80 && relay.latencyMs > 250) {
      result.set(relay.slug, "UNDER LOAD")
    } else {
      result.set(relay.slug, "STABLE")
    }
  }
  return result
}

function computeDeltaEvents(
  current: DashboardData,
  history: DashboardData[],
): IntelligenceEvent[] {
  if (history.length === 0) return []
  const prev = history[history.length - 1]
  const prevMap = new Map(prev.relays.map((r) => [r.slug, r]))
  const events: IntelligenceEvent[] = []
  const now = new Date().toISOString()
  const ts = Date.now()
  for (const relay of current.relays) {
    const p = prevMap.get(relay.slug)
    if (!p) continue
    if (p.status === "offline" && relay.status === "online") {
      const downtimeEntries = countConsecutiveState(relay.slug, history, (r) => r.status === "offline")
      const downtimeStr = downtimeEntries > 0 ? ` after ${fmtDuration(downtimeEntries)} downtime` : ""
      events.push({
        id: `${relay.slug}-recovered-${ts}`,
        type: "recovered",
        severity: "info",
        message: `${relay.name} relay recovery confirmed${downtimeStr} — execution capacity restored`,
        relay: relay.name,
        chain: relay.chain,
        timestamp: now,
      })
      continue
    }
    if (relay.status !== "online") continue
    const scoreDelta = relay.score.overall - p.score.overall
    if (scoreDelta <= -10) {
      const degradedFor = countConsecutiveState(
        relay.slug, history,
        (r) => r.score.tier !== "OPTIMAL" && r.score.tier !== "GOOD",
      )
      const durStr = degradedFor >= 3 ? ` — persisting for ${fmtDuration(degradedFor)}` : ""
      events.push({
        id: `${relay.slug}-drop-${ts}`,
        type: "rank_change",
        severity: "warning",
        message: `Execution quality degradation on ${relay.name} — composite score declined ${Math.abs(scoreDelta)}pts${durStr}`,
        relay: relay.name,
        chain: relay.chain,
        timestamp: now,
      })
    } else if (scoreDelta >= 10) {
      events.push({
        id: `${relay.slug}-gain-${ts}`,
        type: "rank_change",
        severity: "info",
        message: `Recovery trend observed on ${relay.name} — composite score improving (+${scoreDelta}pts)`,
        relay: relay.name,
        chain: relay.chain,
        timestamp: now,
      })
    }
    const latDelta = relay.latencyMs - p.latencyMs
    if (latDelta >= 80 && relay.latencyMs > 200) {
      events.push({
        id: `${relay.slug}-lat-${ts}`,
        type: "latency_trend",
        severity: "warning",
        message: `Response time divergence on ${relay.name} — elevated to ${relay.latencyMs}ms (+${latDelta}ms from prior reading)`,
        relay: relay.name,
        chain: relay.chain,
        timestamp: now,
      })
    }
  }
  return events
}

function computeSimEvents(
  relays: RelayResult[],
  history: DashboardData[],
  existingAlertCount: number,
): IntelligenceEvent[] {
  if (existingAlertCount >= 3) return []
  const online = relays.filter((r) => r.status === "online")
  if (online.length === 0) return []
  const events: IntelligenceEvent[] = []
  const now = new Date().toISOString()
  const bucket = Math.floor(Date.now() / 60000)

  if (online.length > 1) {
    const fastest = online.reduce((a, b) => (a.latencyMs < b.latencyMs ? a : b))
    const avgLat = Math.round(online.reduce((s, r) => s + r.latencyMs, 0) / online.length)
    if (fastest.latencyMs < avgLat * 0.65) {
      events.push({
        id: `sim-fastest-${bucket}`,
        type: "simulation",
        severity: "info",
        message: `${fastest.name} leads on response time at ${fastest.latencyMs}ms — ${avgLat - fastest.latencyMs}ms below current field average`,
        relay: fastest.name,
        chain: fastest.chain,
        timestamp: now,
      })
    }
  }

  if (online.length > 1) {
    const scores = online.map((r) => r.score.overall)
    const maxScore = Math.max(...scores)
    const minScore = Math.min(...scores)
    if (maxScore - minScore > 15) {
      events.push({
        id: `sim-spread-${bucket}`,
        type: "simulation",
        severity: "info",
        message: `Execution quality divergence across MEV relays — ${maxScore - minScore}pt composite score spread between top and bottom performers`,
        chain: "ethereum",
        timestamp: now,
      })
    }
  }

  if (online.length >= 3) {
    const scores = online.map((r) => r.score.overall)
    const spread = Math.max(...scores) - Math.min(...scores)
    if (spread <= 5) {
      const stableFor = history.length >= 3
        ? ` — confirmed stable for ${fmtDuration(Math.min(history.length, 12))}`
        : ""
      events.push({
        id: `sim-stable-${bucket}`,
        type: "stability",
        severity: "info",
        message: `Execution conditions stable across monitored MEV relays${stableFor}`,
        chain: "ethereum",
        timestamp: now,
      })
    }
  }

  if (history.length >= 3) {
    const older = history[Math.max(0, history.length - 3)]
    const olderOnline = older.relays.filter((r) => r.status === "online")
    if (olderOnline.length > 0) {
      const olderAvg = olderOnline.reduce((s, r) => s + r.score.overall, 0) / olderOnline.length
      const currentAvg = online.reduce((s, r) => s + r.score.overall, 0) / online.length
      if (currentAvg - olderAvg >= 5) {
        events.push({
          id: `sim-trend-${bucket}`,
          type: "latency_trend",
          severity: "info",
          message: `Network health improving — composite avg up ${Math.round(currentAvg - olderAvg)}pts over ${fmtDuration(history.length)} observation window`,
          chain: "ethereum",
          timestamp: now,
        })
      }
    }
  }

  return events.slice(0, 2)
}

function computeCompStats(relays: RelayResult[], history: DashboardData[]): CompStats {
  const online = relays.filter((r) => r.status === "online")
  const historyWindowMin = Math.round(history.length * 5 / 60)
  const fastestSlug =
    online.length > 0
      ? online.reduce((a, b) => (a.latencyMs < b.latencyMs ? a : b)).slug
      : null
  if (history.length === 0) {
    return { fastestSlug, biggestGainerSlug: null, biggestLoserSlug: null, mostStableSlug: null, bestPerformerSlug: null, historyWindowMin: 0 }
  }
  const prev = history[history.length - 1]
  const prevMap = new Map(prev.relays.map((r) => [r.slug, r]))
  let maxGain = 5
  let maxLoss = -5
  let biggestGainerSlug: string | null = null
  let biggestLoserSlug: string | null = null
  for (const relay of online) {
    const p = prevMap.get(relay.slug)
    if (!p) continue
    const delta = relay.score.overall - p.score.overall
    if (delta > maxGain) { maxGain = delta; biggestGainerSlug = relay.slug }
    if (delta < maxLoss) { maxLoss = delta; biggestLoserSlug = relay.slug }
  }
  let mostStableSlug: string | null = null
  let bestPerformerSlug: string | null = null
  if (history.length >= 3) {
    let minVariance = Infinity
    let maxAvgScore = -1
    const window = history.slice(-Math.min(history.length, 60))
    for (const relay of online) {
      const scores = window
        .map((h) => h.relays.find((r) => r.slug === relay.slug)?.score.overall ?? null)
        .filter((s): s is number => s !== null)
      if (scores.length < 2) continue
      const avg = scores.reduce((a, b) => a + b, 0) / scores.length
      const variance = scores.reduce((s, v) => s + Math.abs(v - avg), 0)
      if (variance < minVariance) { minVariance = variance; mostStableSlug = relay.slug }
      if (avg > maxAvgScore) { maxAvgScore = avg; bestPerformerSlug = relay.slug }
    }
  }
  return { fastestSlug, biggestGainerSlug, biggestLoserSlug, mostStableSlug, bestPerformerSlug, historyWindowMin }
}

// ── Primitive badges ──────────────────────────────────────────────────────────

function StatusDot({ status }: { status: RelayStatus }) {
  if (status === "online")
    return (
      <span className="relative flex h-2 w-2 shrink-0">
        <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-60" />
        <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-400" />
      </span>
    )
  return <span className="inline-flex h-2 w-2 shrink-0 rounded-full bg-red-500/60" />
}

const TIER_CLS: Record<ScoreTier, string> = {
  OPTIMAL:  "text-emerald-400 bg-emerald-400/10 border-emerald-400/25",
  GOOD:     "text-amber-400  bg-amber-400/10  border-amber-400/25",
  DEGRADED: "text-orange-400 bg-orange-400/10 border-orange-400/25",
  OFFLINE:  "text-red-400    bg-red-400/10    border-red-400/25",
}
function TierBadge({ tier }: { tier: ScoreTier }) {
  return (
    <span className={`inline-flex px-1.5 py-0.5 rounded-sm border text-[9px] font-bold tracking-wider ${TIER_CLS[tier]}`}>
      {tier}
    </span>
  )
}

const EFFIC_CLS: Record<EfficiencyLabel, string> = {
  "HIGH EFFICIENCY": "text-emerald-400 bg-emerald-400/10 border-emerald-400/25",
  "NORMAL":          "text-sky-400    bg-sky-400/10    border-sky-400/25",
  "DEGRADED":        "text-amber-400  bg-amber-400/10  border-amber-400/25",
  "HIGH RISK":       "text-red-400    bg-red-400/10    border-red-400/25",
}
function EfficBadge({ label }: { label: EfficiencyLabel }) {
  return (
    <span className={`inline-flex px-1.5 py-0.5 rounded-sm border text-[9px] font-bold tracking-wider ${EFFIC_CLS[label]}`}>
      {label}
    </span>
  )
}

function ScoreBar({ score, tier }: { score: number; tier: ScoreTier }) {
  const fill =
    tier === "OPTIMAL"  ? "bg-emerald-500" :
    tier === "GOOD"     ? "bg-amber-400"   :
    tier === "DEGRADED" ? "bg-orange-500"  : "bg-red-500/50"
  return (
    <div className="h-1 w-full rounded-full bg-white/5 overflow-hidden">
      <div className={`h-full rounded-full transition-all duration-700 ${fill}`} style={{ width: `${score}%` }} />
    </div>
  )
}

function LatencyCell({ ms, status }: { ms: number; status: RelayStatus }) {
  if (status === "offline") return <span className="text-muted-foreground font-mono text-xs">—</span>
  const cls = ms < 150 ? "text-emerald-400" : ms < 400 ? "text-foreground/80" : ms < 700 ? "text-amber-400" : "text-red-400"
  return <span className={`font-mono text-xs tabular-nums ${cls}`}>{ms}ms</span>
}

// ── Last updated badge ────────────────────────────────────────────────────────

function LastUpdatedBadge({ fetchedAt, isLive }: { fetchedAt: string; isLive: boolean }) {
  const [elapsed, setElapsed] = useState(0)
  useEffect(() => {
    if (!isLive) return
    const base = new Date(fetchedAt).getTime()
    const tick = () => setElapsed(Math.round((Date.now() - base) / 1000))
    tick()
    const id = setInterval(tick, 1000)
    return () => clearInterval(id)
  }, [fetchedAt, isLive])
  if (!isLive) return <span className="text-[10px] text-muted-foreground/50">initializing…</span>
  if (elapsed <= 1) return <span className="text-[10px] text-emerald-400">just now</span>
  return <span className="text-[10px] text-muted-foreground">{elapsed}s ago</span>
}

// ── Intelligence feed item ────────────────────────────────────────────────────

const EVENT_ICON: Record<EventType, React.ReactNode> = {
  degraded:        <XCircle className="h-3 w-3 text-red-400 shrink-0" />,
  latency_spike:   <AlertTriangle className="h-3 w-3 text-amber-400 shrink-0" />,
  concentration:   <AlertTriangle className="h-3 w-3 text-amber-400 shrink-0" />,
  high_value:      <TrendingUp className="h-3 w-3 text-blue-400 shrink-0" />,
  efficiency_drop: <Activity className="h-3 w-3 text-amber-400 shrink-0" />,
  nominal:         <CheckCircle2 className="h-3 w-3 text-emerald-400 shrink-0" />,
  recovered:       <CheckCircle2 className="h-3 w-3 text-emerald-400 shrink-0" />,
  rank_change:     <TrendingUp className="h-3 w-3 text-amber-400 shrink-0" />,
  latency_trend:   <Timer className="h-3 w-3 text-amber-400 shrink-0" />,
  stability:       <CheckCircle2 className="h-3 w-3 text-sky-400 shrink-0" />,
  simulation:      <CircleDot className="h-3 w-3 text-muted-foreground/40 shrink-0" />,
}
const EVENT_BORDER: Record<string, string> = {
  critical: "border-l-red-500/70",
  warning:  "border-l-amber-500/60",
  info:     "border-l-emerald-500/40",
}
const EVENT_TEXT: Record<string, string> = {
  critical: "text-red-300",
  warning:  "text-amber-300/90",
  info:     "text-foreground/75",
}
function FeedItem({ event, isNew }: { event: IntelligenceEvent; isNew?: boolean }) {
  return (
    <div className={`border-l-2 pl-3 py-2 ${EVENT_BORDER[event.severity]}${isNew ? " animate-feed-in" : ""}`}>
      <div className="flex items-start gap-2">
        {EVENT_ICON[event.type]}
        <p className={`text-[11px] leading-snug ${EVENT_TEXT[event.severity]}`}>{event.message}</p>
      </div>
      {event.relay && (
        <p className="text-[10px] text-muted-foreground/60 mt-0.5 pl-5">{event.relay}</p>
      )}
    </div>
  )
}

// ── Transition label ──────────────────────────────────────────────────────────

const TRANSITION_CLS: Record<RelayTransition, string> = {
  RECOVERING:    "text-emerald-400 bg-emerald-400/10 border-emerald-400/25",
  IMPROVING:     "text-sky-400 bg-sky-400/10 border-sky-400/25",
  "UNDER LOAD":  "text-amber-400 bg-amber-400/10 border-amber-400/25",
  DETERIORATING: "text-orange-400 bg-orange-400/10 border-orange-400/25",
  STABLE:        "",
}
const TRANSITION_SUFFIX: Record<RelayTransition, string> = {
  RECOVERING:    "↑",
  IMPROVING:     "↑",
  "UNDER LOAD":  "↓",
  DETERIORATING: "↓",
  STABLE:        "",
}
function TransitionLabel({ t }: { t: RelayTransition }) {
  if (t === "STABLE") return null
  return (
    <span className={`inline-flex px-1.5 py-0.5 rounded-sm border text-[9px] font-bold tracking-wider ${TRANSITION_CLS[t]}`}>
      {t}{TRANSITION_SUFFIX[t]}
    </span>
  )
}

// ── Metric tile ───────────────────────────────────────────────────────────────

function MetricTile({
  label, value, sub, icon: Icon, accent,
}: {
  label: string; value: string; sub?: string; icon: React.ElementType; accent?: string
}) {
  return (
    <div className="rounded border border-border/40 bg-card/60 px-4 py-3">
      <div className="flex items-center justify-between mb-1.5">
        <span className="text-[10px] uppercase tracking-widest text-muted-foreground font-medium">{label}</span>
        <Icon className={`h-3.5 w-3.5 ${accent ?? "text-muted-foreground/50"}`} />
      </div>
      <div className={`text-2xl font-bold font-mono tabular-nums tracking-tight ${accent ?? "text-foreground"}`}>
        {value}
      </div>
      {sub && <p className="text-[10px] text-muted-foreground/70 mt-0.5">{sub}</p>}
    </div>
  )
}

// ── Panel wrapper ─────────────────────────────────────────────────────────────

function Panel({
  icon: Icon, title, right, children,
}: {
  icon: React.ElementType; title: string; right?: React.ReactNode; children: React.ReactNode
}) {
  return (
    <div className="rounded border border-border/40 bg-card/60 overflow-hidden">
      <div className="flex items-center justify-between px-4 py-2.5 border-b border-border/30 bg-card/40">
        <div className="flex items-center gap-2 text-[10px] uppercase tracking-widest text-muted-foreground font-medium">
          <Icon className="h-3 w-3" />
          {title}
        </div>
        {right && <div className="text-[10px] text-muted-foreground">{right}</div>}
      </div>
      {children}
    </div>
  )
}

function TH({ children, right, hidden }: { children: React.ReactNode; right?: boolean; hidden?: string }) {
  return (
    <th className={`px-3 py-2 text-[10px] uppercase tracking-wider text-muted-foreground font-medium border-b border-border/30 whitespace-nowrap ${right ? "text-right" : "text-left"} ${hidden ?? ""}`}>
      {children}
    </th>
  )
}

// ── Relay expanded detail pane ────────────────────────────────────────────────

function RelayDetailPane({ relay }: { relay: RelayResult }) {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-3 gap-6 px-5 py-4 bg-card/40 border-b border-border/20">
      <div>
        <p className="text-[10px] uppercase tracking-widest text-muted-foreground mb-3">Score Breakdown</p>
        {([
          { label: "Uptime (40%)",   val: relay.status === "online" ? 100 : 0, cls: "bg-emerald-500" },
          { label: "Latency (30%)",  val: relay.score.latency,                 cls: "bg-sky-500"    },
          { label: "Delivery (20%)", val: relay.score.delivery,                cls: "bg-violet-500" },
          { label: "Value (10%)",    val: relay.score.value,                   cls: "bg-amber-500"  },
        ] as const).map(({ label, val, cls }) => (
          <div key={label} className="flex items-center gap-2 mb-2">
            <span className="text-[10px] text-muted-foreground w-28 shrink-0">{label}</span>
            <div className="flex-1 h-1 bg-white/5 rounded-full overflow-hidden">
              <div className={`h-full rounded-full ${cls}`} style={{ width: `${val}%` }} />
            </div>
            <span className="font-mono text-[10px] w-6 text-right tabular-nums">{val}</span>
          </div>
        ))}
      </div>

      <div>
        <p className="text-[10px] uppercase tracking-widest text-muted-foreground mb-3">Economic Impact</p>
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-xs text-muted-foreground">Execution Efficiency</span>
            <span className="font-mono text-xs font-medium">{relay.economicImpact.efficiencyPct}%</span>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-xs text-muted-foreground">MEV Capture Quality</span>
            <EfficBadge label={relay.economicImpact.label} />
          </div>
          {relay.economicImpact.yieldImpactPct > 0 && (
            <div className="flex items-center justify-between">
              <span className="text-xs text-muted-foreground">Est. Yield Impact</span>
              <span className="font-mono text-xs text-amber-400">−{relay.economicImpact.yieldImpactPct}%</span>
            </div>
          )}
          <p className="text-[10px] text-muted-foreground/70 leading-relaxed pt-1 border-t border-border/20">
            {relay.economicImpact.note}
          </p>
        </div>
      </div>

      <div>
        <p className="text-[10px] uppercase tracking-widest text-muted-foreground mb-3">Relay Info</p>
        <div className="space-y-2">
          {([
            { k: "Type",            v: "MEV Relay" },
            { k: "Network",         v: "Ethereum Mainnet" },
            { k: "Blocks Tracked",  v: String(relay.blocksWon) },
            { k: "Composite Score", v: `${relay.score.overall}/100` },
            ...(relay.latestBlock ? [{ k: "Latest Block", v: `#${relay.latestBlock.toLocaleString()}` }] : []),
          ] as const).map(({ k, v }) => (
            <div key={k} className="flex items-center justify-between">
              <span className="text-xs text-muted-foreground">{k}</span>
              <span className="font-mono text-xs">{v}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

// ── Relay row ─────────────────────────────────────────────────────────────────

function RelayRow({
  relay, expanded, onToggle, transition,
}: {
  relay: RelayResult; expanded: boolean; onToggle: () => void; transition?: RelayTransition
}) {
  return (
    <tr
      onClick={onToggle}
      className={`border-b border-border/15 cursor-pointer select-none transition-colors ${expanded ? "bg-white/[0.025]" : "hover:bg-white/[0.018]"}`}
    >
      <td className="px-4 py-2.5">
        <div className="flex items-center gap-2.5">
          {expanded
            ? <ChevronDown className="h-3 w-3 text-muted-foreground/60 shrink-0" />
            : <ChevronRight className="h-3 w-3 text-muted-foreground/40 shrink-0" />}
          <StatusDot status={relay.status} />
          <div>
            <div className="text-sm font-medium leading-tight">{relay.name}</div>
            <div className="text-[9px] font-mono text-muted-foreground/50 uppercase tracking-wider mt-0.5">
              MEV RELAY
            </div>
          </div>
        </div>
      </td>
      <td className="px-3 py-2.5 w-40">
        <ScoreBar score={relay.score.overall} tier={relay.score.tier} />
        <div className="flex items-center gap-1.5 mt-1 flex-wrap">
          <span className="font-mono text-xs tabular-nums">{relay.score.overall}</span>
          <TierBadge tier={relay.score.tier} />
          {transition && transition !== "STABLE" && <TransitionLabel t={transition} />}
        </div>
      </td>
      <td className="px-3 py-2.5 hidden sm:table-cell">
        <div>
          <EfficBadge label={relay.economicImpact.label} />
          <div className="text-[9px] font-mono text-muted-foreground/60 mt-0.5 tabular-nums">
            {relay.economicImpact.efficiencyPct}% eff
          </div>
        </div>
      </td>
      <td className="px-3 py-2.5"><LatencyCell ms={relay.latencyMs} status={relay.status} /></td>
      <td className="px-3 py-2.5 text-right">
        <span className="font-mono text-sm tabular-nums">
          {relay.blocksWon > 0 ? relay.blocksWon : <span className="text-muted-foreground/50">—</span>}
        </span>
      </td>
      <td className="px-3 py-2.5 text-right hidden lg:table-cell">
        <span className="font-mono text-xs tabular-nums text-muted-foreground/70">
          {relay.avgBidEth > 0 ? relay.avgBidEth.toFixed(6) : "—"}
        </span>
      </td>
      <td className="px-4 py-2.5 text-right hidden xl:table-cell">
        <span className="font-mono text-[11px] text-muted-foreground/60 tabular-nums">
          {relay.latestBlock ? `#${relay.latestBlock.toLocaleString()}` : "—"}
        </span>
      </td>
    </tr>
  )
}

// ── Builder row ───────────────────────────────────────────────────────────────

function BuilderRow({ builder, rank }: { builder: BuilderResult; rank: number }) {
  return (
    <tr className="border-b border-border/15 hover:bg-white/[0.018] transition-colors">
      <td className="px-4 py-2.5">
        <div className="flex items-center gap-2">
          <span className="font-mono text-[10px] text-muted-foreground/50 w-4 tabular-nums">{rank}</span>
          <span className="font-mono text-xs text-primary">{builder.shortKey}</span>
        </div>
      </td>
      <td className="px-3 py-2.5 text-right">
        <span className="font-mono text-sm tabular-nums">{builder.blocksWon}</span>
      </td>
      <td className="px-3 py-2.5 w-44">
        <div className="flex items-center gap-2">
          <div className="flex-1 h-1 bg-white/5 rounded-full overflow-hidden">
            <div className="h-full bg-primary rounded-full transition-all duration-700"
              style={{ width: `${Math.min(builder.dominancePct, 100)}%` }} />
          </div>
          <span className="font-mono text-[10px] tabular-nums w-10 text-right">
            {builder.dominancePct.toFixed(1)}%
          </span>
        </div>
      </td>
      <td className="px-3 py-2.5 text-right hidden md:table-cell">
        <span className="font-mono text-xs tabular-nums text-muted-foreground/70">
          {builder.avgBidEth.toFixed(6)} ETH
        </span>
      </td>
      <td className="px-4 py-2.5 hidden lg:table-cell">
        <div className="flex flex-wrap gap-1">
          {builder.relaysUsed.slice(0, 3).map((r) => (
            <span key={r} className="text-[9px] font-mono px-1.5 py-0.5 rounded bg-muted/30 text-muted-foreground/70">{r}</span>
          ))}
          {builder.relaysUsed.length > 3 && (
            <span className="text-[9px] text-muted-foreground/40">+{builder.relaysUsed.length - 3}</span>
          )}
        </div>
      </td>
    </tr>
  )
}

// ── Best relay card ───────────────────────────────────────────────────────────

function BestRelayCard({ best, isLive }: { best: BestRelay | undefined; isLive: boolean }) {
  if (!best) {
    return (
      <div className="rounded border border-border/40 bg-card/60 p-4">
        <div className="flex items-center gap-1.5 text-[10px] uppercase tracking-widest text-muted-foreground mb-3">
          <Zap className="h-3 w-3" />BEST RELAY NOW
        </div>
        <p className="text-xs text-muted-foreground text-center py-4">
          {isLive ? "No relay data available" : "Initializing…"}
        </p>
      </div>
    )
  }
  const { relay, confidence, reasons } = best
  return (
    <div className="rounded border border-emerald-500/20 bg-emerald-500/[0.04] p-4">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-1.5 text-[10px] uppercase tracking-widest text-emerald-400">
          <Zap className="h-3 w-3" />BEST RELAY NOW
        </div>
        <span className="text-[9px] font-mono text-muted-foreground/50 uppercase">ETH MAINNET</span>
      </div>
      <div className="flex items-start justify-between gap-2 mb-3">
        <div>
          <div className="text-3xl font-bold font-mono tabular-nums text-emerald-400 leading-none">
            {relay.score.overall}
          </div>
          <div className="text-sm font-semibold mt-1.5 leading-tight">{relay.name}</div>
          <div className="text-[10px] font-mono text-muted-foreground mt-0.5">
            {relay.url.replace("https://", "")}
          </div>
        </div>
        <div className="flex flex-col items-end gap-1.5">
          <TierBadge tier={relay.score.tier} />
          <EfficBadge label={relay.economicImpact.label} />
        </div>
      </div>
      <div className="space-y-1.5 mb-3">
        {reasons.map((r) => (
          <div key={r} className="flex items-center gap-2 text-xs text-muted-foreground">
            <CheckCircle2 className="h-3 w-3 text-emerald-400 shrink-0" />{r}
          </div>
        ))}
      </div>
      <div className="border-t border-border/25 pt-3 space-y-1.5">
        <div className="flex items-center justify-between text-xs">
          <span className="text-muted-foreground">Confidence</span>
          <span className="font-mono font-bold text-emerald-400">{confidence}%</span>
        </div>
        <div className="flex items-center justify-between text-xs">
          <span className="text-muted-foreground">Exec Efficiency</span>
          <span className="font-mono">{relay.economicImpact.efficiencyPct}%</span>
        </div>
        <div className="flex items-center justify-between text-xs">
          <span className="text-muted-foreground">Latency</span>
          <LatencyCell ms={relay.latencyMs} status={relay.status} />
        </div>
      </div>
    </div>
  )
}

// ── Skeleton ──────────────────────────────────────────────────────────────────

function SkeletonRow({ cols }: { cols: number }) {
  return (
    <tr className="border-b border-border/15 animate-pulse">
      {Array.from({ length: cols }).map((_, i) => (
        <td key={i} className="px-4 py-3">
          <div className="h-3 bg-muted/25 rounded w-20" />
        </td>
      ))}
    </tr>
  )
}

// ── Default data ──────────────────────────────────────────────────────────────

const defaultData: DashboardData = {
  relays: [], builders: [], intelligenceFeed: [], bestRelay: undefined, recentBlocks: [],
  totalUniqueBlocks: 0, totalValueEth: 0, activeRelays: 0, totalRelays: 0,
  avgBidEth: 0, avgLatencyMs: 0, systemScore: 0, overallEfficiencyPct: 0,
  fetchedAt: new Date().toISOString(),
}

// ── Dashboard ─────────────────────────────────────────────────────────────────

export default function Dashboard() {
  const router = useRouter()
  const initialLoad = useRef(true)
  const dataRef = useRef<DashboardData>(defaultData)
  const historyRef = useRef<DashboardData[]>([])
  const feedIdsPrevRef = useRef<Set<string>>(new Set())

  const [data, setData] = useState<DashboardData>(defaultData)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [expandedRelays, setExpandedRelays] = useState<Set<string>>(new Set())
  const [newFeedIds, setNewFeedIds] = useState<Set<string>>(new Set())

  const fetchData = useCallback(async (silent = false) => {
    try {
      if (!silent && initialLoad.current) setLoading(true)
      setError(null)
      const res = await fetch("/api/relay-stats")
      if (!res.ok) throw new Error(`Server error ${res.status}`)
      const next: DashboardData = await res.json()
      if (dataRef.current !== defaultData) {
        historyRef.current.push(dataRef.current)
        if (historyRef.current.length > 60) historyRef.current.shift()
      }
      dataRef.current = next
      setData(next)
      initialLoad.current = false
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to fetch data")
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { fetchData() }, [fetchData])

  useEffect(() => {
    const id = setInterval(() => { router.refresh(); fetchData(true) }, 5000)
    return () => clearInterval(id)
  }, [fetchData, router])

  const toggleRelay = useCallback((slug: string) => {
    setExpandedRelays((prev) => {
      const next = new Set(prev)
      next.has(slug) ? next.delete(slug) : next.add(slug)
      return next
    })
  }, [])

  const criticalCount = useMemo(
    () => data.intelligenceFeed.filter((e) => e.severity === "critical").length,
    [data.intelligenceFeed]
  )

  const deltaEvents = useMemo(
    () => computeDeltaEvents(data, historyRef.current),
    [data]
  )
  const relayTransitions = useMemo(
    () => computeRelayTransitions(data.relays, historyRef.current),
    [data.relays]
  )
  const simEvents = useMemo(() => {
    const alertCount =
      deltaEvents.filter((e) => e.severity !== "info").length +
      data.intelligenceFeed.filter((e) => e.severity !== "info").length
    return computeSimEvents(data.relays, historyRef.current, alertCount)
  }, [data.relays, data.intelligenceFeed, deltaEvents])

  const compStats = useMemo(
    () => computeCompStats(data.relays, historyRef.current),
    [data.relays]
  )

  const mergedFeed = useMemo((): IntelligenceEvent[] => {
    const severityOrder: Record<string, number> = { critical: 0, warning: 1, info: 2 }
    const all = [...deltaEvents, ...data.intelligenceFeed, ...simEvents]
    const seen = new Set<string>()
    return all
      .filter((e) => (seen.has(e.id) ? false : (seen.add(e.id), true)))
      .sort((a, b) => severityOrder[a.severity] - severityOrder[b.severity])
      .slice(0, 20)
  }, [deltaEvents, data.intelligenceFeed, simEvents])

  const compStripItems = useMemo(() => {
    const items: Array<{ key: string; label: string; cls: string }> = []
    const relayMap = new Map(data.relays.map((r) => [r.slug, r]))
    if (compStats.fastestSlug) {
      const r = relayMap.get(compStats.fastestSlug)
      if (r) items.push({ key: "fast", label: `⚡ Latency leader: ${r.name} (${r.latencyMs}ms)`, cls: "text-emerald-400" })
    }
    if (compStats.biggestGainerSlug) {
      const r = relayMap.get(compStats.biggestGainerSlug)
      if (r) items.push({ key: "gain", label: `↑ ${r.name} largest improvement`, cls: "text-sky-400" })
    }
    if (compStats.biggestLoserSlug) {
      const r = relayMap.get(compStats.biggestLoserSlug)
      if (r) items.push({ key: "loss", label: `↓ ${r.name} most degraded`, cls: "text-amber-400" })
    }
    if (compStats.mostStableSlug) {
      const r = relayMap.get(compStats.mostStableSlug)
      if (r) items.push({ key: "stable", label: `◆ Stability leader: ${r.name}`, cls: "text-primary/80" })
    }
    if (compStats.bestPerformerSlug && compStats.historyWindowMin >= 1) {
      const r = relayMap.get(compStats.bestPerformerSlug)
      if (r) items.push({ key: "best", label: `✦ ${r.name} top performer ~${compStats.historyWindowMin}m`, cls: "text-violet-400" })
    }
    return items
  }, [compStats, data.relays])

  useEffect(() => {
    const freshIds = new Set<string>()
    for (const e of mergedFeed) {
      if (!feedIdsPrevRef.current.has(e.id)) freshIds.add(e.id)
    }
    feedIdsPrevRef.current = new Set(mergedFeed.map((e) => e.id))
    if (freshIds.size > 0) {
      setNewFeedIds(freshIds)
      const timer = setTimeout(() => setNewFeedIds(new Set()), 1500)
      return () => clearTimeout(timer)
    }
  }, [mergedFeed])

  const isLive = !loading

  return (
    <div className="min-h-screen bg-background flex flex-col">

      {/* ── Header ── */}
      <header className="sticky top-0 z-50 border-b border-border/40 bg-background/95 backdrop-blur-md">
        <div className="max-w-screen-2xl mx-auto px-4 h-12 flex items-center justify-between gap-4">
          <div className="flex items-center gap-2.5 shrink-0">
            <Layers className="h-4 w-4 text-primary" />
            <div className="leading-none">
              <span className="font-bold text-sm tracking-tight">
                MEV<span className="text-primary">SCAN</span>
              </span>
              <span className="hidden sm:inline ml-2 text-[9px] uppercase tracking-[0.18em] text-muted-foreground">
                Relay Intelligence
              </span>
            </div>
          </div>

          {/* Network badge */}
          <div className="flex items-center gap-2 bg-blue-400/8 border border-blue-400/20 rounded px-2.5 py-1">
            <span className="h-1.5 w-1.5 rounded-full bg-blue-400 shrink-0" />
            <span className="text-[10px] font-bold tracking-wider text-blue-400">ETHEREUM MAINNET</span>
            <span className="hidden sm:inline text-[9px] text-muted-foreground/50 ml-1">· MEV-Boost Relay Infrastructure</span>
          </div>

          {/* Right status */}
          <div className="flex items-center gap-3 shrink-0">
            {criticalCount > 0 && (
              <div className="hidden sm:flex items-center gap-1 text-[10px] font-bold text-red-400 animate-pulse">
                <AlertTriangle className="h-3 w-3" />
                {criticalCount} ALERT{criticalCount > 1 ? "S" : ""}
              </div>
            )}
            <div className="hidden md:flex items-center gap-2 text-[10px] text-muted-foreground">
              <CircleDot className="h-3 w-3 text-emerald-400 animate-pulse" />
              <span className="text-emerald-400 font-bold tracking-wider">LIVE</span>
              <span className="opacity-30">·</span>
              <LiveClock />
              <span className="opacity-30">·</span>
              <LastUpdatedBadge fetchedAt={data.fetchedAt} isLive={isLive} />
            </div>
            <RefreshButton onRefresh={() => fetchData()} />
          </div>
        </div>
      </header>

      {/* ── Main ── */}
      <main className="flex-1 max-w-screen-2xl w-full mx-auto px-4 py-4 space-y-4">

        {error && (
          <div className="flex items-center gap-3 rounded border border-red-500/30 bg-red-500/8 px-4 py-2.5">
            <XCircle className="h-4 w-4 text-red-400 shrink-0" />
            <span className="text-sm text-red-300">{error}</span>
            <button onClick={() => fetchData()} className="ml-auto text-xs text-red-400 hover:text-red-300 underline underline-offset-2">
              Retry
            </button>
          </div>
        )}

        {/* ── Command strip ── */}
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
          <MetricTile
            label="Active Relays" icon={Wifi}
            value={loading ? "—" : `${data.activeRelays}/${data.totalRelays}`}
            sub={loading ? undefined : `${data.totalRelays - data.activeRelays} offline or unreachable`}
            accent={!loading && data.activeRelays === data.totalRelays ? "text-emerald-400" : "text-amber-400"}
          />
          <MetricTile
            label="Avg Latency" icon={Timer}
            value={loading ? "—" : `${data.avgLatencyMs}ms`}
            sub={loading ? undefined : data.avgLatencyMs < 300 ? "Healthy response times" : "Elevated — monitor relays"}
            accent={!loading ? (data.avgLatencyMs < 300 ? "text-emerald-400" : data.avgLatencyMs < 600 ? "text-amber-400" : "text-red-400") : undefined}
          />
          <MetricTile
            label="Exec Efficiency" icon={Activity}
            value={loading ? "—" : `${data.overallEfficiencyPct}%`}
            sub="weighted avg across live relays"
            accent={!loading ? (data.overallEfficiencyPct >= 80 ? "text-emerald-400" : data.overallEfficiencyPct >= 60 ? "text-amber-400" : "text-red-400") : undefined}
          />
          <MetricTile
            label="Unique Blocks" icon={Blocks}
            value={loading ? "—" : data.totalUniqueBlocks.toLocaleString()}
            sub="deduped across relay set"
          />
          <MetricTile
            label="Avg Block Value" icon={TrendingUp}
            value={loading ? "—" : data.avgBidEth > 0 ? `${data.avgBidEth.toFixed(5)}` : "—"}
            sub="ETH · recent block set"
            accent="text-primary"
          />
        </div>

        {/* ── Main grid ── */}
        <div className="grid grid-cols-1 xl:grid-cols-12 gap-4">

          {/* MEV Relay status — 8 cols */}
          <div className="xl:col-span-8">
            <Panel
              icon={Server}
              title="MEV Relays"
              right={
                <span className="flex items-center gap-2">
                  <span>{data.relays.length} relays monitored</span>
                  <span className="opacity-30">·</span>
                  <LastUpdatedBadge fetchedAt={data.fetchedAt} isLive={isLive} />
                </span>
              }
            >
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr>
                      <TH>Relay</TH>
                      <TH>Score</TH>
                      <TH hidden="hidden sm:table-cell">Efficiency</TH>
                      <TH>Latency</TH>
                      <TH right>Blocks</TH>
                      <TH right hidden="hidden lg:table-cell">Avg Bid</TH>
                      <TH right hidden="hidden xl:table-cell">Latest</TH>
                    </tr>
                  </thead>
                  <tbody>
                    {loading ? (
                      Array.from({ length: 5 }).map((_, i) => <SkeletonRow key={i} cols={7} />)
                    ) : data.relays.length === 0 ? (
                      <tr>
                        <td colSpan={7} className="px-4 py-12 text-center text-sm text-muted-foreground">
                          No relay data available
                        </td>
                      </tr>
                    ) : (
                      data.relays.map((relay) => (
                        <Fragment key={relay.slug}>
                          <RelayRow
                            relay={relay}
                            expanded={expandedRelays.has(relay.slug)}
                            onToggle={() => toggleRelay(relay.slug)}
                            transition={relayTransitions.get(relay.slug)}
                          />
                          {expandedRelays.has(relay.slug) && (
                            <tr>
                              <td colSpan={7} className="p-0">
                                <RelayDetailPane relay={relay} />
                              </td>
                            </tr>
                          )}
                        </Fragment>
                      ))
                    )}
                  </tbody>
                </table>
              </div>

              {/* Competitive strip */}
              {!loading && compStripItems.length > 0 && (
                <div className="flex flex-wrap items-center gap-3 px-4 py-2 border-t border-border/20 bg-card/20">
                  <span className="text-[10px] text-muted-foreground/40 uppercase tracking-wider shrink-0">Live Intel</span>
                  {compStripItems.map((item) => (
                    <span key={item.key} className={`text-[10px] font-bold ${item.cls}`}>{item.label}</span>
                  ))}
                </div>
              )}

              <div className="flex flex-wrap items-center gap-x-4 gap-y-1 px-4 py-2.5 border-t border-border/20 bg-card/20">
                <span className="text-[10px] text-muted-foreground/50 uppercase tracking-wider">Score weights:</span>
                {[["Uptime","40%"],["Latency","30%"],["Delivery","20%"],["Value","10%"]].map(([l, p]) => (
                  <span key={l} className="text-[10px] text-muted-foreground/50">
                    {l} <span className="text-primary/50">{p}</span>
                  </span>
                ))}
                <span className="ml-auto text-[10px] text-muted-foreground/40">
                  Click row to expand details
                </span>
              </div>
            </Panel>
          </div>

          {/* Side panel — 4 cols */}
          <div className="xl:col-span-4 flex flex-col gap-4">
            <BestRelayCard best={data.bestRelay} isLive={isLive} />

            <Panel
              icon={Globe}
              title="Intelligence Feed"
              right={`${mergedFeed.length} events`}
            >
              <div className="divide-y divide-border/15 max-h-80 overflow-y-auto">
                {mergedFeed.length === 0 ? (
                  <p className="px-4 py-8 text-xs text-muted-foreground text-center">No events</p>
                ) : (
                  mergedFeed.map((event) => (
                    <div key={event.id} className="px-3 py-0.5">
                      <FeedItem event={event} isNew={newFeedIds.has(event.id)} />
                    </div>
                  ))
                )}
              </div>
            </Panel>
          </div>
        </div>

        {/* ── Builder performance ── */}
        <Panel
          icon={TrendingUp}
          title="Builder Performance"
          right={
            <span className="flex items-center gap-2">
              <span>{data.builders.length} builders tracked</span>
              <span className="opacity-30">·</span>
              <LastUpdatedBadge fetchedAt={data.fetchedAt} isLive={isLive} />
            </span>
          }
        >
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr>
                  <TH>Builder</TH>
                  <TH right>Blocks</TH>
                  <TH>Market Share</TH>
                  <TH right hidden="hidden md:table-cell">Avg Bid</TH>
                  <TH hidden="hidden lg:table-cell">Relays</TH>
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  Array.from({ length: 5 }).map((_, i) => <SkeletonRow key={i} cols={5} />)
                ) : data.builders.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="px-4 py-12 text-center text-sm text-muted-foreground">
                      No builder data — relay payload feed may be empty
                    </td>
                  </tr>
                ) : (
                  data.builders.slice(0, 15).map((b, i) => (
                    <BuilderRow key={b.pubkey} builder={b} rank={i + 1} />
                  ))
                )}
              </tbody>
            </table>
          </div>
        </Panel>
      </main>

      {/* ── Footer ── */}
      <footer className="border-t border-border/25 mt-auto">
        <div className="max-w-screen-2xl mx-auto px-4 py-3 flex flex-wrap items-center justify-between gap-2 text-[10px] text-muted-foreground/40 uppercase tracking-wider">
          <div className="flex items-center gap-2">
            <Layers className="h-3 w-3" />
            MEVScan · Ethereum Execution Observability
          </div>
          <span>Live MEV-Boost relay APIs · Ethereum Mainnet · 5s refresh</span>
        </div>
      </footer>
    </div>
  )
}
