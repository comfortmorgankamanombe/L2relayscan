export type ChainType = "ethereum" | "arbitrum" | "base" | "optimism"
export type EndpointType = "mev-relay" | "execution-endpoint"

export interface RelayConfig {
  name: string
  slug: string
  url: string
  chain: ChainType
  endpointType: EndpointType
}

export const ETHEREUM_RELAYS: RelayConfig[] = [
  { name: "Flashbots",            slug: "flashbots-eth",     url: "https://boost-relay.flashbots.net",        chain: "ethereum", endpointType: "mev-relay" },
  { name: "Ultra Sound",          slug: "ultrasound-eth",    url: "https://relay.ultrasound.money",           chain: "ethereum", endpointType: "mev-relay" },
  { name: "Titan",                slug: "titan-eth",         url: "https://titanrelay.xyz",                   chain: "ethereum", endpointType: "mev-relay" },
  { name: "Bloxroute Regulated",  slug: "bloxroute-reg-eth", url: "https://bloxroute.regulated.blxrbdn.com",  chain: "ethereum", endpointType: "mev-relay" },
  { name: "Bloxroute Max Profit", slug: "bloxroute-max-eth", url: "https://bloxroute.max-profit.blxrbdn.com", chain: "ethereum", endpointType: "mev-relay" },
  { name: "Aestus",               slug: "aestus-eth",        url: "https://mainnet.aestus.live",              chain: "ethereum", endpointType: "mev-relay" },
  { name: "Agnostic",             slug: "agnostic-eth",      url: "https://agnostic-relay.net",               chain: "ethereum", endpointType: "mev-relay" },
]

export const ARBITRUM_RELAYS: RelayConfig[] = [
  { name: "Aestus",    slug: "aestus-arb",    url: "https://aestus.live",        chain: "arbitrum", endpointType: "execution-endpoint" },
  { name: "Pulselink", slug: "pulselink-arb", url: "https://pulselinkrelay.org", chain: "arbitrum", endpointType: "execution-endpoint" },
]

export const RELAYS: RelayConfig[] = [...ETHEREUM_RELAYS, ...ARBITRUM_RELAYS]

export type RelaySlug = string
