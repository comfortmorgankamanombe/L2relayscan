export const ETHEREUM_RELAYS = [
  {
    name: "Ultra Sound",
    slug: "ultra-sound",
    url: "https://relay.ultrasound.money",
    chain: "ethereum",
  },
  {
    name: "Titan Relay",
    slug: "titan",
    url: "https://titanrelay.xyz",
    chain: "ethereum",
  },
  {
    name: "BloXroute Max Profit",
    slug: "bloxroute-max",
    url: "https://bloxroute.max-profit.blxrbdn.com",
    chain: "ethereum",
  },
  {
    name: "Agnostic Gnosis",
    slug: "agnostic",
    url: "https://agnostic-relay.net",
    chain: "ethereum",
  },
  {
    name: "Aestus",
    slug: "aestus",
    url: "https://aestus.live",
    chain: "ethereum",
  },
  {
    name: "Pulselink",
    slug: "pulselink",
    url: "https://pulselinkrelay.org",
    chain: "ethereum",
  },
] as const

export const ARBITRUM_RELAYS = [
  {
    name: "Flashbots Relay",
    slug: "flashbots-arb",
    url: "https://relay.flashbots.net",
    chain: "arbitrum",
  },
  {
    name: "Titan Relay",
    slug: "titan-arb",
    url: "https://titanrelay.xyz",
    chain: "arbitrum",
  },
  {
    name: "Aestus",
    slug: "aestus-arb",
    url: "https://aestus.live",
    chain: "arbitrum",
  },
  {
    name: "Pulselink",
    slug: "pulselink-arb",
    url: "https://pulselinkrelay.org",
    chain: "arbitrum",
  },
] as const

export const RELAYS = [...ETHEREUM_RELAYS, ...ARBITRUM_RELAYS] as const

export type RelaySlug = (typeof RELAYS)[number]["slug"]
export type ChainType = "ethereum" | "arbitrum"
