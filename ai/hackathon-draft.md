# Sentinel8004 - Hackathon Submission Draft

## Project Name
Sentinel8004

## Tagline
Infrastructure-grade trust layer for ERC-8004 agents on Celo

## Description
Sentinel8004 is a trust infrastructure primitive for Celo's ERC-8004 ecosystem. It scans all 2,900+ registered agents, scores them across 5 deterministic layers with circuit breakers, and writes verifiable trust attestations to the ReputationRegistry on-chain. Any agent, dApp, or contract on Celo can query these scores to gate interactions without building their own trust evaluation.

What Celo gains: a composable trust layer that makes the IdentityRegistry usable. Before Sentinel, there was no way to distinguish legitimate agents from the 50%+ spam. Now any builder can call `getFeedback(agentId)` and get an auditable trust score backed by IPFS-pinned evidence.

## What problem does it solve?
The Celo IdentityRegistry has zero quality layer. We found:
- One address owns 500+ "babycaisubagent" clones (mass Sybil spam)
- Agents with 28+ feedback clients pointing to dead endpoints
- Placeholder metadata ("YOUR_USER/YOUR_REPO") on registered agents
- No way for users or agents to evaluate agent quality before interaction

## How it works
1. Scanner enumerates all agents from IdentityRegistry, parses 5 metadata formats (gzip-base64, base64, IPFS, HTTP, raw JSON)
2. 5-layer scorer produces a 0-100 composite trust score:
   - L1 Registration Quality (0-20pts): metadata completeness, placeholder detection
   - L2 Endpoint Liveness (0-20pts): HTTP probes, .well-known verification
   - L3 On-Chain Behavior (0-20pts): wallet age, tx history, approvals via Blockscout
   - L4 Sybil/Spam Detection (0-25pts): owner concentration, metadata Jaccard similarity, auto-naming patterns
   - L5 Existing Reputation (0-15pts): on-chain feedback from other ReputationRegistry clients
3. Circuit breakers cap scores when critical flags fire:
   - MASS_REGISTRATION → max 15 (50+ agents from one address)
   - NO_METADATA → max 20 (no parseable metadata)
   - METADATA_CLONE → max 25 (>80% identical to sibling)
   - ALL_ENDPOINTS_DEAD → max 35 (all endpoints unreachable)
   - NEGATIVE_REPUTATION → max 30 (net negative feedback)
4. Scores written to ReputationRegistry as on-chain attestations (tag1="sentinel8004", tag2="trust-v2"; the first 1,852 batch used tag1="agentguard" before the project rename)
5. MCP server exposes 3 tools for AI-to-AI queries:
   - `check_agent_trust(agentId)` — score, confidence, layer breakdown, flags
   - `list_flagged_agents(maxScore?, limit?)` — agents below threshold
   - `get_agent_report(agentId)` — full JSON report
6. Static dashboard for human inspection with search, sort, and agent detail views

## Results
- **2,900+ agents scanned and scored** across the full Celo IdentityRegistry
- **1,857+ trust attestations written on-chain** to ReputationRegistry (self-feedback blocked by contract for our own agent #1853)
- 3 attestations with full IPFS reports (agents #1856, #1857, #1858), proving end-to-end pipeline
- Circuit breakers correctly cap spam clusters at 15/100 regardless of metadata quality
- Sentinel8004 registered as agent #1853 ([TX](https://celoscan.io/tx/0x336764f2c9fd6d125ce57009b4fa04fa65d9794c36366b630b2a0108b0a0e47f))

## Known Limitations
We document these openly because trust scoring demands honesty:
- Single-snapshot scoring; no longitudinal tracking yet
- L4 Sybil detection is address-based; multi-wallet Sybils are not detected
- L2 probes check liveness, not functionality
- L5 depends on existing ReputationRegistry adoption (low right now)
- First 1,852 attestations written without feedbackURI (IPFS provider hit rate limits during initial batch write). IPFS pipeline restored; agents #1856-#1858 written with pinned IPFS reports.
- Self-scoring blocked by contract design: ReputationRegistry prevents an agent owner from writing feedback for their own agent. This is correct behavior (prevents gaming), so Sentinel8004 #1853 appears in the dashboard but has no on-chain attestation from itself

## Tracks
- Build Agents for the Real World V2: Best Agent on Celo, Best Agent Infra
- The Synthesis: Best Agent on Celo, Agents With Receipts (ERC-8004), Synthesis Open Track

## Integration Surfaces
Three ways to consume trust scores today:
1. **Direct contract call:** `getFeedback(agentId)` on ReputationRegistry returns score, tags, and IPFS URI
2. **MCP server:** AI agents can call `check_agent_trust(agentId)` via stdio for score + flags + confidence
3. **Static JSON:** `scores.json` on GitHub Pages for lightweight dashboard-style reads

## Links
- GitHub: https://github.com/Yonkoo11/sentinel8004
- Dashboard: https://yonkoo11.github.io/sentinel8004/
- Contract (ReputationRegistry): https://celoscan.io/address/0x8004BAa17C55a88189AE136b182e5fdA19dE9b63

## Tech Stack
TypeScript, viem, p-limit, @modelcontextprotocol/sdk

## What makes this different
- **Infrastructure, not a demo:** Scores are on-chain and queryable by any contract or agent today. Not a prototype; a composable primitive.
- **Deterministic scoring:** No LLM in the pipeline. Same input, same output. Other systems can depend on this.
- **Real data, real problems found:** 50%+ of agents are spam. One address owns 991 clones. Dead endpoints everywhere.
- **Standard interface:** Uses the existing ReputationRegistry contract. Zero new contracts to deploy for consumers.
- **Circuit breakers:** A mass registrar cannot game the score with good metadata. Critical for downstream trust decisions.
- **Honest about limits:** Documents what it can and cannot detect. Trust infrastructure requires transparency.
