import { RELAYS, type ChainType } from "./relay-config"

export type RelayStatus = "online" | "offline"

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
  chain_id?: string
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
}

export interface RecentBlock extends RelayPayload {
  relayName: string
  chain: ChainType
  valueEth: number
}

export interface DashboardData {
  ethereumRelays: RelayResult[]
  arbitrumRelays: RelayResult[]
  recentBlocks: RecentBlock[]
  totalUniqueBlocks: number
  totalValueEth: number
  activeRelays: number
  avgBidEth: number
  fetchedAt: string
}

function weiToEth(wei: string): number {
  const n = parseFloat(wei)
  if (!isFinite(n)) return 0
  return n / 1e18
}

async function probeStatus(url: string, chain: ChainType): Promise<{ status: RelayStatus; latencyMs: number }> {
  const start = Date.now()
  try {
    const res = await fetch(`${url}/eth/v1/builder/status`, {
      cache: "no-store",
      signal: AbortSignal.timeout(8000),
    })
    return {
      status: res.status === 200 ? "online" : "offline",
      latencyMs: Date.now() - start,
    }
  } catch {
    return { status: "offline", latencyMs: 0 }
  }
}

async function fetchPayloads(url: string, chain: ChainType): Promise<RelayPayload[]> {
  try {
    const res = await fetch(
      `${url}/relay/v1/data/bidtraces/proposer_payload_delivered?limit=50`,
      { cache: "no-store", signal: AbortSignal.timeout(10000) }
    )
    if (!res.ok) return []
    const data: unknown = await res.json()
    if (!Array.isArray(data)) return []
    
    const payloads = data as RelayPayload[]
    
    // For Arbitrum, filter by chain_id 42161
    if (chain === "arbitrum") {
      return payloads.filter(p => p.chain_id === "42161" || p.chain_id === 42161)
    }
    
    // For Ethereum, include only if chain_id is not Arbitrum (or chain_id not specified)
    return payloads.filter(p => !p.chain_id || (p.chain_id !== "42161" && p.chain_id !== 42161))
  } catch {
    return []
  }
}

export async function fetchDashboardData(): Promise<DashboardData> {
  const relayResults = await Promise.all(
    RELAYS.map(async (relay) => {
      const [probe, payloads] = await Promise.all([
        probeStatus(relay.url, relay.chain),
        fetchPayloads(relay.url, relay.chain),
      ])

      const totalValueEth = payloads.reduce((sum, p) => sum + weiToEth(p.value), 0)
      const blocksWon = payloads.length
      const avgBidEth = blocksWon > 0 ? totalValueEth / blocksWon : 0
      const latestBlock =
        blocksWon > 0
          ? Math.max(...payloads.map((p) => parseInt(p.block_number, 10)))
          : null

      return {
        relay,
        probe,
        payloads,
        result: {
          name: relay.name,
          slug: relay.slug,
          url: relay.url,
          chain: relay.chain,
          status: probe.status,
          latencyMs: probe.latencyMs,
          blocksWon,
          totalValueEth,
          avgBidEth,
          latestBlock,
        } satisfies RelayResult,
      }
    })
  )

  // Deduplicate blocks across relays by block_hash, prefer highest-value entry
  const blockMap = new Map<string, RecentBlock>()
  for (const { relay, payloads } of relayResults) {
    for (const p of payloads) {
      const existing = blockMap.get(p.block_hash)
      const valueEth = weiToEth(p.value)
      if (!existing || valueEth > existing.valueEth) {
        blockMap.set(p.block_hash, { ...p, relayName: relay.name, chain: relay.chain, valueEth })
      }
    }
  }

  const recentBlocks = [...blockMap.values()]
    .sort((a, b) => parseInt(b.slot, 10) - parseInt(a.slot, 10))
    .slice(0, 20)

  const totalUniqueBlocks = blockMap.size
  const totalValueEth = recentBlocks.reduce((sum, b) => sum + b.valueEth, 0)
  const avgBidEth = recentBlocks.length > 0 ? totalValueEth / recentBlocks.length : 0

  const allResults = relayResults
    .map((r) => r.result)
    .sort((a, b) => b.blocksWon - a.blocksWon)

  const ethereumRelays = allResults.filter((r) => r.chain === "ethereum")
  const arbitrumRelays = allResults.filter((r) => r.chain === "arbitrum")
  const activeRelays = allResults.filter((r) => r.status === "online").length

  return {
    ethereumRelays,
    arbitrumRelays,
    recentBlocks,
    totalUniqueBlocks,
    totalValueEth,
    activeRelays,
    avgBidEth,
    fetchedAt: new Date().toISOString(),
  }
}
