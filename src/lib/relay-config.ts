export type ChainType = "ethereum" | "arbitrum" | "base" | "optimism"

export interface RelayConfig {
  name: string
  slug: string
  url: string
  chain: ChainType
}

export const ETHEREUM_RELAYS: RelayConfig[] = [
  { name: "Flashbots",            slug: "flashbots-eth",     url: "https://boost-relay.flashbots.net",        chain: "ethereum" },
  { name: "Ultra Sound",          slug: "ultrasound-eth",    url: "https://relay.ultrasound.money",           chain: "ethereum" },
  { name: "Titan",                slug: "titan-eth",         url: "https://titanrelay.xyz",                   chain: "ethereum" },
  { name: "Bloxroute Regulated",  slug: "bloxroute-reg-eth", url: "https://bloxroute.regulated.blxrbdn.com",  chain: "ethereum" },
  { name: "Bloxroute Max Profit", slug: "bloxroute-max-eth", url: "https://bloxroute.max-profit.blxrbdn.com", chain: "ethereum" },
  { name: "Aestus",               slug: "aestus-eth",        url: "https://mainnet.aestus.live",              chain: "ethereum" },
  { name: "Agnostic",             slug: "agnostic-eth",      url: "https://agnostic-relay.net",               chain: "ethereum" },
]

export const ARBITRUM_RELAYS: RelayConfig[] = [
  { name: "Aestus",    slug: "aestus-arb",    url: "https://aestus.live",        chain: "arbitrum" },
  { name: "Pulselink", slug: "pulselink-arb", url: "https://pulselinkrelay.org", chain: "arbitrum" },
]

export const RELAYS: RelayConfig[] = [...ETHEREUM_RELAYS, ...ARBITRUM_RELAYS]

export type RelaySlug = string
