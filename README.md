# AgentGuard

Autonomous trust scoring agent for the ERC-8004 AI Agent Registry on Celo.

AgentGuard scans every registered agent on Celo's IdentityRegistry, scores them across 4 independent layers, and writes trust attestations to the ReputationRegistry on-chain. It exposes results through an MCP server (for AI-to-AI queries) and a static dashboard (for humans).

## The Problem

Celo's IdentityRegistry has 1,835+ registered agents. No quality layer exists. What we found:

- **Sybil spam**: One address owns 500+ "babycaisubagent" clones with identical metadata
- **Dead endpoints**: Agents with 28+ feedback clients point to URLs that return nothing
- **Placeholder metadata**: Agents registered with "YOUR_USER/YOUR_REPO" templates
- **No trust signal**: Other agents and users have no way to evaluate agent quality before interacting

## How It Works

```
IdentityRegistry (1,835 agents)
        |
        v
    [Scanner]  ──── enumerate all agents, parse metadata (5 formats)
        |
        v
    [4-Layer Scorer]
        |
        ├── L1: Registration Quality (0-25)  — metadata completeness, placeholder detection
        ├── L2: Endpoint Liveness (0-25)     — HTTP probes, .well-known verification
        ├── L3: On-Chain Behavior (0-25)     — wallet age, tx history, approvals (Blockscout)
        └── L4: Sybil/Spam Detection (0-25)  — owner concentration, metadata similarity, naming patterns
        |
        v
    Composite Score (0-100)
        |
        ├── [IPFS]  ──── pin full report via Pinata
        ├── [ReputationRegistry]  ──── write score on-chain as feedback
        ├── [MCP Server]  ──── AI-queryable trust data (stdio)
        └── [Dashboard]  ──── static HTML with search/filter/sort
```

## Scoring

Each agent gets a composite score from 0 to 100 across 4 equally-weighted layers:

| Layer | What It Checks | Max |
|-------|---------------|-----|
| Registration | Name, description, type, services, image, placeholder patterns | 25 |
| Liveness | HTTP endpoint reachability, .well-known domain verification | 25 |
| On-Chain | Wallet age, tx count, approvals, activity recency, partner diversity | 25 |
| Sybil | Owner agent count, metadata Jaccard similarity, automated naming | 25 |

No LLM in the scoring pipeline. All checks are deterministic. The LLM interface is the MCP server for querying results conversationally.

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
# Full 4-layer scan (first 100 agents)
npx tsx src/index.ts scan --max 100

# Fast mode: Layer 1 only (no network calls)
npx tsx src/index.ts scan --max 100 --layer1

# Skip specific layers
npx tsx src/index.ts scan --max 100 --skip-liveness --skip-onchain

# Full registry scan
npx tsx src/index.ts scan
```

### Write scores on-chain

```bash
# Dry run (no transactions)
npx tsx src/index.ts write --dry-run --skip-pinning

# Write to ReputationRegistry
npx tsx src/index.ts write

# Skip IPFS pinning (empty feedbackURI)
npx tsx src/index.ts write --skip-pinning
```

### MCP Server

```bash
npx tsx src/index.ts serve
```

Tools exposed:
- `check_agent_trust(agentId)` -- score, layer breakdown, flags
- `list_flagged_agents(maxScore?, limit?)` -- agents below threshold
- `get_agent_report(agentId)` -- full JSON report

### Dashboard

```bash
# Generate dashboard data from latest scan
npx tsx scripts/generate-dashboard.ts

# Open dashboard
open dashboard/index.html
```

### Register AgentGuard as an agent

```bash
# Preview metadata
npx tsx scripts/register-agent.ts --dry-run

# Register on-chain
npx tsx scripts/register-agent.ts
```

## On-Chain Details

- **IdentityRegistry**: `0x8004A169FB4a3325136EB29fA0ceB6D2e539a432` (ERC-721)
- **ReputationRegistry**: `0x8004BAa17C55a88189AE136b182e5fdA19dE9b63`
- **Chain**: Celo Mainnet (42220)
- **Feedback format**: `tag1="agentguard"`, `tag2="trust-v1"`, value = composite score (0-100)
- **Report hash**: keccak256 of full JSON report stored as `feedbackHash`

## Architecture Decisions

**Why ReputationRegistry, not ValidationRegistry?** ValidationRegistry is not deployed on Celo (spec says "still under active update with TEE community"). ReputationRegistry's `giveFeedback` is semantically correct for trust scoring.

**Why no LLM in scoring?** The 4 layers are deterministic checks. Adding LLM analysis would be theater. The scoring quality comes from check design, not from wrapping it in a language model. The MCP server provides the AI conversational interface.

**Why static dashboard?** Zero deployment complexity. GitHub Pages is free. The scanner outputs JSON, the dashboard reads it. No server to keep running.

**Why sequential on-chain writes?** Parallel writes require manual nonce management and can fail. 1,835 sequential writes at ~0.5s each = ~15 minutes. Acceptable.

## Sample Output

```
=== Full 4-Layer Scoring ===
[1/50] #1 "Arron C." → 72/100 (1 flags)
[2/50] #2 "Arca" → 93/100
[3/50] #48 "babycaisubagent-5116" → 27/100 (3 flags)
[4/50] #50 "babycaisubagent-1007" → 24/100 (3 flags)

Flag summary:
  OWNER_CONCENTRATION: 30
  NO_METADATA: 25
  AUTO_NAMING: 3
  DEAD_ENDPOINT: 3
```

## Tech Stack

- TypeScript (ES2022, NodeNext)
- [viem](https://viem.sh) for chain interaction
- [p-limit](https://github.com/sindresorhus/p-limit) for concurrency
- [@modelcontextprotocol/sdk](https://modelcontextprotocol.io) for MCP server
- Tailwind CSS (CDN) for dashboard

## License

MIT
