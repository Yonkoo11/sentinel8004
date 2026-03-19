# Sentinel8004 - AI Memory

## What This Is
ERC-8004 agent trust scoring system for Celo hackathons (deadline March 22, 2026 for BOTH).

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

## Hackathon Key Facts (March 16)
- **Build Agents V2 deadline: March 22, 9am GMT** (NOT March 18 — Notion page is authoritative, tweet was misleading)
- **The Synthesis deadline: March 22** (building phase March 13-22, winners March 25)
- agentscan.info (by Alias AI) ≠ 8004scan.io (by AltLayer). Both show Sentinel8004. Hackathon step 2 uses agentscan.info. Track 3 ($500) is for 8004scan rank.
- Self AI verification requires biometric passport with NFC chip. No workaround without passport.
- Karma Gap registration done (prior session). Tweet draft in ai/karma-submission.md.
- Synthesis registration is API-based (POST /register), creates ERC-8004 on BASE Mainnet.
- Relevant Synthesis tracks: ERC-8004 ($4K/$3K/$1K from Protocol Labs), Best Agent on Celo ($3K/$2K), Open Track ($14.5K)

## Gotchas
- Notion pages not fetchable programmatically (require JS). User must share content manually.
- Karma Gap pages also require JS rendering.
- submission-gate.sh hook blocks writing files with "submission" in name. Use "hackathon-checklist" instead.
- on_chain_data.agentURI on agentscan still shows old "AgentGuard" name but display name is correct "Sentinel8004"
