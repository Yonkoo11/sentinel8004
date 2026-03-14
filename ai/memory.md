# Sentinel8004 - AI Memory

## What This Is
ERC-8004 agent trust scoring system for Celo hackathons (deadline March 18, 2026).

## On-Chain Facts (Verified March 11)
- IdentityRegistry: 0x8004A169FB4a3325136EB29fA0ceB6D2e539a432
- ReputationRegistry: 0x8004BAa17C55a88189AE136b182e5fdA19dE9b63
- ValidationRegistry: NOT deployed on Celo
- ~1,835 agents registered
- Massive Sybil: 0xbF0E... owns 500+ "babycaisubagent" agents
- Agent #2 (Arca): live, good metadata, 1 feedback client
- Agent #10 (CeloFX): 28 feedback clients but DEAD endpoint
- Agent #3: placeholder metadata ("YOUR_USER/YOUR_REPO")
- Self-feedback blocked by contract

## Architecture
4 scoring layers (0-25 each = 0-100 total):
- L1: Registration quality (metadata schema)
- L2: Endpoint liveness (HTTP probes)
- L3: On-chain behavior (wallet analysis via Blockscout)
- L4: Sybil/spam detection (owner concentration)

Scores written to ReputationRegistry via giveFeedback with tag1="agentguard", tag2="trust-v1".

## Key Decisions
- Use ReputationRegistry (not ValidationRegistry - not deployed)
- Deterministic scoring (no LLM in pipeline)
- Static dashboard on GitHub Pages
- MCP server for agent-to-agent queries
