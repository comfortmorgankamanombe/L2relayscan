export type RelayStatus = "online" | "degraded" | "offline";

export interface Relay {
  name: string;
  slug: string;
  url: string;
  status: RelayStatus;
  blocksWon: number;
  totalValueEth: number;
  avgBidEth: number;
  winRate: number;
  lastBlock: number;
  latencyMs: number;
}

export interface Block {
  number: number;
  relay: string;
  builderPubkey: string;
  valueEth: number;
  timestamp: string;
  gasUsed: number;
  gasLimit: number;
  txCount: number;
}

export const relays: Relay[] = [
  {
    name: "Flashbots",
    slug: "flashbots",
    url: "https://relay.flashbots.net",
    status: "online",
    blocksWon: 1247,
    totalValueEth: 142.83,
    avgBidEth: 0.1145,
    winRate: 38.2,
    lastBlock: 19824919,
    latencyMs: 42,
  },
  {
    name: "BloXroute Max Profit",
    slug: "bloxroute-max",
    url: "https://bloxroute.max-profit.blxrbdn.com",
    status: "online",
    blocksWon: 874,
    totalValueEth: 118.41,
    avgBidEth: 0.1355,
    winRate: 26.8,
    lastBlock: 19824916,
    latencyMs: 58,
  },
  {
    name: "Ultra Sound",
    slug: "ultra-sound",
    url: "https://relay.ultrasound.money",
    status: "online",
    blocksWon: 621,
    totalValueEth: 69.24,
    avgBidEth: 0.1115,
    winRate: 19.0,
    lastBlock: 19824911,
    latencyMs: 65,
  },
  {
    name: "Agnostic Gnosis",
    slug: "agnostic",
    url: "https://agnostic-relay.net",
    status: "online",
    blocksWon: 312,
    totalValueEth: 31.87,
    avgBidEth: 0.1022,
    winRate: 9.6,
    lastBlock: 19824907,
    latencyMs: 89,
  },
  {
    name: "Aestus",
    slug: "aestus",
    url: "https://mainnet.aestus.live",
    status: "degraded",
    blocksWon: 148,
    totalValueEth: 9.94,
    avgBidEth: 0.0672,
    winRate: 4.5,
    lastBlock: 19824843,
    latencyMs: 312,
  },
  {
    name: "BloXroute Regulated",
    slug: "bloxroute-reg",
    url: "https://bloxroute.regulated.blxrbdn.com",
    status: "offline",
    blocksWon: 0,
    totalValueEth: 0,
    avgBidEth: 0,
    winRate: 0,
    lastBlock: 0,
    latencyMs: 0,
  },
];

export const recentBlocks: Block[] = [
  {
    number: 19824919,
    relay: "Flashbots",
    builderPubkey: "0x95ac...f3a2",
    valueEth: 0.1382,
    timestamp: "2 sec ago",
    gasUsed: 29_847_210,
    gasLimit: 30_000_000,
    txCount: 187,
  },
  {
    number: 19824918,
    relay: "Flashbots",
    builderPubkey: "0x81be...c910",
    valueEth: 0.0994,
    timestamp: "4 sec ago",
    gasUsed: 27_123_440,
    gasLimit: 30_000_000,
    txCount: 164,
  },
  {
    number: 19824917,
    relay: "BloXroute Max Profit",
    builderPubkey: "0x72da...88f1",
    valueEth: 0.2104,
    timestamp: "6 sec ago",
    gasUsed: 29_991_880,
    gasLimit: 30_000_000,
    txCount: 201,
  },
  {
    number: 19824916,
    relay: "BloXroute Max Profit",
    builderPubkey: "0x3fc2...a47e",
    valueEth: 0.0871,
    timestamp: "8 sec ago",
    gasUsed: 22_480_100,
    gasLimit: 30_000_000,
    txCount: 143,
  },
  {
    number: 19824915,
    relay: "Ultra Sound",
    builderPubkey: "0x10aa...2b9c",
    valueEth: 0.1567,
    timestamp: "10 sec ago",
    gasUsed: 28_762_990,
    gasLimit: 30_000_000,
    txCount: 178,
  },
  {
    number: 19824914,
    relay: "Flashbots",
    builderPubkey: "0x95ac...f3a2",
    valueEth: 0.0632,
    timestamp: "12 sec ago",
    gasUsed: 18_340_220,
    gasLimit: 30_000_000,
    txCount: 112,
  },
  {
    number: 19824913,
    relay: "Ultra Sound",
    builderPubkey: "0x10aa...2b9c",
    valueEth: 0.1209,
    timestamp: "14 sec ago",
    gasUsed: 25_991_660,
    gasLimit: 30_000_000,
    txCount: 155,
  },
  {
    number: 19824912,
    relay: "Agnostic Gnosis",
    builderPubkey: "0xdd81...903b",
    valueEth: 0.0744,
    timestamp: "16 sec ago",
    gasUsed: 20_114_780,
    gasLimit: 30_000_000,
    txCount: 128,
  },
];

export const networkStats = {
  totalBlocks: 3261,
  totalValueEth: 374.29,
  activeRelays: relays.filter((r) => r.status === "online").length,
  totalRelays: relays.length,
  avgBidEth: 0.1147,
  latestBlock: 19824919,
  network: "Base Mainnet",
  chainId: 8453,
  epochNumber: 619_247,
};
