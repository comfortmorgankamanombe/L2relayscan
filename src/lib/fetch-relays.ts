import { RELAYS, type ChainType, type RelayConfig } from "./relay-config"

// ── Types ─────────────────────────────────────────────────────────────────────

export type RelayStatus = "online" | "offline"
export type ScoreTier = "OPTIMAL" | "GOOD" | "DEGRADED" | "OFFLINE"
export type EventSeverity = "critical" | "warning" | "info"
export type EventType = "degraded" | "latency_spike" | "concentration" | "high_value" | "nominal"

export interface RelayPayload {
  slot: string
  block_hash: string
  builder_pubkey: string
  proposer_pubkey: string
  proposer_fee_recipient: string
  gas_limit: string
  gas_used: string
  value: string
  num_tx: string
  block_number: string
}

export interface RelayScore {
  overall: number
  latency: number
  delivery: number
  value: number
  tier: ScoreTier
}

export interface RelayResult {
  name: string
  slug: string
  url: string
  chain: ChainType
  status: RelayStatus
  latencyMs: number
  blocksWon: number
  totalValueEth: number
  avgBidEth: number
  latestBlock: number | null
  score: RelayScore
}

export interface RecentBlock extends RelayPayload {
  relayName: string
  chain: ChainType
  valueEth: number
}

export interface BuilderResult {
  pubkey: string
  shortKey: string
  blocksWon: number
  totalValueEth: number
  avgBidEth: number
  dominancePct: number
  relaysUsed: string[]
  chain: ChainType
}

export interface IntelligenceEvent {
  id: string
  type: EventType
  severity: EventSeverity
  message: string
  relay?: string
  chain?: ChainType
  timestamp: string
}

export interface BestRelay {
  relay: RelayResult
  confidence: number
  reasons: string[]
}

export interface DashboardData {
  relays: RelayResult[]
  builders: BuilderResult[]
  intelligenceFeed: IntelligenceEvent[]
  bestRelays: Partial<Record<ChainType, BestRelay>>
  recentBlocks: RecentBlock[]
  totalUniqueBlocks: number
  totalValueEth: number
  activeRelays: number
  totalRelays: number
  avgBidEth: number
  avgLatencyMs: number
  systemScore: number
  fetchedAt: string
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function weiToEth(wei: string): number {
  const n = parseFloat(wei)
  if (!isFinite(n)) return 0
  return n / 1e18
}

function abbrevKey(pubkey: string): string {
  if (!pubkey || pubkey.length < 12) return pubkey
  return `${pubkey.slice(0, 8)}…${pubkey.slice(-6)}`
}

// ── Network ───────────────────────────────────────────────────────────────────

async function probeStatus(url: string): Promise<{ status: RelayStatus; latencyMs: number }> {
  const start = Date.now()
  try {
    const res = await fetch(`${url}/eth/v1/builder/status`, {
      cache: "no-store",
      signal: AbortSignal.timeout(4000),
    })
    return { status: res.status === 200 ? "online" : "offline", latencyMs: Date.now() - start }
  } catch {
    return { status: "offline", latencyMs: 0 }
  }
}

async function fetchPayloads(url: string): Promise<RelayPayload[]> {
  try {
    const res = await fetch(
      `${url}/relay/v1/data/bidtraces/proposer_payload_delivered?limit=50`,
      { cache: "no-store", signal: AbortSignal.timeout(5000) }
    )
    if (!res.ok) return []
    const data: unknown = await res.json()
    if (!Array.isArray(data)) return []
    return data as RelayPayload[]
  } catch {
    return []
  }
}

// ── Scoring ───────────────────────────────────────────────────────────────────

type RawEntry = {
  relay: RelayConfig
  probe: { status: RelayStatus; latencyMs: number }
  payloads: RelayPayload[]
  blocksWon: number
  totalValueEth: number
  avgBidEth: number
  latestBlock: number | null
}

function scoreEntries(entries: RawEntry[]): RelayResult[] {
  const byChain = new Map<ChainType, RawEntry[]>()
  for (const e of entries) {
    const list = byChain.get(e.relay.chain) ?? []
    list.push(e)
    byChain.set(e.relay.chain, list)
  }

  return entries.map((e) => {
    const peers = byChain.get(e.relay.chain) ?? []
    const online = peers.filter((p) => p.probe.status === "online")

    const latencyScore =
      e.probe.status === "offline" ? 0 : Math.max(0, 100 - e.probe.latencyMs / 8)

    const maxBlocks = Math.max(...online.map((p) => p.blocksWon), 1)
    const deliveryScore =
      e.probe.status === "offline" ? 0 : Math.round((e.blocksWon / maxBlocks) * 100)

    const maxBid = Math.max(...online.map((p) => p.avgBidEth), 1e-9)
    const valueScore =
      e.probe.status === "offline" ? 0 : Math.round((e.avgBidEth / maxBid) * 100)

    const uptimeScore = e.probe.status === "online" ? 100 : 0

    const overall = Math.round(
      uptimeScore * 0.4 + latencyScore * 0.3 + deliveryScore * 0.2 + valueScore * 0.1
    )

    const tier: ScoreTier =
      overall >= 80 ? "OPTIMAL" : overall >= 60 ? "GOOD" : overall >= 20 ? "DEGRADED" : "OFFLINE"

    return {
      name: e.relay.name,
      slug: e.relay.slug,
      url: e.relay.url,
      chain: e.relay.chain,
      status: e.probe.status,
      latencyMs: e.probe.latencyMs,
      blocksWon: e.blocksWon,
      totalValueEth: e.totalValueEth,
      avgBidEth: e.avgBidEth,
      latestBlock: e.latestBlock,
      score: { overall, latency: Math.round(latencyScore), delivery: deliveryScore, value: valueScore, tier },
    }
  })
}

// ── Builder tracking ──────────────────────────────────────────────────────────

function trackBuilders(
  pairs: Array<{ result: RelayResult; payloads: RelayPayload[] }>
): BuilderResult[] {
  const byChain = new Map<ChainType, Map<string, { blocks: number; value: number; relays: Set<string> }>>()

  for (const { result, payloads } of pairs) {
    let map = byChain.get(result.chain)
    if (!map) { map = new Map(); byChain.set(result.chain, map) }
    for (const p of payloads) {
      const b = map.get(p.builder_pubkey) ?? { blocks: 0, value: 0, relays: new Set() }
      b.blocks++
      b.value += weiToEth(p.value)
      b.relays.add(result.name)
      map.set(p.builder_pubkey, b)
    }
  }

  const out: BuilderResult[] = []
  for (const [chain, map] of byChain) {
    const total = Array.from(map.values()).reduce((s, b) => s + b.blocks, 0)
    for (const [pubkey, b] of map) {
      out.push({
        pubkey,
        shortKey: abbrevKey(pubkey),
        blocksWon: b.blocks,
        totalValueEth: b.value,
        avgBidEth: b.blocks > 0 ? b.value / b.blocks : 0,
        dominancePct: total > 0 ? (b.blocks / total) * 100 : 0,
        relaysUsed: Array.from(b.relays),
        chain,
      })
    }
  }
  return out.sort((a, b) => b.blocksWon - a.blocksWon)
}

// ── Intelligence feed ─────────────────────────────────────────────────────────

function buildFeed(relays: RelayResult[], builders: BuilderResult[]): IntelligenceEvent[] {
  const events: IntelligenceEvent[] = []
  const now = new Date().toISOString()

  for (const r of relays) {
    if (r.status === "offline") {
      events.push({ id: `${r.slug}-down`, type: "degraded", severity: "critical",
        message: `${r.name} is unreachable`, relay: r.name, chain: r.chain, timestamp: now })
    } else if (r.latencyMs > 600) {
      events.push({ id: `${r.slug}-lat`, type: "latency_spike", severity: "warning",
        message: `${r.name} latency elevated: ${r.latencyMs}ms`, relay: r.name, chain: r.chain, timestamp: now })
    }
  }

  const chains = new Set(builders.map((b) => b.chain))
  for (const chain of chains) {
    const top = builders.filter((b) => b.chain === chain)[0]
    if (top && top.dominancePct > 50) {
      events.push({ id: `conc-${chain}`, type: "concentration", severity: "warning",
        message: `Builder concentration on ${chain}: ${top.shortKey} at ${top.dominancePct.toFixed(1)}%`,
        chain, timestamp: now })
    }
  }

  if (builders.length > 0) {
    const top = builders[0]
    const avgBid = builders.reduce((s, b) => s + b.avgBidEth, 0) / builders.length
    if (top.avgBidEth > avgBid * 2.5) {
      events.push({ id: "high-val", type: "high_value", severity: "info",
        message: `High avg value: ${top.shortKey} averaging ${top.avgBidEth.toFixed(6)} ETH/block`,
        chain: top.chain, timestamp: now })
    }
  }

  if (events.length === 0) {
    events.push({ id: "nominal", type: "nominal", severity: "info",
      message: "All systems operating normally", timestamp: now })
  }

  const order: Record<EventSeverity, number> = { critical: 0, warning: 1, info: 2 }
  return events.sort((a, b) => order[a.severity] - order[b.severity]).slice(0, 20)
}

// ── Best relay selection ──────────────────────────────────────────────────────

function selectBest(relays: RelayResult[]): Partial<Record<ChainType, BestRelay>> {
  const result: Partial<Record<ChainType, BestRelay>> = {}
  const chains = new Set(relays.map((r) => r.chain))

  for (const chain of chains) {
    const candidates = relays.filter((r) => r.chain === chain && r.status === "online")
    if (candidates.length === 0) continue
    const best = candidates[0]
    const reasons: string[] = []
    if (best.score.latency >= 80) reasons.push(`Fast response (${best.latencyMs}ms)`)
    if (best.score.delivery >= 80) reasons.push("High delivery rate")
    if (best.score.value >= 80) reasons.push("Strong block value")
    if (reasons.length === 0) reasons.push("Best available on this chain")
    result[chain] = { relay: best, confidence: Math.min(98, best.score.overall + 5), reasons }
  }

  return result
}

// ── Main ──────────────────────────────────────────────────────────────────────

export async function fetchDashboardData(): Promise<DashboardData> {
  const raw = await Promise.all(
    RELAYS.map(async (relay) => {
      const [probe, payloads] = await Promise.all([probeStatus(relay.url), fetchPayloads(relay.url)])
      const totalValueEth = payloads.reduce((s, p) => s + weiToEth(p.value), 0)
      const blocksWon = payloads.length
      const avgBidEth = blocksWon > 0 ? totalValueEth / blocksWon : 0
      const latestBlock =
        blocksWon > 0 ? Math.max(...payloads.map((p) => parseInt(p.block_number, 10))) : null
      return { relay, probe, payloads, blocksWon, totalValueEth, avgBidEth, latestBlock }
    })
  )

  const relays = scoreEntries(raw).sort((a, b) => b.score.overall - a.score.overall)

  const pairs = raw.map((r) => ({
    result: relays.find((rel) => rel.slug === r.relay.slug)!,
    payloads: r.payloads,
  }))

  const builders = trackBuilders(pairs).slice(0, 20)

  const blockMap = new Map<string, RecentBlock>()
  for (const { result, payloads } of pairs) {
    for (const p of payloads) {
      const valueEth = weiToEth(p.value)
      const existing = blockMap.get(p.block_hash)
      if (!existing || valueEth > existing.valueEth) {
        blockMap.set(p.block_hash, { ...p, relayName: result.name, chain: result.chain, valueEth })
      }
    }
  }
  const recentBlocks = [...blockMap.values()]
    .sort((a, b) => parseInt(b.slot, 10) - parseInt(a.slot, 10))
    .slice(0, 30)

  const intelligenceFeed = buildFeed(relays, builders)
  const bestRelays = selectBest(relays)

  const online = relays.filter((r) => r.status === "online")
  const totalValueEth = recentBlocks.reduce((s, b) => s + b.valueEth, 0)
  const avgBidEth = recentBlocks.length > 0 ? totalValueEth / recentBlocks.length : 0
  const avgLatencyMs =
    online.length > 0 ? Math.round(online.reduce((s, r) => s + r.latencyMs, 0) / online.length) : 0
  const systemScore =
    relays.length > 0 ? Math.round(relays.reduce((s, r) => s + r.score.overall, 0) / relays.length) : 0

  return {
    relays,
    builders,
    intelligenceFeed,
    bestRelays,
    recentBlocks,
    totalUniqueBlocks: blockMap.size,
    totalValueEth,
    activeRelays: online.length,
    totalRelays: relays.length,
    avgBidEth,
    avgLatencyMs,
    systemScore,
    fetchedAt: new Date().toISOString(),
  }
}
