export const RELAYS = [
  {
    name: "Ultra Sound",
    slug: "ultra-sound",
    url: "https://relay.ultrasound.money",
  },
  {
    name: "Titan Relay",
    slug: "titan",
    url: "https://titanrelay.xyz",
  },
  {
    name: "BloXroute Max Profit",
    slug: "bloxroute-max",
    url: "https://bloxroute.max-profit.blxrbdn.com",
  },
  {
    name: "Agnostic Gnosis",
    slug: "agnostic",
    url: "https://agnostic-relay.net",
  },
  {
    name: "Aestus",
    slug: "aestus",
    url: "https://aestus.live",
  },
  {
    name: "Pulselink",
    slug: "pulselink",
    url: "https://pulselinkrelay.org",
  },
] as const

export type RelaySlug = (typeof RELAYS)[number]["slug"]
