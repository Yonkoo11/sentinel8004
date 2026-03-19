# Sentinel8004 - AI Memory

## What This Is
ERC-8004 agent trust scoring system on Celo. Both hackathons submitted (deadline March 22, 2026).

## On-Chain Facts (Verified March 19)
- IdentityRegistry: 0x8004A169FB4a3325136EB29fA0ceB6D2e539a432
- ReputationRegistry: 0x8004BAa17C55a88189AE136b182e5fdA19dE9b63
- ValidationRegistry: NOT deployed on Celo
- 1,855 agents registered (as of March 14)
- 1,854 attestations written on-chain (self-feedback blocked by contract)
- Sentinel8004 registered as agent #1853
- Massive Sybil: 0xbF0E... owns 500+ "babycaisubagent" agents
- Self-feedback blocked by contract design
- All 1,854 attestations have empty feedbackURI (Pinata hit rate limit). Immutable.
- First 1,852 use tag1="agentguard", new writes use tag1="sentinel8004"

## Architecture
5 scoring layers with circuit breakers:
- L1: Registration quality (0-20pts, 0.8x weight)
- L2: Endpoint liveness (0-20pts, 0.8x weight)
- L3: On-chain behavior (0-20pts, 0.8x weight, via Blockscout)
- L4: Sybil/spam detection (0-25pts, 1.0x weight)
- L5: Existing reputation (0-15pts, 1.0x weight)

## Key Decisions
- Use ReputationRegistry (not ValidationRegistry - not deployed)
- Deterministic scoring (no LLM in pipeline)
- Static dashboard on GitHub Pages
- MCP server for agent-to-agent queries (3 tools)

## Hackathon Submissions (March 19)
### Build Agents V2
- Karma Gap ref: APP-SGZ0Y1A7-V4XQWM
- Tweet posted (single tweet with 8004scan link)
- Self AI verification deferred (no passport)

### The Synthesis
- participantId: 8d8b221bbac34e76a05fd64c22ee934d
- Project slug: sentinel8004-4cff (published)
- Tracks: "Best Agent on Celo" + "Agents With Receipts - ERC-8004"
- Self-custody transferred to 0x67FbCB8A3C9136eAA83A550ef0aA17a5549aFB52
- Base registration TX: 0xa6cabdf09c5cdb70002b109236aa539595e061648f47cd7ca6859e33360feeb3

## Gotchas
- Notion pages not fetchable programmatically (require JS)
- Karma Gap pages also require JS rendering
- submission-gate.sh hook blocks writing files with "submission" in name
- on_chain_data.agentURI on agentscan still shows old "AgentGuard" name but display name is correct "Sentinel8004"
- feedbackURI empty for all existing writes (immutable). Documented in README.
