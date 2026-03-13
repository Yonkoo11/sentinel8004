# AgentGuard

Autonomous trust scoring agent for the ERC-8004 AI Agent Registry on Celo.

AgentGuard scans every registered agent on Celo's IdentityRegistry, scores them across 5 independent layers with circuit breakers, and writes trust attestations to the ReputationRegistry on-chain. Results are exposed through an MCP server (AI-to-AI) and a static dashboard (humans).

**Live dashboard**: [yonkoo11.github.io/agentguard](https://yonkoo11.github.io/agentguard/)

**On-chain**: 1,838 trust attestations written to [ReputationRegistry](https://celoscan.io/address/0x8004BAa17C55a88189AE136b182e5fdA19dE9b63) on Celo mainnet.

## The Problem

Celo's IdentityRegistry has 1,838 registered agents. No quality layer exists. What we found:

- **Sybil spam**: One address owns 500+ "babycaisubagent" clones with identical metadata
- **Dead endpoints**: Agents with 28+ feedback clients point to URLs that return nothing
- **Placeholder metadata**: Agents registered with "YOUR_USER/YOUR_REPO" templates
- **No trust signal**: Other agents and users have no way to evaluate quality before interacting

## How It Works

```
 IdentityRegistry (1,838 agents)
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
         |-- [IPFS]  ---- pin full report via Pinata
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
| Reputation | Existing on-chain feedback from other clients | 15 | 1.0x (15pts) | Very High |

### Circuit Breakers

Critical flags cap the maximum score regardless of other layers:

| Flag | Max Score | Reason |
|------|-----------|--------|
| MASS_REGISTRATION | 15 | 50+ agents from one address |
| NO_METADATA | 20 | No parseable metadata at all |
| METADATA_CLONE | 25 | >80% identical to sibling agent |
| NEGATIVE_REPUTATION | 30 | Net negative on-chain feedback |
| ALL_ENDPOINTS_DEAD | 35 | All declared endpoints unreachable |

### Design Principles

- **No neutral inflation**: Missing data scores 0. Unknown is not positive.
- **Security layers weighted higher**: L4 (Sybil) and L5 (Reputation) carry full weight. L1 (metadata) weighted 0.8x because it's easy to game.
- **Confidence levels**: Each score carries high/medium/low confidence based on how many layers had real data.
- **Deterministic**: All checks are reproducible. No LLM in the scoring pipeline. The LLM interface is the MCP server.

### Known Limitations

We document these openly because trust scoring demands honesty:

- Single-snapshot scoring; no longitudinal tracking yet
- L4 Sybil detection is address-based; multi-wallet Sybils are not detected
- L2 probes check liveness, not functionality
- L5 depends on existing ReputationRegistry adoption (low right now)

## Setup

```bash
git clone https://github.com/yonkoo11/agentguard
cd agentguard
npm install
cp .env.example .env
# Edit .env with your keys
```

### Environment Variables

```
AGENTGUARD_PRIVATE_KEY=0x...    # Wallet for writing scores on-chain
PINATA_JWT=...                   # Pinata API JWT for IPFS pinning
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

### Register AgentGuard as an agent

```bash
npx tsx scripts/register-agent.ts --dry-run
npx tsx scripts/register-agent.ts
```

## On-Chain Details

- **IdentityRegistry**: [`0x8004A169FB4a3325136EB29fA0ceB6D2e539a432`](https://celoscan.io/address/0x8004A169FB4a3325136EB29fA0ceB6D2e539a432)
- **ReputationRegistry**: [`0x8004BAa17C55a88189AE136b182e5fdA19dE9b63`](https://celoscan.io/address/0x8004BAa17C55a88189AE136b182e5fdA19dE9b63)
- **Chain**: Celo Mainnet (42220)
- **Feedback format**: `tag1="agentguard"`, `tag2="trust-v2"`, value = composite score (0-100)
- **Report hash**: keccak256 of full JSON report stored as `feedbackHash`

## Architecture Decisions

**Why ReputationRegistry, not ValidationRegistry?** ValidationRegistry is not deployed on Celo (spec says "still under active update with TEE community"). ReputationRegistry's `giveFeedback` is semantically correct for trust scoring.

**Why no LLM in scoring?** The 5 layers are deterministic checks. Adding LLM analysis would be theater. Scoring quality comes from check design and adversarial resistance, not from wrapping it in a language model.

**Why circuit breakers?** Without them, a Sybil farm with polished metadata could score 50+ ("fair"). Circuit breakers ensure a single strong negative signal dominates easy positive signals.

**Why weighted layers?** L1 (metadata) is free to game. L5 (reputation) requires convincing independent clients. Weighting reflects real adversarial cost.

**Why document limitations?** Trust systems that hide their weaknesses aren't trustworthy. We publish what each layer proves, what it doesn't prove, and how much it costs to fake.

## Tech Stack

- TypeScript (ES2022, NodeNext)
- [viem](https://viem.sh) -- chain interaction
- [p-limit](https://github.com/sindresorhus/p-limit) -- concurrency
- [@modelcontextprotocol/sdk](https://modelcontextprotocol.io) -- MCP server
- Custom CSS design system -- dashboard (dark mode, CSS custom properties)

## License

MIT
