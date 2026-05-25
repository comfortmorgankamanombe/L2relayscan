"use client"

import { useState, useEffect } from "react"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Separator } from "@/components/ui/separator"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { type RelayStatus, type DashboardData } from "@/lib/fetch-relays"
import { RefreshButton } from "@/components/refresh-button"
import { LiveClock } from "@/components/live-clock"
import {
  Activity,
  AlertTriangle,
  Blocks,
  CircleDot,
  Clock,
  Cpu,
  Layers,
  TrendingUp,
  Wifi,
  WifiOff,
} from "lucide-react"

function StatusBadge({ status }: { status: RelayStatus }) {
  if (status === "online") {
    return (
      <Badge className="bg-emerald-500/15 text-emerald-400 border-emerald-500/30 gap-1.5 font-medium">
        <span className="relative flex h-1.5 w-1.5">
          <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
          <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-emerald-400" />
        </span>
        Online
      </Badge>
    )
  }
  return (
    <Badge className="bg-red-500/15 text-red-400 border-red-500/30 gap-1.5 font-medium">
      <WifiOff className="h-3 w-3" />
      Offline
    </Badge>
  )
}

function StatCard({
  title,
  value,
  sub,
  icon: Icon,
}: {
  title: string
  value: string
  sub?: string
  icon: React.ElementType
}) {
  return (
    <Card className="border-border/50 bg-card/60 backdrop-blur-sm">
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <CardTitle className="text-sm font-medium text-muted-foreground">
          {title}
        </CardTitle>
        <div className="p-2 rounded-md bg-primary/10">
          <Icon className="h-4 w-4 text-primary" />
        </div>
      </CardHeader>
      <CardContent>
        <div className="text-2xl font-bold tracking-tight">{value}</div>
        {sub && <p className="text-xs text-muted-foreground mt-1">{sub}</p>}
      </CardContent>
    </Card>
  )
}

function GasBar({ used, limit }: { used: number; limit: number }) {
  const pct = limit > 0 ? Math.round((used / limit) * 100) : 0
  const color =
    pct > 95 ? "bg-red-500" : pct > 80 ? "bg-amber-500" : "bg-primary"
  return (
    <div className="flex items-center gap-2 min-w-[80px]">
      <div className="flex-1 h-1.5 bg-muted rounded-full overflow-hidden">
        <div className={`h-full rounded-full ${color}`} style={{ width: `${pct}%` }} />
      </div>
      <span className="text-xs text-muted-foreground w-8 text-right">{pct}%</span>
    </div>
  )
}

function shortKey(pubkey: string): string {
  if (!pubkey || pubkey.length < 12) return pubkey
  return `${pubkey.slice(0, 6)}…${pubkey.slice(-4)}`
}


const defaultData: DashboardData = {
  ethereumRelays: [],
  arbitrumRelays: [],
  recentBlocks: [],
  totalUniqueBlocks: 0,
  totalValueEth: 0,
  activeRelays: 0,
  avgBidEth: 0,
  fetchedAt: new Date().toISOString(),
}

export default function Dashboard() {
  const [data, setData] = useState<DashboardData>(defaultData)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const fetchData = async () => {
    try {
      setLoading(true)
      setError(null)
      const response = await fetch("/api/relay-stats")
      if (!response.ok) throw new Error("Failed to fetch relay stats")
      const newData: DashboardData = await response.json()
      setData(newData)
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unknown error occurred")
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchData()
  }, [])

  const latestBlock = data.recentBlocks[0]?.block_number
    ? parseInt(data.recentBlocks[0].block_number, 10)
    : null

  const latestSlot = data.recentBlocks[0]?.slot
    ? parseInt(data.recentBlocks[0].slot, 10)
    : null

  const fetchedTime = new Date(data.fetchedAt).toLocaleTimeString("en-US", {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  })

  return (
    <div className="min-h-screen bg-background flex flex-col">
      {/* Header */}
      <header className="sticky top-0 z-50 border-b border-border/50 bg-background/80 backdrop-blur-md">
        <div className="max-w-7xl mx-auto px-6 h-14 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-2">
              <Layers className="h-5 w-5 text-primary" />
              <span className="font-bold text-lg tracking-tight">
                L2Relay<span className="text-primary">Scan</span>
              </span>
            </div>
            <Separator orientation="vertical" className="h-5 opacity-40" />
            <Badge className="bg-primary/15 text-primary border-primary/30 text-xs font-semibold px-2.5">
              Base Mainnet · Chain 8453
            </Badge>
          </div>

          <div className="flex items-center gap-3">
            <div className="hidden md:flex items-center gap-3 text-sm text-muted-foreground">
              <div className="flex items-center gap-1.5">
                <span className="relative flex h-2 w-2">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
                  <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-400" />
                </span>
                <span className="text-emerald-400 font-medium text-xs">LIVE</span>
              </div>
              <Separator orientation="vertical" className="h-4 opacity-40" />
              <LiveClock />
              <Separator orientation="vertical" className="h-4 opacity-40" />
              {latestBlock && (
                <div className="flex items-center gap-1.5 text-xs">
                  <Blocks className="h-3.5 w-3.5" />
                  <span>Block #{latestBlock.toLocaleString()}</span>
                </div>
              )}
              {latestSlot && (
                <div className="flex items-center gap-1.5 text-xs">
                  <Clock className="h-3.5 w-3.5" />
                  <span>Slot {latestSlot.toLocaleString()}</span>
                </div>
              )}
            </div>
            <Separator orientation="vertical" className="h-5 opacity-40 hidden md:block" />
            <a
              href="https://github.com/comfortmorgankamanombe/L2relayscan/issues/new?title=Add+Relay+Request&body=Relay+Name:%0AStatus+Endpoint:%0ANetwork+(Base/ETH/Arbitrum):%0AContact:"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1.5 rounded-md border border-primary/40 bg-primary/10 px-3 py-1.5 text-xs font-medium text-primary transition-colors hover:bg-primary/20 hover:border-primary/60"
            >
              + Submit Relay
            </a>
            <RefreshButton onRefresh={fetchData} />
          </div>
        </div>
      </header>

      {/* Main */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-6 py-8 space-y-8">
        {error && (
          <Card className="border-red-500/50 bg-red-500/10">
            <CardContent className="pt-6">
              <div className="flex items-center gap-3">
                <AlertTriangle className="h-5 w-5 text-red-400 flex-shrink-0" />
                <div className="flex-1">
                  <p className="text-sm font-medium text-red-400">Error fetching relay data</p>
                  <p className="text-xs text-red-400/70 mt-1">{error}</p>
                </div>
                <button
                  onClick={fetchData}
                  className="text-xs font-medium text-red-400 hover:text-red-300 px-3 py-1 rounded hover:bg-red-500/20 transition-colors"
                >
                  Retry
                </button>
              </div>
            </CardContent>
          </Card>
        )}

        {loading ? (
          <div className="flex items-center justify-center py-20">
            <div className="flex flex-col items-center gap-4">
              <div className="relative flex h-12 w-12">
                <div className="animate-spin absolute inline-flex h-full w-full rounded-full border-4 border-primary/30 border-t-primary" />
              </div>
              <p className="text-sm text-muted-foreground">Loading relay data from Frankfurt…</p>
            </div>
          </div>
        ) : (
          <>
        {/* Page title */}
        <div className="flex items-start justify-between">
          <div>
            <h1 className="text-2xl font-bold tracking-tight">MEV Relay Dashboard</h1>
            <p className="text-muted-foreground text-sm mt-1">
              Live relay status and recent payload data · Fetched at {fetchedTime}
            </p>
          </div>
          <div className="text-xs text-muted-foreground text-right hidden sm:block">
            <div className="flex items-center gap-1.5 text-amber-400/80">
              <AlertTriangle className="h-3 w-3" />
              <span>Most recent ~50 blocks per relay</span>
            </div>
          </div>
        </div>

        {/* Stat cards */}
        <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
          <StatCard
            title="Unique Blocks (Feed)"
            value={data.totalUniqueBlocks.toLocaleString()}
            sub="Deduplicated across all relays"
            icon={Blocks}
          />
          <StatCard
            title="Total Value in Feed"
            value={`${data.totalValueEth.toFixed(4)} ETH`}
            sub="From deduplicated block set"
            icon={TrendingUp}
          />
          <StatCard
            title="Active Relays"
            value={`${data.activeRelays} / ${data.ethereumRelays.length + data.arbitrumRelays.length}`}
            sub={`${data.ethereumRelays.length + data.arbitrumRelays.length - data.activeRelays} offline or unreachable`}
            icon={Wifi}
          />
          <StatCard
            title="Avg Block Bid"
            value={
              data.avgBidEth > 0
                ? `${data.avgBidEth.toFixed(6)} ETH`
                : "—"
            }
            sub="Across recent unique blocks"
            icon={Activity}
          />
        </div>

        {/* Tabs */}
        <Tabs defaultValue="relays">
          <TabsList className="bg-muted/50 border border-border/50">
            <TabsTrigger value="relays" className="gap-1.5">
              <Wifi className="h-3.5 w-3.5" />
              Relays
            </TabsTrigger>
            <TabsTrigger value="blocks" className="gap-1.5">
              <Blocks className="h-3.5 w-3.5" />
              Recent Blocks
            </TabsTrigger>
          </TabsList>

          {/* Relay Table */}
          <TabsContent value="relays" className="mt-4 space-y-6">
            {/* Ethereum Relays */}
            <Card className="border-border/50 bg-card/60">
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="text-base font-semibold">Ethereum Mainnet Relays</span>
                    <Badge className="bg-blue-500/15 text-blue-400 border-blue-500/30 text-xs">
                      Base, ETH
                    </Badge>
                  </div>
                  <span className="text-xs text-muted-foreground">
                    {data.ethereumRelays.length} relays · status live-checked
                  </span>
                </div>
              </CardHeader>
              <CardContent className="p-0">
                {data.ethereumRelays.length === 0 ? (
                  <div className="py-8 text-center text-muted-foreground text-sm">
                    No Ethereum relays configured
                  </div>
                ) : (
                  <Table>
                    <TableHeader>
                      <TableRow className="border-border/50 hover:bg-transparent">
                        <TableHead className="pl-6 text-xs font-medium text-muted-foreground">Relay</TableHead>
                        <TableHead className="text-xs font-medium text-muted-foreground">Status</TableHead>
                        <TableHead className="text-xs font-medium text-muted-foreground text-right">
                          Blocks in Feed
                        </TableHead>
                        <TableHead className="text-xs font-medium text-muted-foreground text-right">
                          Total Value
                        </TableHead>
                        <TableHead className="text-xs font-medium text-muted-foreground text-right">
                          Avg Bid
                        </TableHead>
                        <TableHead className="text-xs font-medium text-muted-foreground text-right">
                          Latency
                        </TableHead>
                        <TableHead className="pr-6 text-xs font-medium text-muted-foreground text-right">
                          Latest Block
                        </TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {data.ethereumRelays.map((relay) => (
                        <TableRow
                          key={relay.slug}
                          className="border-border/40 hover:bg-muted/30 transition-colors"
                        >
                          <TableCell className="pl-6 py-4">
                            <div>
                              <div className="font-medium text-sm">{relay.name}</div>
                              <div className="text-xs text-muted-foreground font-mono mt-0.5 truncate max-w-55">
                                {relay.url}
                              </div>
                            </div>
                          </TableCell>
                          <TableCell>
                            <StatusBadge status={relay.status} />
                          </TableCell>
                          <TableCell className="text-right font-mono text-sm">
                            {relay.blocksWon > 0 ? relay.blocksWon : (
                              <span className="text-muted-foreground">0</span>
                            )}
                          </TableCell>
                          <TableCell className="text-right font-mono text-sm">
                            {relay.totalValueEth > 0
                              ? `${relay.totalValueEth.toFixed(4)} ETH`
                              : <span className="text-muted-foreground">—</span>}
                          </TableCell>
                          <TableCell className="text-right font-mono text-sm">
                            {relay.avgBidEth > 0
                              ? relay.avgBidEth.toFixed(6)
                              : <span className="text-muted-foreground">—</span>}
                          </TableCell>
                          <TableCell className="text-right">
                            {relay.latencyMs > 0 ? (
                              <span
                                className={`font-mono text-sm ${
                                  relay.latencyMs > 500
                                    ? "text-red-400"
                                    : relay.latencyMs > 200
                                    ? "text-amber-400"
                                    : "text-emerald-400"
                                }`}
                              >
                                {relay.latencyMs}ms
                              </span>
                            ) : (
                              <span className="text-muted-foreground text-sm">timeout</span>
                            )}
                          </TableCell>
                          <TableCell className="pr-6 text-right font-mono text-sm text-muted-foreground">
                            {relay.latestBlock
                              ? `#${relay.latestBlock.toLocaleString()}`
                              : "—"}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                )}
              </CardContent>
            </Card>

            {/* Arbitrum Relays */}
            <Card className="border-border/50 bg-card/60">
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="text-base font-semibold">Arbitrum One Relays</span>
                    <Badge className="bg-purple-500/15 text-purple-400 border-purple-500/30 text-xs">
                      Chain 42161
                    </Badge>
                  </div>
                  <span className="text-xs text-muted-foreground">
                    {data.arbitrumRelays.length} relays · status live-checked
                  </span>
                </div>
              </CardHeader>
              <CardContent className="p-0">
                {data.arbitrumRelays.length === 0 ? (
                  <div className="py-8 text-center text-muted-foreground text-sm">
                    No Arbitrum relays configured
                  </div>
                ) : (
                  <Table>
                    <TableHeader>
                      <TableRow className="border-border/50 hover:bg-transparent">
                        <TableHead className="pl-6 text-xs font-medium text-muted-foreground">Relay</TableHead>
                        <TableHead className="text-xs font-medium text-muted-foreground">Status</TableHead>
                        <TableHead className="text-xs font-medium text-muted-foreground text-right">
                          Blocks in Feed
                        </TableHead>
                        <TableHead className="text-xs font-medium text-muted-foreground text-right">
                          Total Value
                        </TableHead>
                        <TableHead className="text-xs font-medium text-muted-foreground text-right">
                          Avg Bid
                        </TableHead>
                        <TableHead className="text-xs font-medium text-muted-foreground text-right">
                          Latency
                        </TableHead>
                        <TableHead className="pr-6 text-xs font-medium text-muted-foreground text-right">
                          Latest Block
                        </TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {data.arbitrumRelays.map((relay) => (
                        <TableRow
                          key={relay.slug}
                          className="border-border/40 hover:bg-muted/30 transition-colors"
                        >
                          <TableCell className="pl-6 py-4">
                            <div>
                              <div className="font-medium text-sm">{relay.name}</div>
                              <div className="text-xs text-muted-foreground font-mono mt-0.5 truncate max-w-55">
                                {relay.url}
                              </div>
                            </div>
                          </TableCell>
                          <TableCell>
                            <StatusBadge status={relay.status} />
                          </TableCell>
                          <TableCell className="text-right font-mono text-sm">
                            {relay.blocksWon > 0 ? relay.blocksWon : (
                              <span className="text-muted-foreground">0</span>
                            )}
                          </TableCell>
                          <TableCell className="text-right font-mono text-sm">
                            {relay.totalValueEth > 0
                              ? `${relay.totalValueEth.toFixed(4)} ETH`
                              : <span className="text-muted-foreground">—</span>}
                          </TableCell>
                          <TableCell className="text-right font-mono text-sm">
                            {relay.avgBidEth > 0
                              ? relay.avgBidEth.toFixed(6)
                              : <span className="text-muted-foreground">—</span>}
                          </TableCell>
                          <TableCell className="text-right">
                            {relay.latencyMs > 0 ? (
                              <span
                                className={`font-mono text-sm ${
                                  relay.latencyMs > 500
                                    ? "text-red-400"
                                    : relay.latencyMs > 200
                                    ? "text-amber-400"
                                    : "text-emerald-400"
                                }`}
                              >
                                {relay.latencyMs}ms
                              </span>
                            ) : (
                              <span className="text-muted-foreground text-sm">timeout</span>
                            )}
                          </TableCell>
                          <TableCell className="pr-6 text-right font-mono text-sm text-muted-foreground">
                            {relay.latestBlock
                              ? `#${relay.latestBlock.toLocaleString()}`
                              : "—"}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* Recent Blocks Table */}
          <TabsContent value="blocks" className="mt-4">
            <Card className="border-border/50 bg-card/60">
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-base font-semibold">Recent Blocks</CardTitle>
                  <div className="flex items-center gap-1.5 text-xs text-emerald-400">
                    <CircleDot className="h-3 w-3 animate-pulse" />
                    {data.recentBlocks.length} blocks · deduplicated
                  </div>
                </div>
              </CardHeader>
              <CardContent className="p-0">
                {data.recentBlocks.length === 0 ? (
                  <div className="py-16 text-center text-muted-foreground text-sm">
                    No block data available yet
                  </div>
                ) : (
                  <Table>
                    <TableHeader>
                      <TableRow className="border-border/50 hover:bg-transparent">
                        <TableHead className="pl-6 text-xs font-medium text-muted-foreground">Block</TableHead>
                        <TableHead className="text-xs font-medium text-muted-foreground">Chain</TableHead>
                        <TableHead className="text-xs font-medium text-muted-foreground">Relay</TableHead>
                        <TableHead className="text-xs font-medium text-muted-foreground">Builder</TableHead>
                        <TableHead className="text-xs font-medium text-muted-foreground text-right">Value</TableHead>
                        <TableHead className="text-xs font-medium text-muted-foreground">Gas Used</TableHead>
                        <TableHead className="text-xs font-medium text-muted-foreground text-right">Txns</TableHead>
                        <TableHead className="pr-6 text-xs font-medium text-muted-foreground text-right">Slot</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {data.recentBlocks.map((block) => (
                        <TableRow
                          key={block.block_hash}
                          className="border-border/40 hover:bg-muted/30 transition-colors"
                        >
                          <TableCell className="pl-6 py-3.5">
                            <span className="font-mono text-sm text-primary font-medium">
                              #{parseInt(block.block_number, 10).toLocaleString()}
                            </span>
                          </TableCell>
                          <TableCell>
                            <Badge className={`text-xs font-medium ${
                              block.chain === "ethereum"
                                ? "bg-blue-500/15 text-blue-400 border-blue-500/30"
                                : "bg-purple-500/15 text-purple-400 border-purple-500/30"
                            }`}>
                              {block.chain === "ethereum" ? "Ethereum" : "Arbitrum"}
                            </Badge>
                          </TableCell>
                          <TableCell>
                            <span className="text-sm font-medium">{block.relayName}</span>
                          </TableCell>
                          <TableCell>
                            <span className="font-mono text-xs text-muted-foreground bg-muted/50 px-2 py-0.5 rounded">
                              {shortKey(block.builder_pubkey)}
                            </span>
                          </TableCell>
                          <TableCell className="text-right">
                            <span className="font-mono text-sm font-medium text-primary">
                              {block.valueEth.toFixed(6)} ETH
                            </span>
                          </TableCell>
                          <TableCell>
                            <GasBar
                              used={parseInt(block.gas_used, 10)}
                              limit={parseInt(block.gas_limit, 10)}
                            />
                          </TableCell>
                          <TableCell className="text-right font-mono text-sm">
                            {block.num_tx}
                          </TableCell>
                          <TableCell className="pr-6 text-right text-xs text-muted-foreground font-mono">
                            {parseInt(block.slot, 10).toLocaleString()}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                )}
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
          </>
        )}
      </main>

      {/* Footer */}
      <footer className="border-t border-border/50 mt-auto">
        <div className="max-w-7xl mx-auto px-6 py-4 flex items-center justify-between text-xs text-muted-foreground">
          <div className="flex items-center gap-1.5">
            <Cpu className="h-3.5 w-3.5" />
            <span>L2RelayScan · MEV Relay Monitor</span>
          </div>
          <span>Data sourced directly from relay APIs · Flashbots excluded (API incompatible)</span>
        </div>
      </footer>
    </div>
  )
}
