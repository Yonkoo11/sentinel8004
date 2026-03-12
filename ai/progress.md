# AgentGuard - Progress

## Completed
- Project scaffolding (package.json, tsconfig, types, config, chain)
- Scanner with binary search, checkpoint/resume, metadata parsing (5 formats)
- Layer 1: Registration Quality scoring (0-25)
- Layer 2: Endpoint Liveness probing (0-25)
- Layer 3: On-Chain Behavior via Blockscout (0-25)
- Layer 4: Sybil/Spam Detection with owner concentration + Jaccard similarity (0-25)
- Composite scorer (0-100) orchestrating all 4 layers
- Full scan pipeline in CLI with --layer1, --skip-liveness, --skip-onchain flags
- IPFS pinning via Pinata API (src/ipfs.ts)
- On-chain writer to ReputationRegistry with dry-run mode (src/writer.ts)
- MCP server with 3 tools: check_agent_trust, list_flagged_agents, get_agent_report
- Dashboard: static HTML+JS with Tailwind, sortable/filterable table, score badges
- Dashboard data generator script
- Self-registration script (scripts/register-agent.ts)

## Verified Working
- 50-agent scan: 6 high-trust, 24 fair, 20 poor. babycaisubagent spam correctly flagged.
- Writer dry-run: outputs scores per agent without chain interaction
- Dashboard data generation from scan results
- All TypeScript compiles clean (tsc --noEmit passes)

## Remaining (Day 4-5)
- Run full 1836-agent scan (will take ~30min with L2+L3)
- Write scores to chain (needs AGENTGUARD_PRIVATE_KEY funded with CELO)
- Register AgentGuard itself as ERC-8004 agent (needs PINATA_JWT + funded wallet)
- Deploy dashboard to GitHub Pages
- README with architecture, setup, demo screenshots
- Karma Gap, X post, Synthesis registration

## Key Files
- src/index.ts — CLI entry (scan, write, serve)
- src/scorer.ts — 4-layer composite scoring
- src/writer.ts — ReputationRegistry writer
- src/mcp-server.ts — MCP stdio server
- dashboard/ — Static HTML dashboard
- scripts/register-agent.ts — Self-registration
- scripts/generate-dashboard.ts — Dashboard data transformer
