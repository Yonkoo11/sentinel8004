# AgentGuard - Progress

## Completed
- All source code: scanner, 5 scoring layers (v2), scorer with circuit breakers, writer, IPFS pinner, MCP server, dashboard
- Scoring v2 overhaul: circuit breakers, weighted layers, confidence levels, no neutral inflation
- Layer 5 (Reputation): reads existing on-chain feedback from ReputationRegistry
- L2 improvement: generic domain filter (google.com etc won't pass liveness)
- Dashboard v2: hero insight, distribution chart, flag pills, expandable rows, methodology section
- Reporter: ecosystem report generator with adversarial analysis
- GitHub repo: https://github.com/Yonkoo11/agentguard
- GitHub Pages: https://yonkoo11.github.io/agentguard/
- MCP server tested and working (3 tools)
- Writer dry-run tested
- README v2 with scoring methodology, adversarial analysis, limitations

## In Progress
- Full v2 scan running in background (~250/1838 agents done, L1+L2+L4, skip-onchain/reputation)
- Once complete: regenerate dashboard data and push

## Blocked on User
- .env created but empty -- needs:
  - AGENTGUARD_PRIVATE_KEY (any EVM wallet, export private key, fund with ~0.01 CELO)
  - PINATA_JWT (from https://app.pinata.cloud)
- Once keys are set:
  1. Write scores on-chain: `npx tsx src/index.ts write`
  2. Register AgentGuard as agent: `npx tsx scripts/register-agent.ts`
  3. Submit to hackathon

## v2 Scoring Changes
- **Circuit breakers**: MASS_REGISTRATION caps at 15, METADATA_CLONE at 25, NO_METADATA at 20
- **Weighted layers**: L1/L2/L3 at 0.8x (cosmetic/moderate), L4/L5 at 1.0x (security/social)
- **No neutral inflation**: Missing data = 0, not middle-of-range
- **Confidence levels**: high (4+ layers), medium (2-3), low (1)
- **Layer 5 Reputation**: Reads existing on-chain feedback from ReputationRegistry
- **Generic domain filter**: Endpoints pointing to google.com etc flagged as dead
- **Report version**: trust-v2

## Architecture
- src/index.ts -- CLI: scan, write, info, serve, report
- src/scorer.ts -- 5-layer composite with circuit breakers (0-100)
- src/layers/reputation.ts -- NEW: reads on-chain feedback
- src/writer.ts -- ReputationRegistry + IPFS
- src/mcp-server.ts -- MCP stdio (3 tools)
- src/reporter.ts -- Ecosystem report generator
- dashboard/ -- Static HTML+JS, GitHub Pages
- scripts/ -- register-agent, generate-dashboard
