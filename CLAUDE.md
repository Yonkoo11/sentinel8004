# CLAUDE.md - AgentGuard

## Product Identity

AgentGuard is an autonomous ERC-8004 trust scoring agent on Celo. It scans every registered agent on the IdentityRegistry, scores them across 5 independent layers with circuit breakers, and writes trust attestations to the ReputationRegistry on-chain.

**The bar:** Every decision should pass the question: "Would the Celo team accept this into their core infrastructure?" If not, rethink.

---

## Strict Rules

### 1. NEVER write misleading data on-chain
- On-chain data is permanent. Every value we write to ReputationRegistry must be defensible.
- If a scan is partial (missing layers), the score MUST reflect what was actually evaluated. Document which layers ran in the IPFS report.
- Never write a score out of 100 if the maximum possible score for the scan configuration is less than 100.
- Always pin the full report to IPFS before writing on-chain. The feedbackURI is not optional - it's what makes our scores verifiable.
- feedbackHash MUST match the actual report JSON. Never skip hashing.

### 2. Test before mainnet, always
- Before any batch of on-chain writes, test with 1-3 agents first and verify on CeloScan.
- Simulate every transaction before sending (simulateContract).
- Never assume gas estimates. Check actual gas used on test transactions.
- If a test tx reverts, STOP. Debug before proceeding.

### 3. Scoring integrity
- Circuit breakers are non-negotiable. A mass registrar cannot score above 15 regardless of metadata quality.
- Missing data = 0 points. Unknown is not positive. Never inflate scores.
- Every layer score must have documented rationale in the report details array.
- When adding/changing scoring logic, verify against known agents: Arca (#2), babycaisubagent cluster (#50-1670), Clenja (#132).
- The scoring pipeline is deterministic. No LLM, no randomness, no external API results that change between runs (except liveness probes, which are inherently temporal).

### 4. Critique before shipping
- Before any commit that touches scoring, writer, or on-chain logic: read the code as if you're a judge evaluating it.
- Ask: "What would a Celo founder critique about this?" Address those critiques before committing.
- Ask: "How could a malicious actor game this?" Document the answer.
- Never call untested code "ready" or "working." State what was tested and what wasn't.

### 5. On-chain write protocol
- Always check for already-scored agents before writing (avoid duplicate feedback).
- Sequential nonce management. No parallel writes - Celo nonce collisions waste gas.
- Log every transaction hash. If the process crashes, we need to know where to resume.
- Skip our own agentId (self-feedback is blocked by contract).
- After a batch write, verify a sample on CeloScan before declaring success.
- NEVER hardcode gas limits. The ReputationRegistry's giveFeedback needs ~217K gas per call. Let the node estimate per-tx. Hardcoding 200K caused silent reverts across 90% of agents.
- Budget: ~0.006 CELO per write at current gas prices. Full 1853-agent batch costs ~11 CELO.

### 6. Dashboard accuracy
- Dashboard data must match on-chain data. Never show stale scores after a re-scan.
- After every scan, regenerate dashboard data: `npx tsx scripts/generate-dashboard.ts`
- The methodology section must accurately describe the current scoring version.
- If a scan used --skip flags, display the scan mode so users know which layers were active.

### 7. No secrets, no shortcuts
- .env is in .gitignore. Never read it, display it, or commit it.
- Never hardcode private keys, API tokens, or RPC URLs.
- Never skip IPFS pinning for on-chain writes (reports must be verifiable).
- Never use --no-verify or skip pre-commit hooks.

---

## Architecture

```
src/
  index.ts          -- CLI entry: scan, write, info, serve, report
  scanner.ts        -- Enumerate agents from IdentityRegistry
  metadata.ts       -- Parse 5 metadata formats (gzip/base64/IPFS/HTTP/raw)
  scorer.ts         -- 5-layer composite with circuit breakers (0-100)
  layers/
    registration.ts -- L1: metadata quality (0-25 raw, 0.8x weight)
    liveness.ts     -- L2: endpoint probes (0-25 raw, 0.8x weight)
    onchain.ts      -- L3: wallet behavior via Blockscout (0-25 raw, 0.8x weight)
    sybil.ts        -- L4: spam/Sybil detection (0-25 raw, 1.0x weight)
    reputation.ts   -- L5: existing on-chain feedback (0-15 raw, 1.0x weight)
  writer.ts         -- Write to ReputationRegistry + IPFS
  ipfs.ts           -- Pinata upload
  mcp-server.ts     -- MCP stdio server (3 tools)
  reporter.ts       -- Ecosystem report generator
  chain.ts          -- viem clients for Celo mainnet
  config.ts         -- Addresses, ABIs, constants
  types.ts          -- All interfaces
  utils.ts          -- Rate limiter, timeout, jaccard
dashboard/          -- Static HTML+JS, GitHub Pages
scripts/            -- register-agent, generate-dashboard
```

## On-Chain Contracts

- IdentityRegistry: `0x8004A169FB4a3325136EB29fA0ceB6D2e539a432` (ERC-721)
- ReputationRegistry: `0x8004BAa17C55a88189AE136b182e5fdA19dE9b63`
- Chain: Celo Mainnet (42220), RPC: https://forno.celo.org

## Key Commands

```bash
npx tsx src/index.ts scan [--max N] [--smart] [--layer1] [--skip-liveness] [--skip-onchain] [--skip-reputation]
npx tsx src/index.ts write [--dry-run] [--skip-pinning] [--own-agent-id N]
npx tsx src/index.ts serve          # MCP server
npx tsx src/index.ts report         # Ecosystem report
npx tsx scripts/generate-dashboard.ts
npx tsx scripts/register-agent.ts [--dry-run]
```

## Scoring Reference

| Layer | Max Raw | Weight | Weighted Max | Circuit Breakers |
|-------|---------|--------|-------------|-----------------|
| L1 Registration | 25 | 0.8x | 20 | NO_METADATA(20) |
| L2 Liveness | 25 | 0.8x | 20 | ALL_ENDPOINTS_DEAD(35) |
| L3 On-Chain | 25 | 0.8x | 20 | -- |
| L4 Sybil | 25 | 1.0x | 25 | MASS_REGISTRATION(15), METADATA_CLONE(25) |
| L5 Reputation | 15 | 1.0x | 15 | NEGATIVE_REPUTATION(30) |
| **Total** | | | **100** | |

## Verification Agents

| Agent | Expected Behavior |
|-------|------------------|
| #2 Arca | Has metadata, services, should score 30-50 fair |
| #3 Unknown | No metadata, should cap at 20 (NO_METADATA) |
| #50-1670 | babycaisubagent spam cluster, must cap at 15 (MASS_REGISTRATION) |
| #132 Clenja | Best agent in registry, should score highest |
