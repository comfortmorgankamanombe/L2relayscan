export type ChainType = "ethereum"
export type EndpointType = "mev-relay"

export interface RelayConfig {
  name: string
  slug: string
  url: string
}

export const RELAYS: RelayConfig[] = [
  { name: "Flashbots",            slug: "flashbots",     url: "https://boost-relay.flashbots.net"        },
  { name: "Ultra Sound",          slug: "ultrasound",    url: "https://relay.ultrasound.money"           },
  { name: "Titan",                slug: "titan",         url: "https://titanrelay.xyz"                   },
  { name: "Bloxroute Regulated",  slug: "bloxroute-reg", url: "https://bloxroute.regulated.blxrbdn.com"  },
  { name: "Bloxroute Max Profit", slug: "bloxroute-max", url: "https://bloxroute.max-profit.blxrbdn.com" },
  { name: "Aestus",               slug: "aestus",        url: "https://mainnet.aestus.live"              },
  { name: "Agnostic",             slug: "agnostic",      url: "https://agnostic-relay.net"               },
]

export type RelaySlug = string
