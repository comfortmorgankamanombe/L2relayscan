"use client"

import { useState, useEffect, useCallback, useRef } from "react"
import { useRouter } from "next/navigation"
import {
  Activity,
  AlertTriangle,
  Blocks,
  CheckCircle2,
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
  BuilderResult,
  IntelligenceEvent,
  BestRelay,
  EventType,
} from "@/lib/fetch-relays"
import type { ChainType } from "@/lib/relay-config"

// ── Small components ──────────────────────────────────────────────────────────

function StatusDot({ status }: { status: RelayStatus }) {
  if (status === "online") {
    return (
      <span className="relative flex h-2 w-2 shrink-0">
        <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-60" />
        <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-400" />
      </span>
    )
  }
  return <span className="inline-flex h-2 w-2 shrink-0 rounded-full bg-red-500/70" />
}

const TIER_STYLE: Record<ScoreTier, string> = {
  OPTIMAL:  "text-emerald-400 bg-emerald-400/10 border-emerald-400/25",
  GOOD:     "text-amber-400  bg-amber-400/10  border-amber-400/25",
  DEGRADED: "text-orange-400 bg-orange-400/10 border-orange-400/25",
  OFFLINE:  "text-red-400    bg-red-400/10    border-red-400/25",
}

function TierBadge({ tier }: { tier: ScoreTier }) {
  return (
    <span className={`inline-flex items-center px-1.5 py-0.5 rounded-sm border text-[9px] font-bold tracking-wider ${TIER_STYLE[tier]}`}>
      {tier}
    </span>
  )
}

const CHAIN_STYLE: Record<ChainType, { label: string; cls: string }> = {
  ethereum: { label: "ETH",  cls: "text-blue-400  bg-blue-400/10  border-blue-400/25"  },
  arbitrum: { label: "ARB",  cls: "text-purple-400 bg-purple-400/10 border-purple-400/25" },
  base:     { label: "BASE", cls: "text-sky-400   bg-sky-400/10   border-sky-400/25"   },
  optimism: { label: "OP",   cls: "text-red-400   bg-red-400/10   border-red-400/25"   },
}

function ChainBadge({ chain }: { chain: ChainType }) {
  const { label, cls } = CHAIN_STYLE[chain]
  return (
    <span className={`inline-flex items-center px-1.5 py-0.5 rounded-sm border text-[9px] font-bold tracking-wider ${cls}`}>
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
  const cls = ms < 150 ? "text-emerald-400" : ms < 400 ? "text-foreground" : ms < 700 ? "text-amber-400" : "text-red-400"
  return <span className={`font-mono text-xs tabular-nums ${cls}`}>{ms}ms</span>
}

const EVENT_ICON: Record<EventType, React.ReactNode> = {
  degraded:      <XCircle className="h-3 w-3 text-red-400 shrink-0" />,
  latency_spike: <AlertTriangle className="h-3 w-3 text-amber-400 shrink-0" />,
  concentration: <AlertTriangle className="h-3 w-3 text-amber-400 shrink-0" />,
  high_value:    <TrendingUp className="h-3 w-3 text-blue-400 shrink-0" />,
  nominal:       <CheckCircle2 className="h-3 w-3 text-emerald-400 shrink-0" />,
}
const EVENT_BORDER: Record<string, string> = {
  critical: "border-l-red-500/60",
  warning:  "border-l-amber-500/60",
  info:     "border-l-emerald-500/40",
}
const EVENT_TEXT: Record<string, string> = {
  critical: "text-red-300",
  warning:  "text-amber-300",
  info:     "text-foreground/80",
}

function FeedItem({ event }: { event: IntelligenceEvent }) {
  return (
    <div className={`border-l-2 pl-3 py-2 ${EVENT_BORDER[event.severity]}`}>
      <div className="flex items-start gap-2">
        {EVENT_ICON[event.type]}
        <p className={`text-xs leading-snug ${EVENT_TEXT[event.severity]}`}>{event.message}</p>
      </div>
      {event.relay && (
        <p className="text-[10px] text-muted-foreground mt-0.5 pl-5">{event.relay}</p>
      )}
    </div>
  )
}

function MetricTile({
  label, value, sub, icon: Icon, accent,
}: {
  label: string
  value: string
  sub?: string
  icon: React.ElementType
  accent?: string
}) {
  return (
    <div className="rounded border border-border/40 bg-card/60 px-4 py-3">
      <div className="flex items-center justify-between mb-1.5">
        <span className="text-[10px] uppercase tracking-widest text-muted-foreground font-medium">{label}</span>
        <Icon className={`h-3.5 w-3.5 ${accent ?? "text-muted-foreground"}`} />
      </div>
      <div className={`text-2xl font-bold font-mono tabular-nums tracking-tight ${accent ?? "text-foreground"}`}>
        {value}
      </div>
      {sub && <p className="text-[10px] text-muted-foreground mt-0.5">{sub}</p>}
    </div>
  )
}

// ── Default data ──────────────────────────────────────────────────────────────

const defaultData: DashboardData = {
  relays: [], builders: [], intelligenceFeed: [], bestRelays: {}, recentBlocks: [],
  totalUniqueBlocks: 0, totalValueEth: 0, activeRelays: 0, totalRelays: 0,
  avgBidEth: 0, avgLatencyMs: 0, systemScore: 0, fetchedAt: new Date().toISOString(),
}

// ── Chain tabs ────────────────────────────────────────────────────────────────

type ActiveChain = "all" | ChainType

const CHAINS: { id: ActiveChain; label: string }[] = [
  { id: "all",      label: "ALL CHAINS" },
  { id: "ethereum", label: "ETHEREUM"   },
  { id: "arbitrum", label: "ARBITRUM"   },
]

// ── Skeleton ──────────────────────────────────────────────────────────────────

function SkeletonRow() {
  return (
    <tr className="border-b border-border/20 animate-pulse">
      {[32, 16, 16, 28, 16, 16, 20].map((w, i) => (
        <td key={i} className="px-4 py-3">
          <div className={`h-3 bg-muted/30 rounded w-${w}`} />
        </td>
      ))}
    </tr>
  )
}

// ── Best relay card ───────────────────────────────────────────────────────────

function BestRelayCard({ best }: { best: BestRelay | undefined }) {
  if (!best) {
    return (
      <div className="rounded border border-border/40 bg-card/60 p-4">
        <div className="flex items-center gap-1.5 text-[10px] uppercase tracking-widest text-muted-foreground mb-3">
          <Zap className="h-3 w-3" />
          BEST RELAY NOW
        </div>
        <p className="text-sm text-muted-foreground text-center py-4">No relay data yet</p>
      </div>
    )
  }

  const { relay, confidence, reasons } = best
  return (
    <div className="rounded border border-emerald-500/20 bg-emerald-500/5 p-4">
      <div className="flex items-center gap-1.5 text-[10px] uppercase tracking-widest text-emerald-400 mb-3">
        <Zap className="h-3 w-3" />
        BEST RELAY NOW
      </div>

      <div className="flex items-start justify-between gap-2 mb-3">
        <div>
          <div className="text-3xl font-bold font-mono tabular-nums text-emerald-400 leading-none">
            {relay.score.overall}
          </div>
          <div className="text-base font-semibold mt-1">{relay.name}</div>
          <div className="text-[11px] font-mono text-muted-foreground mt-0.5">
            {relay.url.replace("https://", "")}
          </div>
        </div>
        <TierBadge tier={relay.score.tier} />
      </div>

      <div className="space-y-1.5 mb-3">
        {reasons.map((r) => (
          <div key={r} className="flex items-center gap-2 text-xs text-muted-foreground">
            <CheckCircle2 className="h-3 w-3 text-emerald-400 shrink-0" />
            {r}
          </div>
        ))}
      </div>

      <div className="border-t border-border/30 pt-3 space-y-1.5">
        <div className="flex items-center justify-between text-xs">
          <span className="text-muted-foreground">Confidence</span>
          <span className="font-mono font-bold text-emerald-400">{confidence}%</span>
        </div>
        <div className="flex items-center justify-between text-xs">
          <span className="text-muted-foreground">Chain</span>
          <ChainBadge chain={relay.chain} />
        </div>
        <div className="flex items-center justify-between text-xs">
          <span className="text-muted-foreground">Latency</span>
          <LatencyCell ms={relay.latencyMs} status={relay.status} />
        </div>
      </div>
    </div>
  )
}

// ── Score breakdown row ───────────────────────────────────────────────────────

function RelayRow({ relay }: { relay: RelayResult }) {
  return (
    <tr className="border-b border-border/15 hover:bg-white/[0.018] transition-colors group">
      <td className="px-4 py-2.5">
        <div className="flex items-center gap-2.5">
          <StatusDot status={relay.status} />
          <div>
            <div className="text-sm font-medium leading-tight">{relay.name}</div>
            <div className="text-[10px] font-mono text-muted-foreground leading-tight mt-0.5">
              {relay.url.replace("https://", "")}
            </div>
          </div>
        </div>
      </td>
      <td className="px-3 py-2.5">
        <ChainBadge chain={relay.chain} />
      </td>
      <td className="px-3 py-2.5">
        <div className="w-28">
          <ScoreBar score={relay.score.overall} tier={relay.score.tier} />
          <div className="flex items-center gap-2 mt-1">
            <span className="font-mono text-xs tabular-nums">{relay.score.overall}</span>
            <TierBadge tier={relay.score.tier} />
          </div>
        </div>
      </td>
      <td className="px-3 py-2.5">
        <LatencyCell ms={relay.latencyMs} status={relay.status} />
      </td>
      <td className="px-3 py-2.5 text-right">
        <span className="font-mono text-sm tabular-nums">
          {relay.blocksWon > 0 ? relay.blocksWon : <span className="text-muted-foreground">—</span>}
        </span>
      </td>
      <td className="px-3 py-2.5 text-right hidden lg:table-cell">
        <span className="font-mono text-xs tabular-nums text-muted-foreground">
          {relay.avgBidEth > 0 ? relay.avgBidEth.toFixed(6) : "—"}
        </span>
      </td>
      <td className="px-4 py-2.5 text-right hidden xl:table-cell">
        <span className="font-mono text-xs text-muted-foreground tabular-nums">
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
          <span className="font-mono text-[10px] text-muted-foreground w-4 tabular-nums">{rank}</span>
          <span className="font-mono text-xs text-primary">{builder.shortKey}</span>
        </div>
      </td>
      <td className="px-3 py-2.5">
        <ChainBadge chain={builder.chain} />
      </td>
      <td className="px-3 py-2.5 text-right">
        <span className="font-mono text-sm tabular-nums">{builder.blocksWon}</span>
      </td>
      <td className="px-3 py-2.5 w-44">
        <div className="flex items-center gap-2">
          <div className="flex-1 h-1 bg-white/5 rounded-full overflow-hidden">
            <div
              className="h-full bg-primary rounded-full transition-all duration-700"
              style={{ width: `${Math.min(builder.dominancePct, 100)}%` }}
            />
          </div>
          <span className="font-mono text-[10px] tabular-nums w-10 text-right">
            {builder.dominancePct.toFixed(1)}%
          </span>
        </div>
      </td>
      <td className="px-3 py-2.5 text-right hidden md:table-cell">
        <span className="font-mono text-xs tabular-nums text-muted-foreground">
          {builder.avgBidEth.toFixed(6)} ETH
        </span>
      </td>
      <td className="px-4 py-2.5 hidden lg:table-cell">
        <div className="flex flex-wrap gap-1">
          {builder.relaysUsed.slice(0, 2).map((r) => (
            <span key={r} className="text-[9px] font-mono px-1.5 py-0.5 rounded bg-muted/30 text-muted-foreground">
              {r}
            </span>
          ))}
          {builder.relaysUsed.length > 2 && (
            <span className="text-[9px] text-muted-foreground/60">+{builder.relaysUsed.length - 2}</span>
          )}
        </div>
      </td>
    </tr>
  )
}

// ── Section panel ─────────────────────────────────────────────────────────────

function Panel({
  icon: Icon, title, right, children,
}: {
  icon: React.ElementType
  title: string
  right?: React.ReactNode
  children: React.ReactNode
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

// ── TH helper ────────────────────────────────────────────────────────────────

function TH({ children, right }: { children: React.ReactNode; right?: boolean }) {
  return (
    <th className={`px-3 py-2 text-[10px] uppercase tracking-wider text-muted-foreground font-medium border-b border-border/30 ${right ? "text-right" : "text-left"}`}>
      {children}
    </th>
  )
}

// ── Dashboard ─────────────────────────────────────────────────────────────────

export default function Dashboard() {
  const router = useRouter()
  const initialLoad = useRef(true)
  const [data, setData] = useState<DashboardData>(defaultData)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [activeChain, setActiveChain] = useState<ActiveChain>("all")

  const fetchData = useCallback(async (silent = false) => {
    try {
      if (!silent && initialLoad.current) setLoading(true)
      setError(null)
      const res = await fetch("/api/relay-stats")
      if (!res.ok) throw new Error(`Server error ${res.status}`)
      const next: DashboardData = await res.json()
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

  // Derived data
  const filteredRelays = activeChain === "all" ? data.relays : data.relays.filter((r) => r.chain === activeChain)
  const filteredBuilders = activeChain === "all" ? data.builders : data.builders.filter((b) => b.chain === activeChain)
  const filteredFeed = activeChain === "all"
    ? data.intelligenceFeed
    : data.intelligenceFeed.filter((e) => !e.chain || e.chain === activeChain)

  const bestRelay: BestRelay | undefined =
    activeChain === "all"
      ? (Object.values(data.bestRelays).filter((v): v is BestRelay => v !== undefined))
          .sort((a, b) => b.relay.score.overall - a.relay.score.overall)[0]
      : data.bestRelays[activeChain]

  const criticalCount = data.intelligenceFeed.filter((e) => e.severity === "critical").length
  const fetchedTime = new Date(data.fetchedAt).toLocaleTimeString("en-US", {
    hour: "2-digit", minute: "2-digit", second: "2-digit",
  })

  return (
    <div className="min-h-screen bg-background flex flex-col">

      {/* ── Header ── */}
      <header className="sticky top-0 z-50 border-b border-border/40 bg-background/90 backdrop-blur-md">
        <div className="max-w-screen-2xl mx-auto px-4 h-12 flex items-center justify-between gap-4">

          {/* Logo */}
          <div className="flex items-center gap-2.5 shrink-0">
            <Layers className="h-4 w-4 text-primary" />
            <div className="leading-none">
              <span className="font-bold text-sm tracking-tight">
                L2RELAY<span className="text-primary">SCAN</span>
              </span>
              <span className="hidden sm:inline ml-2 text-[9px] uppercase tracking-[0.2em] text-muted-foreground">
                Execution Intelligence
              </span>
            </div>
          </div>

          {/* Chain tabs */}
          <div className="flex items-center gap-0.5 bg-muted/30 rounded border border-border/40 p-0.5">
            {CHAINS.map((c) => (
              <button
                key={c.id}
                onClick={() => setActiveChain(c.id)}
                className={`px-2.5 py-1 text-[10px] font-bold tracking-wider rounded transition-all ${
                  activeChain === c.id
                    ? "bg-primary/20 text-primary border border-primary/30"
                    : "text-muted-foreground hover:text-foreground"
                }`}
              >
                {c.label}
              </button>
            ))}
          </div>

          {/* Status bar */}
          <div className="flex items-center gap-3 shrink-0">
            {criticalCount > 0 && (
              <div className="flex items-center gap-1 text-[10px] text-red-400 font-medium">
                <AlertTriangle className="h-3 w-3" />
                {criticalCount} ALERT{criticalCount > 1 ? "S" : ""}
              </div>
            )}
            <div className="hidden md:flex items-center gap-2 text-[10px] text-muted-foreground">
              <CircleDot className="h-3 w-3 text-emerald-400 animate-pulse" />
              <span className="text-emerald-400 font-bold tracking-wider">LIVE</span>
              <span className="text-border/60">·</span>
              <LiveClock />
            </div>
            <RefreshButton onRefresh={() => fetchData()} />
          </div>
        </div>
      </header>

      {/* ── Main ── */}
      <main className="flex-1 max-w-screen-2xl w-full mx-auto px-4 py-4 space-y-4">

        {/* Error banner */}
        {error && (
          <div className="flex items-center gap-3 rounded border border-red-500/30 bg-red-500/10 px-4 py-2.5 text-sm">
            <XCircle className="h-4 w-4 text-red-400 shrink-0" />
            <span className="text-red-300">{error}</span>
            <button onClick={() => fetchData()} className="ml-auto text-xs text-red-400 hover:text-red-300 underline">
              Retry
            </button>
          </div>
        )}

        {/* ── Command strip ── */}
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
          <MetricTile
            label="Active Relays"
            value={loading ? "—" : `${data.activeRelays}/${data.totalRelays}`}
            sub={loading ? undefined : `${data.totalRelays - data.activeRelays} offline`}
            icon={Wifi}
            accent={data.activeRelays === data.totalRelays ? "text-emerald-400" : "text-amber-400"}
          />
          <MetricTile
            label="Avg Latency"
            value={loading ? "—" : `${data.avgLatencyMs}ms`}
            sub={loading ? undefined : data.avgLatencyMs < 300 ? "Healthy" : "Elevated"}
            icon={Timer}
            accent={data.avgLatencyMs < 300 ? "text-emerald-400" : data.avgLatencyMs < 600 ? "text-amber-400" : "text-red-400"}
          />
          <MetricTile
            label="System Score"
            value={loading ? "—" : `${data.systemScore}`}
            sub="/100 composite"
            icon={Activity}
            accent={data.systemScore >= 70 ? "text-emerald-400" : data.systemScore >= 40 ? "text-amber-400" : "text-red-400"}
          />
          <MetricTile
            label="Unique Blocks"
            value={loading ? "—" : data.totalUniqueBlocks.toLocaleString()}
            sub="deduped across relays"
            icon={Blocks}
          />
          <MetricTile
            label="Avg Block Value"
            value={loading ? "—" : data.avgBidEth > 0 ? `${data.avgBidEth.toFixed(5)}` : "—"}
            sub="ETH · recent blocks"
            icon={TrendingUp}
            accent="text-primary"
          />
        </div>

        {/* ── Main grid ── */}
        <div className="grid grid-cols-1 xl:grid-cols-12 gap-4">

          {/* Relay status panel */}
          <div className="xl:col-span-8">
            <Panel
              icon={Server}
              title="Relay Status"
              right={`${filteredRelays.length} relays · sorted by score · updated ${fetchedTime}`}
            >
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr>
                      <TH>Relay</TH>
                      <TH>Chain</TH>
                      <TH>Score</TH>
                      <TH>Latency</TH>
                      <th className="px-3 py-2 text-[10px] uppercase tracking-wider text-muted-foreground font-medium border-b border-border/30 text-right">Blocks</th>
                      <th className="px-3 py-2 text-[10px] uppercase tracking-wider text-muted-foreground font-medium border-b border-border/30 text-right hidden lg:table-cell">Avg Bid</th>
                      <th className="px-4 py-2 text-[10px] uppercase tracking-wider text-muted-foreground font-medium border-b border-border/30 text-right hidden xl:table-cell">Latest</th>
                    </tr>
                  </thead>
                  <tbody>
                    {loading ? (
                      Array.from({ length: 5 }).map((_, i) => <SkeletonRow key={i} />)
                    ) : filteredRelays.length === 0 ? (
                      <tr>
                        <td colSpan={7} className="px-4 py-10 text-center text-sm text-muted-foreground">
                          No relays for selected chain
                        </td>
                      </tr>
                    ) : (
                      filteredRelays.map((relay) => <RelayRow key={relay.slug} relay={relay} />)
                    )}
                  </tbody>
                </table>
              </div>

              {/* Score legend */}
              <div className="flex items-center gap-4 px-4 py-2.5 border-t border-border/20 bg-card/20">
                <span className="text-[10px] text-muted-foreground uppercase tracking-wider">Score weights:</span>
                {[
                  { label: "Uptime", pct: "40%" },
                  { label: "Latency", pct: "30%" },
                  { label: "Delivery", pct: "20%" },
                  { label: "Value", pct: "10%" },
                ].map(({ label, pct }) => (
                  <span key={label} className="text-[10px] text-muted-foreground/70">
                    {label} <span className="text-primary/70">{pct}</span>
                  </span>
                ))}
              </div>
            </Panel>
          </div>

          {/* Side panel */}
          <div className="xl:col-span-4 flex flex-col gap-4">
            <BestRelayCard best={bestRelay} />

            {/* Intelligence feed */}
            <Panel icon={Globe} title="Intelligence Feed" right={`${filteredFeed.length} events`}>
              <div className="divide-y divide-border/20 max-h-72 overflow-y-auto">
                {filteredFeed.length === 0 ? (
                  <p className="px-4 py-6 text-xs text-muted-foreground text-center">No events</p>
                ) : (
                  filteredFeed.map((event) => (
                    <div key={event.id} className="px-3 py-1.5">
                      <FeedItem event={event} />
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
          right={`${filteredBuilders.length} unique builders · top 15 shown`}
        >
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr>
                  <TH>Builder</TH>
                  <TH>Chain</TH>
                  <th className="px-3 py-2 text-[10px] uppercase tracking-wider text-muted-foreground font-medium border-b border-border/30 text-right">Blocks</th>
                  <TH>Market Share</TH>
                  <th className="px-3 py-2 text-[10px] uppercase tracking-wider text-muted-foreground font-medium border-b border-border/30 text-right hidden md:table-cell">Avg Bid</th>
                  <th className="px-4 py-2 text-[10px] uppercase tracking-wider text-muted-foreground font-medium border-b border-border/30 hidden lg:table-cell">Relays</th>
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  Array.from({ length: 5 }).map((_, i) => <SkeletonRow key={i} />)
                ) : filteredBuilders.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="px-4 py-10 text-center text-sm text-muted-foreground">
                      No builder data yet
                    </td>
                  </tr>
                ) : (
                  filteredBuilders.slice(0, 15).map((b, i) => (
                    <BuilderRow key={`${b.pubkey}-${b.chain}`} builder={b} rank={i + 1} />
                  ))
                )}
              </tbody>
            </table>
          </div>
        </Panel>
      </main>

      {/* ── Footer ── */}
      <footer className="border-t border-border/30 mt-auto">
        <div className="max-w-screen-2xl mx-auto px-4 py-3 flex items-center justify-between text-[10px] text-muted-foreground/60 uppercase tracking-wider">
          <div className="flex items-center gap-2">
            <Layers className="h-3 w-3" />
            L2RelayScan · Execution Intelligence Platform
          </div>
          <span>Data sourced live from relay APIs · 5s refresh</span>
        </div>
      </footer>
    </div>
  )
}
