export const ARBITRUM_RELAYS = [
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
    name: "Flashbots Relay",
    slug: "flashbots-arb",
    url: "https://relay.flashbots.net",
    chain: "arbitrum",
  },
  {
    name: "Pulselink",
    slug: "pulselink-arb",
    url: "https://pulselinkrelay.org",
    chain: "arbitrum",
  },
] as const

export const RELAYS = ARBITRUM_RELAYS as const

export type RelaySlug = (typeof RELAYS)[number]["slug"]
export type ChainType = "ethereum" | "arbitrum"
