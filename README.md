# Sentinel8004

Infrastructure-grade trust layer for ERC-8004 agents on Celo.

Sentinel8004 scans all 3,219 registered agents on Celo's IdentityRegistry, scores them across 5 deterministic layers with circuit breakers, and writes verifiable trust attestations to the ReputationRegistry on-chain with IPFS-pinned evidence reports. Any agent, dApp, or contract can query these scores to gate interactions without building their own trust evaluation.

**Live dashboard**: [yonkoo11.github.io/sentinel8004](https://yonkoo11.github.io/sentinel8004/)

**On-chain**: 3,200+ trust attestations on [ReputationRegistry](https://celoscan.io/address/0x8004BAa17C55a88189AE136b182e5fdA19dE9b63) (Celo mainnet). Sentinel8004 registered as agent [#1853](https://celoscan.io/tx/0x336764f2c9fd6d125ce57009b4fa04fa65d9794c36366b630b2a0108b0a0e47f).

## The Problem

Celo's IdentityRegistry has 3,219 registered agents and growing. No quality layer exists. What we found:

- **Sybil spam**: One address owns 991+ "babycaisubagent" clones with identical metadata
- **Reputation gaming**: 1,797 sock puppet wallets across 3 agents were inflating their scores through the ReputationRegistry. Toppa (#1870) had 431 puppets, Loopuman (#17) had 936, Agent #1865 had 437.
- **Dead endpoints**: Agents with 28+ feedback clients point to URLs that return nothing
- **Placeholder metadata**: Agents registered with "YOUR_USER/YOUR_REPO" templates
- **No trust signal**: Other agents and users have no way to evaluate quality before interacting
- **97.6% of agents flagged** with at least one circuit breaker. 88% score below 10.

## How It Works

```
 IdentityRegistry (all agents)
         |
         v
     [Scanner]  ---- enumerate all agents, parse metadata (5 formats)
         |
         v
     [5-Layer Scorer v2]
         |
         |-- L1: Registration Quality (0-20pts) -- metadata completeness, placeholder detection
         |-- L2: Endpoint Liveness (0-20pts)     -- HTTP probes, .well-known, generic domain filter
         |-- L3: On-Chain Behavior (0-20pts)     -- wallet age, tx history, approvals (Blockscout)
         |-- L4: Sybil/Spam Detection (0-25pts)  -- owner concentration, metadata similarity
         |-- L5: Existing Reputation (0-15pts)   -- on-chain feedback from ReputationRegistry
         |
         v
     [Circuit Breakers]  ---- MASS_REGISTRATION caps at 15, NO_METADATA caps at 20, etc.
         |
         v
     Composite Score (0-100) + Confidence (high/medium/low)
         |
         |-- [IPFS]  ---- pin full report (Filebase > Pinata > local CID fallback)
         |-- [ReputationRegistry]  ---- write score on-chain as feedback
         |-- [MCP Server]  ---- AI-queryable trust data (stdio)
         |-- [Dashboard]  ---- static HTML with search/filter/sort
```

## Scoring v2

### Layers

| Layer | What It Checks | Max | Weight | Gaming Cost |
|-------|---------------|-----|--------|-------------|
| Registration | Name, description, type, services, image, placeholders | 25 | 0.8x (20pts) | Free |
| Liveness | HTTP reachability, .well-known, generic domain filter | 25 | 0.8x (20pts) | ~$5/mo |
| On-Chain | Wallet age, tx count, approvals, activity, partners | 25 | 0.8x (20pts) | ~$10+ |
| Sybil | Owner concentration, Jaccard similarity, auto-naming | 25 | 1.0x (25pts) | High |
| Reputation | Existing on-chain feedback from other clients (with anti-Sybil filters) | 15 | 1.0x (15pts) | Low (~$5), mitigated |

### Circuit Breakers

Critical flags cap the maximum score regardless of other layers:

| Flag | Max Score | Reason |
|------|-----------|--------|
| MASS_REGISTRATION | 15 | 50+ agents from one address |
| NO_METADATA | 20 | No parseable metadata at all |
| METADATA_CLONE | 25 | >80% identical to sibling agent |
| NEGATIVE_REPUTATION | 30 | Net negative on-chain feedback |
| ALL_ENDPOINTS_DEAD | 35 | All declared endpoints unreachable |
| SYBIL_BOOSTED | 40 | L5 reputation inflated by sock puppet wallets (&lt;5 total txs) |

### Design Principles

- **No neutral inflation**: Missing data scores 0. Unknown is not positive.
- **Security layers weighted higher**: L4 (Sybil) and L5 (Reputation) carry full weight. L1 (metadata) weighted 0.8x because it's easy to game.
- **Confidence levels**: Each score carries high/medium/low confidence based on how many layers had real data.
- **Deterministic**: All checks are reproducible. No LLM in the scoring pipeline. The LLM interface is the MCP server.

### L5 Anti-Sybil Filters

Architecture audit discovered 1,797 sock puppet wallets gaming the ReputationRegistry. L5 now applies 3 filters:

1. **Self-exclusion**: Sentinel's own writer address excluded from client list
2. **Tx-count filter**: Providers with <5 total transactions filtered as sock puppets (checked via Blockscout)
3. **Uniformity detection**: If all scores from qualified providers are >90, flag as `SYBIL_BOOSTED` (cap at 40)

Result: Toppa's 431 puppets filtered, score dropped from 95 to 40. Loopuman's 936 puppets filtered. Zero false positives on legitimate agents.

### Known Limitations

We document these openly because trust scoring demands honesty:

- The first batch of 1,852 attestations used `tag1="agentguard"` (pre-rename) and has empty `feedbackURI` (IPFS rate limits during initial write). Subsequent writes include IPFS URIs with verifiable reports.
- Single-snapshot scoring; no longitudinal tracking yet
- L4 Sybil detection is address-based; multi-wallet Sybils using different addresses are not detected
- L2 probes check liveness, not functionality
- L5 depends on existing ReputationRegistry adoption (currently Sentinel is the only legitimate scorer)
- Pre-fix attestations for agents #1849/#1850 are immutable on-chain with slightly different scores (documented, not hidden)

## Setup

```bash
git clone https://github.com/yonkoo11/sentinel8004
cd sentinel8004
npm install
cp .env.example .env
# Edit .env with your keys
```

### Environment Variables

```
SENTINEL8004_PRIVATE_KEY=0x...    # Wallet for writing scores on-chain
FILEBASE_ACCESS_KEY=...          # Filebase S3 access key (primary IPFS provider)
FILEBASE_SECRET_KEY=...          # Filebase S3 secret key
PINATA_JWT=...                   # Pinata API JWT (fallback IPFS)
CELO_RPC_URL=https://forno.celo.org  # Optional, defaults to Celo mainnet
```

## Usage

### Scan agents

```bash
# Full 5-layer scan (first 100 agents)
npx tsx src/index.ts scan --max 100

# Smart mode: full layers for agents with metadata, L1+L4 for others
npx tsx src/index.ts scan --smart

# Fast mode: Layer 1 only (no network calls)
npx tsx src/index.ts scan --max 100 --layer1

# Skip specific layers
npx tsx src/index.ts scan --skip-liveness --skip-onchain --skip-reputation
```

### Write scores on-chain

```bash
# Dry run (no transactions)
npx tsx src/index.ts write --dry-run --skip-pinning

# Write to ReputationRegistry
npx tsx src/index.ts write
```

### Generate ecosystem report

```bash
npx tsx src/index.ts report
```

### MCP Server

```bash
npx tsx src/index.ts serve
```

Tools exposed:
- `check_agent_trust(agentId)` -- score, confidence, layer breakdown, circuit breakers, flags
- `list_flagged_agents(maxScore?, limit?)` -- agents below threshold
- `get_agent_report(agentId)` -- full JSON report

### Dashboard

```bash
npx tsx scripts/generate-dashboard.ts
open dashboard/index.html
```

### Trust Gate (consumer demo)

```bash
# Another agent checks if it's safe to interact with agent #132
npx tsx scripts/trust-gate.ts 132
# → SAFE to interact (57/100)

npx tsx scripts/trust-gate.ts 50
# → DO NOT INTERACT (11/100, MASS_REGISTRATION circuit breaker)
```

### Register Sentinel8004 as an agent

```bash
npx tsx scripts/register-agent.ts --dry-run
npx tsx scripts/register-agent.ts
```

## On-Chain Details

- **IdentityRegistry**: [`0x8004A169FB4a3325136EB29fA0ceB6D2e539a432`](https://celoscan.io/address/0x8004A169FB4a3325136EB29fA0ceB6D2e539a432)
- **ReputationRegistry**: [`0x8004BAa17C55a88189AE136b182e5fdA19dE9b63`](https://celoscan.io/address/0x8004BAa17C55a88189AE136b182e5fdA19dE9b63)
- **Chain**: Celo Mainnet (42220)
- **Feedback format**: `tag1="sentinel8004"`, `tag2="trust-v2"`, value = composite score (0-100). Note: the first 1,852 attestations used `tag1="agentguard"` (pre-rename, immutable on-chain).
- **Report hash**: keccak256 of full JSON report stored as `feedbackHash`

## Integration

Three ways to consume trust scores today:

**1. Direct contract call** (any on-chain agent or contract):
```solidity
// Read Sentinel8004's trust score for any agent
(, int256 score, , , ) = ReputationRegistry.readFeedback(agentId, sentinelIndex);
// score is 0-100, higher = more trustworthy
```

**2. MCP server** (AI-to-AI):
```bash
npx tsx src/index.ts serve
# Other AI agents call check_agent_trust(agentId) via MCP stdio protocol
```

**3. Trust gate script** (CLI consumer demo):
```bash
npx tsx scripts/trust-gate.ts 132  # → SAFE to interact (57/100)
npx tsx scripts/trust-gate.ts 50   # → DO NOT INTERACT (11/100, MASS_REGISTRATION)
```

## Results

- **3,219 agents scanned** across the full Celo IdentityRegistry
- **3,200+ trust attestations written on-chain** with IPFS-backed reports
- **1,797 sock puppet wallets discovered** gaming the ReputationRegistry across 3 agents
- **22 unit tests** (scorer, canonical JSON, Sybil detection) all passing
- **Top 5 agents**: AgentDashboard (85), CRIA (77), Celo GovAI Hub (75), Fixr (74), OG_Bot (72)

## Architecture Decisions

**Why ReputationRegistry, not ValidationRegistry?** ValidationRegistry is not deployed on Celo (spec says "still under active update with TEE community"). ReputationRegistry's `giveFeedback` is semantically correct for trust scoring.

**Why no LLM in scoring?** The 5 layers are deterministic checks. Adding LLM analysis would be theater. Scoring quality comes from check design and adversarial resistance, not from wrapping it in a language model.

**Why circuit breakers?** Without them, a Sybil farm with polished metadata could score 50+ ("fair"). Circuit breakers ensure a single strong negative signal dominates easy positive signals.

**Why weighted layers?** L1 (metadata) is free to game. L5 (reputation) requires convincing independent clients. Weighting reflects real adversarial cost.

**Why document limitations?** Trust systems that hide their weaknesses aren't trustworthy. We publish what each layer proves, what it doesn't prove, and how much it costs to fake.

**Why IPFS fallback chain?** Writing 3,200+ reports hit rate limits on every IPFS provider. The pipeline tries Filebase, then Pinata, then computes CIDs locally via `ipfs-only-hash` (identical CIDs without uploading). Reports are always available in `data/scan-results.json` and the `feedbackHash` on-chain matches regardless of pinning method.

## Tech Stack

- TypeScript (ES2022, NodeNext)
- [viem](https://viem.sh) -- chain interaction
- [p-limit](https://github.com/sindresorhus/p-limit) -- concurrency
- [@modelcontextprotocol/sdk](https://modelcontextprotocol.io) -- MCP server
- Custom CSS design system -- dashboard (dark mode, CSS custom properties)

## License

MIT
