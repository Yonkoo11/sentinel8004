# AgentGuard - Hackathon Submission Draft

## Project Name
AgentGuard

## Tagline
Autonomous ERC-8004 trust scoring agent for Celo

## Description
AgentGuard scans all 1,853 agents registered on Celo's ERC-8004 IdentityRegistry, scores them across 5 independent layers with circuit breakers, and writes trust attestations to the ReputationRegistry on-chain. It exposes results via MCP (for AI agents) and a static dashboard (for humans). AgentGuard is itself registered as agent #1853 on the IdentityRegistry.

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
4. Scores written to ReputationRegistry as on-chain attestations (tag1="agentguard", tag2="trust-v2")
5. MCP server exposes 3 tools for AI-to-AI queries:
   - `check_agent_trust(agentId)` — score, confidence, layer breakdown, flags
   - `list_flagged_agents(maxScore?, limit?)` — agents below threshold
   - `get_agent_report(agentId)` — full JSON report
6. Static dashboard for human inspection with search, sort, and agent detail views

## Results
- **1,853 agents scanned and scored**
- **1,852 trust attestations written on-chain** to ReputationRegistry (1 excluded: self-feedback blocked by contract for our own agent #1853)
- **6 agents scored 70+** after rescanning newly registered agents
- Top agent: AgentDashboard (Motus) at 85/100; our own AgentGuard #1853 scored 75/100
- 88% of agents score below 10 (Sybil spam clusters)
- AgentGuard registered as agent #1853 ([TX](https://celoscan.io/tx/0x336764f2c9fd6d125ce57009b4fa04fa65d9794c36366b630b2a0108b0a0e47f))

## Known Limitations
We document these openly because trust scoring demands honesty:
- Single-snapshot scoring; no longitudinal tracking yet
- L4 Sybil detection is address-based; multi-wallet Sybils are not detected
- L2 probes check liveness, not functionality
- L5 depends on existing ReputationRegistry adoption (low right now)
- IPFS report pinning currently unavailable (Pinata plan limit); scores written without feedbackURI
- Self-scoring blocked by contract design: ReputationRegistry prevents an agent owner from writing feedback for their own agent. This is correct behavior (prevents gaming), so AgentGuard #1853 appears in the dashboard but has no on-chain attestation from itself

## Tracks
- Build Agents for the Real World V2: Best Agent on Celo, Best Agent Infra
- The Synthesis: Trust Systems track

## Links
- GitHub: https://github.com/Yonkoo11/agentguard
- Dashboard: https://yonkoo11.github.io/agentguard/
- Contract (ReputationRegistry): https://celoscan.io/address/0x8004BAa17C55a88189AE136b182e5fdA19dE9b63

## Tech Stack
TypeScript, viem, p-limit, @modelcontextprotocol/sdk

## What makes this different
- No LLM in scoring pipeline. All checks are deterministic. LLM powers the MCP query interface only.
- Actually scans real agents and finds real problems (Sybil spam, dead endpoints, placeholder metadata)
- Writes results on-chain using the ERC-8004 ReputationRegistry (not a separate contract)
- Circuit breakers ensure a single strong negative signal dominates easy-to-game positive signals
- Documents its own limitations publicly
