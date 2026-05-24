import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { networkStats, relays, recentBlocks, type RelayStatus } from "@/lib/data";
import {
  Activity,
  Blocks,
  CircleDot,
  Clock,
  Cpu,
  Layers,
  TrendingUp,
  Wifi,
  WifiOff,
  AlertTriangle,
} from "lucide-react";

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
    );
  }
  if (status === "degraded") {
    return (
      <Badge className="bg-amber-500/15 text-amber-400 border-amber-500/30 gap-1.5 font-medium">
        <AlertTriangle className="h-3 w-3" />
        Degraded
      </Badge>
    );
  }
  return (
    <Badge className="bg-red-500/15 text-red-400 border-red-500/30 gap-1.5 font-medium">
      <WifiOff className="h-3 w-3" />
      Offline
    </Badge>
  );
}

function StatCard({
  title,
  value,
  sub,
  icon: Icon,
  accent,
}: {
  title: string;
  value: string;
  sub?: string;
  icon: React.ElementType;
  accent?: string;
}) {
  return (
    <Card className="border-border/50 bg-card/60 backdrop-blur-sm">
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <CardTitle className="text-sm font-medium text-muted-foreground">
          {title}
        </CardTitle>
        <div className={`p-2 rounded-md bg-primary/10 ${accent ?? ""}`}>
          <Icon className="h-4 w-4 text-primary" />
        </div>
      </CardHeader>
      <CardContent>
        <div className="text-2xl font-bold tracking-tight">{value}</div>
        {sub && (
          <p className="text-xs text-muted-foreground mt-1">{sub}</p>
        )}
      </CardContent>
    </Card>
  );
}

function GasBar({ used, limit }: { used: number; limit: number }) {
  const pct = Math.round((used / limit) * 100);
  const color =
    pct > 95 ? "bg-red-500" : pct > 80 ? "bg-amber-500" : "bg-primary";
  return (
    <div className="flex items-center gap-2 min-w-[80px]">
      <div className="flex-1 h-1.5 bg-muted rounded-full overflow-hidden">
        <div
          className={`h-full rounded-full ${color}`}
          style={{ width: `${pct}%` }}
        />
      </div>
      <span className="text-xs text-muted-foreground w-8 text-right">{pct}%</span>
    </div>
  );
}

export default function Dashboard() {
  const totalOnline = relays.filter((r) => r.status === "online").length;

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

          <div className="flex items-center gap-4 text-sm text-muted-foreground">
            <div className="flex items-center gap-1.5">
              <span className="relative flex h-2 w-2">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
                <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-400" />
              </span>
              <span className="text-emerald-400 font-medium text-xs">LIVE</span>
            </div>
            <Separator orientation="vertical" className="h-4 opacity-40" />
            <div className="flex items-center gap-1.5">
              <Blocks className="h-3.5 w-3.5" />
              <span>Block #{networkStats.latestBlock.toLocaleString()}</span>
            </div>
            <div className="flex items-center gap-1.5">
              <Clock className="h-3.5 w-3.5" />
              <span>Epoch {networkStats.epochNumber.toLocaleString()}</span>
            </div>
          </div>
        </div>
      </header>

      {/* Main */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-6 py-8 space-y-8">
        {/* Page title */}
        <div>
          <h1 className="text-2xl font-bold tracking-tight">
            MEV Relay Dashboard
          </h1>
          <p className="text-muted-foreground text-sm mt-1">
            Real-time relay performance and block data · Last 24 hours
          </p>
        </div>

        {/* Stat cards */}
        <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
          <StatCard
            title="Total Blocks (24h)"
            value={networkStats.totalBlocks.toLocaleString()}
            sub={`Epoch ${networkStats.epochNumber.toLocaleString()}`}
            icon={Blocks}
          />
          <StatCard
            title="Total Value Relayed"
            value={`${networkStats.totalValueEth.toFixed(2)} ETH`}
            sub="Across all active relays"
            icon={TrendingUp}
          />
          <StatCard
            title="Active Relays"
            value={`${totalOnline} / ${networkStats.totalRelays}`}
            sub={`${networkStats.totalRelays - totalOnline} offline or degraded`}
            icon={Wifi}
          />
          <StatCard
            title="Avg Winning Bid"
            value={`${networkStats.avgBidEth.toFixed(4)} ETH`}
            sub="Per block over 24h"
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

          {/* Relay Performance Table */}
          <TabsContent value="relays" className="mt-4">
            <Card className="border-border/50 bg-card/60">
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-base font-semibold">
                    Relay Performance
                  </CardTitle>
                  <span className="text-xs text-muted-foreground">
                    {relays.length} relays tracked
                  </span>
                </div>
              </CardHeader>
              <CardContent className="p-0">
                <Table>
                  <TableHeader>
                    <TableRow className="border-border/50 hover:bg-transparent">
                      <TableHead className="pl-6 text-xs font-medium text-muted-foreground">
                        Relay
                      </TableHead>
                      <TableHead className="text-xs font-medium text-muted-foreground">
                        Status
                      </TableHead>
                      <TableHead className="text-xs font-medium text-muted-foreground text-right">
                        Blocks Won
                      </TableHead>
                      <TableHead className="text-xs font-medium text-muted-foreground text-right">
                        Win Rate
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
                        Last Block
                      </TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {relays.map((relay) => (
                      <TableRow
                        key={relay.slug}
                        className="border-border/40 hover:bg-muted/30 transition-colors"
                      >
                        <TableCell className="pl-6 py-4">
                          <div>
                            <div className="font-medium text-sm">
                              {relay.name}
                            </div>
                            <div className="text-xs text-muted-foreground font-mono mt-0.5 truncate max-w-[200px]">
                              {relay.url}
                            </div>
                          </div>
                        </TableCell>
                        <TableCell>
                          <StatusBadge status={relay.status} />
                        </TableCell>
                        <TableCell className="text-right font-mono text-sm">
                          {relay.blocksWon.toLocaleString()}
                        </TableCell>
                        <TableCell className="text-right">
                          <div className="flex items-center justify-end gap-2">
                            <div className="w-16 h-1.5 bg-muted rounded-full overflow-hidden">
                              <div
                                className="h-full bg-primary rounded-full"
                                style={{ width: `${relay.winRate}%` }}
                              />
                            </div>
                            <span className="font-mono text-sm w-10 text-right">
                              {relay.winRate.toFixed(1)}%
                            </span>
                          </div>
                        </TableCell>
                        <TableCell className="text-right font-mono text-sm">
                          {relay.totalValueEth > 0
                            ? `${relay.totalValueEth.toFixed(2)} ETH`
                            : <span className="text-muted-foreground">—</span>}
                        </TableCell>
                        <TableCell className="text-right font-mono text-sm">
                          {relay.avgBidEth > 0
                            ? `${relay.avgBidEth.toFixed(4)}`
                            : <span className="text-muted-foreground">—</span>}
                        </TableCell>
                        <TableCell className="text-right">
                          {relay.latencyMs > 0 ? (
                            <span
                              className={`font-mono text-sm ${
                                relay.latencyMs > 200
                                  ? "text-amber-400"
                                  : relay.latencyMs > 100
                                  ? "text-yellow-400"
                                  : "text-emerald-400"
                              }`}
                            >
                              {relay.latencyMs}ms
                            </span>
                          ) : (
                            <span className="text-muted-foreground text-sm">—</span>
                          )}
                        </TableCell>
                        <TableCell className="pr-6 text-right font-mono text-sm text-muted-foreground">
                          {relay.lastBlock > 0
                            ? `#${relay.lastBlock.toLocaleString()}`
                            : "—"}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Recent Blocks Table */}
          <TabsContent value="blocks" className="mt-4">
            <Card className="border-border/50 bg-card/60">
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-base font-semibold">
                    Recent Blocks
                  </CardTitle>
                  <div className="flex items-center gap-1.5 text-xs text-emerald-400">
                    <CircleDot className="h-3 w-3 animate-pulse" />
                    Streaming
                  </div>
                </div>
              </CardHeader>
              <CardContent className="p-0">
                <Table>
                  <TableHeader>
                    <TableRow className="border-border/50 hover:bg-transparent">
                      <TableHead className="pl-6 text-xs font-medium text-muted-foreground">
                        Block
                      </TableHead>
                      <TableHead className="text-xs font-medium text-muted-foreground">
                        Relay
                      </TableHead>
                      <TableHead className="text-xs font-medium text-muted-foreground">
                        Builder
                      </TableHead>
                      <TableHead className="text-xs font-medium text-muted-foreground text-right">
                        Value
                      </TableHead>
                      <TableHead className="text-xs font-medium text-muted-foreground">
                        Gas Used
                      </TableHead>
                      <TableHead className="text-xs font-medium text-muted-foreground text-right">
                        Txns
                      </TableHead>
                      <TableHead className="pr-6 text-xs font-medium text-muted-foreground text-right">
                        Time
                      </TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {recentBlocks.map((block) => (
                      <TableRow
                        key={block.number}
                        className="border-border/40 hover:bg-muted/30 transition-colors"
                      >
                        <TableCell className="pl-6 py-3.5">
                          <span className="font-mono text-sm text-primary font-medium">
                            #{block.number.toLocaleString()}
                          </span>
                        </TableCell>
                        <TableCell>
                          <span className="text-sm font-medium">
                            {block.relay}
                          </span>
                        </TableCell>
                        <TableCell>
                          <span className="font-mono text-xs text-muted-foreground bg-muted/50 px-2 py-0.5 rounded">
                            {block.builderPubkey}
                          </span>
                        </TableCell>
                        <TableCell className="text-right">
                          <span className="font-mono text-sm font-medium text-primary">
                            {block.valueEth.toFixed(4)} ETH
                          </span>
                        </TableCell>
                        <TableCell>
                          <GasBar
                            used={block.gasUsed}
                            limit={block.gasLimit}
                          />
                        </TableCell>
                        <TableCell className="text-right font-mono text-sm">
                          {block.txCount}
                        </TableCell>
                        <TableCell className="pr-6 text-right text-xs text-muted-foreground">
                          {block.timestamp}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </main>

      {/* Footer */}
      <footer className="border-t border-border/50 mt-auto">
        <div className="max-w-7xl mx-auto px-6 py-4 flex items-center justify-between text-xs text-muted-foreground">
          <div className="flex items-center gap-1.5">
            <Cpu className="h-3.5 w-3.5" />
            <span>L2RelayScan · Base Mainnet MEV Relay Monitor</span>
          </div>
          <span>Data refreshes every 2s · Chain ID 8453</span>
        </div>
      </footer>
    </div>
  );
}
