# MEVScan

Real-time Ethereum MEV relay infrastructure observability.

---

## Overview

MEVScan monitors MEV-Boost relay performance across Ethereum mainnet. It provides composite scoring, economic impact analysis, builder concentration tracking, and a live intelligence feed — giving infrastructure operators a continuous read on execution quality across the monitored relay set.

The platform is designed for validators, operators, and researchers who need operational visibility into relay health, latency divergence, block delivery rates, and builder market structure.

---

## Architecture

```
┌─────────────────────────────────────────────────────────┐
│  Next.js App Router                                     │
│                                                         │
│  src/app/page.tsx          ← Client dashboard           │
│  src/app/api/relay-stats/  ← API route (Node runtime)   │
│  src/lib/fetch-relays.ts   ← Core data fetching/scoring │
│  src/lib/relay-config.ts   ← Relay registry             │
└─────────────────────────────────────────────────────────┘
          │
          │  HTTP (parallel, per relay)
          ▼
┌─────────────────────────────────────────────────────────┐
│  MEV-Boost Relay APIs                                   │
│                                                         │
│  /eth/v1/builder/status              ← liveness probe   │
│  /relay/v1/data/bidtraces/           ← payload data     │
│    proposer_payload_delivered                           │
└─────────────────────────────────────────────────────────┘
```

All relay probes are performed server-side via the `/api/relay-stats` route on every request. The client polls every 5 seconds. Client-side history tracking (rolling 60-entry buffer, ~5 minutes at 5s intervals) enables delta event generation, trend detection, and per-relay state transitions without additional server state.

---

## Monitored Relays

MEV-Boost compatible relays that receive builder blocks and deliver them to Ethereum validators. All implement the MEV-Boost relay specification.

| Relay | Endpoint |
|---|---|
| Flashbots | boost-relay.flashbots.net |
| Ultra Sound | relay.ultrasound.money |
| Titan | titanrelay.xyz |
| Bloxroute Regulated | bloxroute.regulated.blxrbdn.com |
| Bloxroute Max Profit | bloxroute.max-profit.blxrbdn.com |
| Aestus | mainnet.aestus.live |
| Agnostic | agnostic-relay.net |

---

## Scoring Methodology

Each relay receives a composite score (0–100) computed from four weighted components:

| Component | Weight | Measurement |
|---|---|---|
| Uptime | 40% | Binary: online vs unreachable |
| Latency | 30% | Response time to liveness endpoint, normalized 0–100 |
| Delivery | 20% | Block delivery count relative to best peer |
| Value | 10% | Average bid ETH relative to best peer |

**Latency normalization:** `max(0, 100 - latencyMs / 8)` — a relay responding at 800ms scores 0; at 0ms it scores 100.

**Delivery and value scores** are peer-relative. The highest-performing relay scores 100; others are scaled proportionally. This makes the score a measure of relative execution quality, not absolute performance.

**Score tiers:**

| Tier | Score | Meaning |
|---|---|---|
| OPTIMAL | ≥80 | Full execution quality expected |
| GOOD | 60–79 | Minor variance within acceptable range |
| DEGRADED | 20–59 | Performance issues; validator yield may be reduced |
| OFFLINE | <20 | Unreachable or critically degraded |

---

## Intelligence Feed

The feed combines three event sources, merged and deduplicated in real time:

### 1. Server Events
Generated on each API call from live relay state:
- **critical** — relay unreachable, validator inclusion windows affected
- **warning** — response time elevation (>600ms), efficiency deterioration, builder concentration exceeding threshold (>50% dominance)
- **info** — elevated block values, system-wide composite score decline

### 2. Delta Events (client-side)
Computed by comparing the current snapshot against the prior one (5s ago):
- Relay recovery with computed downtime duration
- Score degradation (≥10pt drop) with persistence duration if sustained
- Score improvement (≥10pt gain)
- Response time divergence (≥80ms increase)

### 3. Simulation / Observational Events
Generated only when fewer than 3 real alert events exist, to keep the feed operationally relevant during quiet periods. These are observational and always `info` severity:
- Latency leader identification vs field average
- Execution quality divergence across the relay set
- Stability confirmation with duration
- Improving/declining composite trend over the observation window

All events are sorted by severity, capped at 20, and deduplicated by event ID. New events animate in on arrival.

---

## Economic Impact Model

Each relay's composite score maps to an estimated execution efficiency and validator yield impact:

```
efficiencyPct = min(100, 40 + (score / 100) * 60)
```

This yields 40% at score=0 and 100% at score=100, representing the estimated proportion of theoretical maximum execution quality being captured.

**Yield impact estimates (approximate):**

| Score | Estimated yield impact |
|---|---|
| ≥80 | None — optimal conditions |
| 60–79 | <7% reduction |
| 25–59 | 7–25% reduction |
| <25 or offline | 25%+ reduction |

**Efficiency labels:**

| Label | Score |
|---|---|
| HIGH EFFICIENCY | ≥80 |
| NORMAL | 60–79 |
| DEGRADED | 25–59 |
| HIGH RISK | <25 or offline |

These are operational estimates based on score degradation patterns, not on-chain measurement.

---

## API

### `GET /api/relay-stats`

Returns the full dashboard snapshot. No authentication or query parameters required.

**Response (abbreviated TypeScript types):**

```typescript
interface DashboardData {
  relays: RelayResult[]           // Scored, sorted by composite score desc
  builders: BuilderResult[]       // Sorted by blocks won desc
  intelligenceFeed: IntelligenceEvent[]
  bestRelay: BestRelay | undefined
  recentBlocks: RecentBlock[]
  totalUniqueBlocks: number
  activeRelays: number
  totalRelays: number
  avgLatencyMs: number
  overallEfficiencyPct: number
  fetchedAt: string               // ISO 8601
}
```

**Cache policy:** `no-store` on every request.  
**Runtime:** Node.js (not Edge) — required for parallel fetch with `AbortSignal.timeout`.

---

## Client-Side History Tracking

The dashboard maintains a rolling 60-entry ring buffer of `DashboardData` snapshots in a React `useRef`. This powers:

- **Per-relay transition labels**: RECOVERING↑, IMPROVING↑, UNDER LOAD↓, DETERIORATING↓
- **Delta events**: compare current vs previous snapshot for changes worth surfacing
- **Competitive stats strip**: latency leader, biggest mover, stability leader, best performer over observation window
- **Trend-based simulation events**: improving/declining composite avg over the window

The buffer lives only in the browser. No server state, no persistence across page loads.

---

## Local Development

```bash
npm install
npm run dev
```

Dashboard at `http://localhost:3000`. No environment variables required — all relay endpoints are public APIs.

## Production Deployment

The project deploys to Vercel via GitHub integration. Push to `main` triggers automatic deployment.

```bash
# Manual deploy
npx vercel --prod
```

**Build command:** `next build`  
**Node.js version:** ≥18

---

## Roadmap

- Historical relay performance persistence for multi-hour trend views
- Webhook/notification support for critical relay events
- Named builder identity resolution from known pubkey registry
- Latency percentile tracking (p50/p95/p99) per relay
- API authentication for institutional operator access
