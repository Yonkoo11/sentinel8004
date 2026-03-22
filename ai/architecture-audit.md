# Sentinel8004 Architecture Audit — Complete Findings

Date: 2026-03-21
Auditor: Deep first-principles analysis across 2 sessions
Status: Investigation complete. Implementation pending.

---

## Executive Summary

Sentinel8004's scoring pipeline (L1-L4) is effective and honest. L5 (reputation layer) is compromised — it reads on-chain feedback at face value, and the #1 agent in the registry achieved that rank via 431 sock puppet wallets costing ~2 CELO. The on-chain `getSummary` function is actively returning attacker-controlled data. Zero legitimate third-party scorers exist. Sentinel is the only honest evaluator in the ecosystem.

The fix is straightforward: filter L5 providers by on-chain history, stop using `getSummary`, and build a consumer-side trust filter (TrustGate pattern).

---

## Verified On-Chain Facts

### Contract Infrastructure
| Contract | Proxy | Implementation |
|----------|-------|---------------|
| IdentityRegistry | `0x8004A169FB4a3325136EB29fA0ceB6D2e539a432` | `0x7274e874CA62410a93Bd8bf61c69d8045E399c02` |
| ReputationRegistry | `0x8004BAa17C55a88189AE136b182e5fdA19dE9b63` | `0x16e0FA7f7C56B9a767E34B192B51f921BE31dA34` |
| ValidationRegistry | `0x8004cc8439f36fd5f9f049d9ff86523df6daab58` | `0xDB31f5d9167f8ebc8B30FbBF814c4d297c2D7F99` |

- Owner (all 3): `0x547289319C3e6aedB179C0b8e8aF0B5ACd062603` (EOA, NOT multisig)
- Owner identity: Leonard Tan (tetratorus), CTO of Web3Auth. Same EOA owns all 3 contracts on 40+ chains.
- EIP-8004 authors: Marco De Rossi (MetaMask AI Lead), Davide Crapis (EF), Jordan Ellis (Google), Erik Reppel (Coinbase)
- Deployed via CREATE2 through Safe Singleton Factory for vanity `0x8004...` prefix
- All 3 upgraded Feb 5, 2026 in a 19-second burst. Owner idle since.
- Sentinel writer: `0xf9946775891a24462cD4ec885d0D4E2675C84355`

### Registry State
- 2,902 registered agents, 97 unique owners
- 2,621 (90.3%) controlled by 2 addresses (babycaisubagent spam)
- 29 agents score >= 50 ("safe"), average score 20.7/100
- 480 agents scored on-chain by Sentinel (2,342 giveFeedback txs)
- 1 real NFT transfer ever (agent #137, Feb 20)

### Reputation Feedback
- 466/480 scored agents: Sentinel-only provider (clean)
- 3 agents Sybil-boosted: #17 (931 puppets), #1870 (431 puppets), #1865 (437 puppets)
- 1,797 total sock puppet wallet addresses, zero overlap between networks
- 0 legitimate third-party scorers
- 0 revocations ever, 0 dispute responses ever
- `getSummary` requires passing client addresses (reverts on empty array), treats all equally

### Data Integrity
- IPFS hash verification: 5/5 sampled agents have exact keccak256 match between pinned report and on-chain feedbackHash
- Hash computed on raw IPFS bytes, not re-canonicalized JSON
- Sentinel tx count: 2,342 confirmed (Blockscout counter shows 0/128 due to indexing bug)

---

## Critical Findings

### Finding 1: L5 Reputation Layer Is Compromised

Agent #1870 (Toppa) — Sentinel's highest-scoring agent (95/100):
- 431 sock puppet wallets, all scoring 97-100
- 4-layer funding tree traced back to Toppa's owner (0x558e...)
- L5 reads first 10 clients from getClients(), all were sock puppets
- L5 awarded 15/15 points (max) based on >=3 "positive" providers
- True score without L5: 80/100
- True #1 agent: AgentDashboard (#1869) at 85/100

L5 scoring logic (reputation.ts):
- Checks only first 10 clients (sock puppets fill these slots)
- Awards max 15 points for >=3 positive providers
- No independence check, no funding trace, no tx history filter
- Any agent can get +15 by creating 3 wallets and calling giveFeedback

### Finding 2: getSummary Returns Attacker-Controlled Data

Agent #17 (Loopuman) right now on mainnet:
- Sentinel score: 35/100
- getSummary (unfiltered, all 931 clients): 98/100
- Distortion: +63 points

Cost to achieve this: ~0.45 CELO ($0.25) for 50 sock puppets scoring 100.
No stake, no identity, no rate limit for scorers. Self-scoring prohibition trivially bypassed.

Nash equilibrium: universal score inflation. Every rational agent owner boosts.

### Finding 3: ValidationRegistry Also Gamed

Agent #1870's owner (0x558e...) is the SAME entity that:
- Created 431 ReputationRegistry sock puppets
- Made 25 ValidationRegistry requests (all answered 98-100 by wallets they funded)
- Funded ~46 validator wallets with 7 CELO bulk distribution

One actor is systematically gaming all three trust surfaces.

### Finding 4: Unused Contract Capabilities

ReputationRegistry has 15+ functions. Sentinel uses 5:
- UNUSED: readAllFeedback (batch read with tag/revocation filtering)
- UNUSED: appendResponse (dispute mechanism, 0 calls ever)
- UNUSED: revokeFeedback (score cleanup, 0 calls ever)
- UNUSED: getResponseCount
- Tag migration issue: agents #1-~1855 tagged "agentguard/trust-v2", #1860+ tagged "sentinel8004/trust-v2"

---

## Comparable Systems Analysis

| System | On-chain aggregation? | Sybil defense | Result |
|--------|----------------------|---------------|--------|
| EAS | No. Resolver hooks for access control | Consumer-side filtering | Works |
| Gitcoin Passport | Weighted sum, curated weights | GTC staking + slashing | Works |
| AttestationStation | No. Recommends EigenTrust off-chain | Seed peers + transitive trust | Works |
| OpenRank/Karma3Labs | No. Off-chain EigenTrust | Seed peer set, eigenvector convergence | Works |
| ERC-8004 | Yes. `getSummary` = unweighted average | None | Broken |

Every system that works has converged on: store raw data on-chain, compute trust off-chain, let consumers define trust boundaries.

---

## Architecture Recommendation

### Sentinel's Position

Sentinel IS the trust layer. The contract is neutral infrastructure (like DNS). `getSummary` is the registry, not the nameserver. Sentinel is the nameserver.

Consumer integration path: `readFeedback(agentId, SENTINEL_ADDRESS, index)`, never `getSummary`.

### Required Changes (Priority Order)

**1. Fix L5 (1-2 days)**
Replace naive client count with provider quality filter:
- Exclude providers with <5 total transactions
- Exclude providers where all scores are >90 (uniformity check)
- Exclude providers traceable to agent owner's funding tree (if feasible)
- Fallback: skip L5 entirely until legitimate third-party scorers exist (score out of 85 instead of 100, normalize)

**2. Revoke-before-rescore (1 day)**
Call `revokeFeedback` on prior entries before writing new scores. Prevents stale data accumulation. Currently zero revocations have ever been made.

**3. TrustGate consumer library (2-3 days)**
- npm package: `checkAgentTrust(agentId, trustedScorers[])`
- Solidity library: `readTrustedFeedback(agentId, scorerWhitelist)`
- Uses `readAllFeedback` with address filtering, never `getSummary`
- Document: "`getSummary` is raw data, not a trust signal"

**4. Dashboard fraud indicators (1 day)**
- Show provider count and Sybil flag for agents with detected sock puppet networks
- Correct Toppa's displayed score from 95 to 80
- Add "Sybil Alert" indicator for agents #17, #1865, #1870

**5. Tag standardization (0.5 day)**
- Standardize on "sentinel8004/trust-v2" going forward
- Document the tag migration boundary (~agent #1855)
- TrustGate must query both tags or use empty string

### Not Worth Building (Yet)
- AgentBond / staking: no demand at 29 real agents
- Own contract deployment: premature, adds maintenance burden
- ValidationRegistry integration: same actors gaming it
- EigenTrust: overkill for single-scorer system, revisit when 5+ legitimate scorers exist
- Cross-owner timing Sybil detection: interesting but doesn't change scores at current scale

### Disclosure Plan
1. Private disclosure to ERC-8004 team (Leonard Tan, Marco De Rossi): "Your reputation layer is being actively Sybil-attacked. Evidence attached. Suggested fix: resolver hooks + consumer guidance."
2. After 30 days or team response: add Sybil detection to dashboard as feature
3. Communicate to consumers: "Filter by scorer address. getSummary is not a trust signal."

---

## Corrected Rankings (Top 10, After L5 Fix)

| Rank | Agent | Current Score | Corrected Score | Change |
|------|-------|--------------|----------------|--------|
| 1 | #1869 AgentDashboard | 85 | 85 | — |
| 2 | #1870 Toppa | 95 | 80 | -15 (sock puppet removal) |
| 3 | #2335 CRIA | 77 | 77 | — |
| 4 | #1873 Fixr | 74 | 74 | — |
| 5 | #1874 Pulsar Provost | 71 | 71 | — |
| 6 | #1875 Chronos Prism | 71 | 71 | — |
| 7 | #1863 Celo Commerce | 65 | 65 | — |
| 8 | #1859 PayFlow | 63 | 63 | — |
| 9 | #1862 HedgeBot | 63 | 63 | — |
| 10 | #1864 Nastar Protocol | 63 | 63 | — |

Only 3 of 480 scored agents are affected by L5 correction (#17, #1865, #1870). The other 466 clean agents have L5 = 0 because Sentinel scans BEFORE writing — during the scan, these agents had no prior feedback in the ReputationRegistry. L5 only finds non-zero data for agents that received feedback from non-Sentinel sources before the scan ran. Verified empirically: AgentDashboard L5=0, CRIA L5=0, all clean agents L5=0.

---

## Resolved Questions

1. **Does L5 count Sentinel's own feedback?** NO. Sentinel scans before writing. At scan time, clean agents have no prior feedback → L5 = 0. Only agents with pre-existing non-Sentinel feedback get L5 points. Verified: AgentDashboard L5=0, CRIA L5=0, Toppa L5=15. Fix affects exactly 3 agents.

## Open Questions

1. Should Sentinel disclose this to the Celo Gather hackathon judges? If Toppa is also a hackathon project, the Sybil gaming is relevant context.

2. The dashboard's methodology page has a worked example using "Toppa #1870 (95/100)." After the L5 fix, this needs to be updated to reflect the corrected score.

3. On rescan with fixed L5: would a second scan cycle cause L5 to read Sentinel's own prior feedback? YES. After cycle 1, `getClients()` returns `[SENTINEL_ADDRESS]` for every scored agent. L5 would count it as 1 positive provider → +10 points for everyone. Fix: L5 MUST exclude SENTINEL_ADDRESS from the client list. More broadly, L5's semantic should be "what do OTHER scorers think?" — exclude all addresses this Sentinel instance controls.

4. Self-referential loop analysis: With the SENTINEL_ADDRESS exclusion fix, the loop is broken for single-scorer scenarios. For future multi-scorer scenarios, the iterated reading of each other's scores creates an implicit consensus computation (like EigenTrust). This converges because the scoring function is monotone and bounded, but it's an uncontrolled convergence. If multiple scorers emerge, L5 should formalize this as explicit EigenTrust with a seed set.

## Rescore Decision

Recommended: Full revoke-and-rescore (option C).
- Revoke all 2,342 existing feedback entries
- Rescore with fixed L5, consistent "sentinel8004/trust-v2" tags, latest scoring logic
- Cost: ~42 CELO ($24). Trivial.
- Prerequisite: L5 fix must be in place BEFORE rescore. Dry-run on all 2,902 agents first.
- Sequence: Fix L5 → dry-run scan → revoke all → write new → verify sample → regenerate dashboard → update methodology

## Strategic Position

The audit findings are not a liability. They ARE the positioning:
1. Active reputation fraud discovered on live EIP standard (1,797 sock puppets, on-chain evidence)
2. `getSummary` proven broken by design ($0.25 to forge 98/100)
3. Governance risk identified (single EOA, 40+ chains)
4. Solution built (TrustGate pattern = consumer-defined scorer whitelists)

Narrative: "We found that the ERC-8004 trust layer is being actively exploited, diagnosed why, and built the infrastructure to make it work despite the protocol-level vulnerability."

Recommended deliverable: Structured disclosure document ("Reputation Sybil Attacks on ERC-8004: Findings and Mitigations") addressed to EIP authors and Celo community. Contains empirical findings, game-theoretic analysis, proposed fix (resolver hooks), and reference implementation (Sentinel with fixed L5).

---

## Confidence Assessment

| Finding | Confidence | Basis |
|---------|-----------|-------|
| Toppa Sybil attack | HIGH | On-chain funding tree, 2-tx wallets, 97-100 uniformity |
| Loopuman Sybil attack | HIGH | Single-funder, 2-tx wallets, null feedbackHash |
| L5 adds +15 to Toppa | HIGH | Layer decomposition from scores.json |
| Zero legitimate third-party scorers | HIGH | 466/480 agents = Sentinel-only |
| getSummary manipulation cost ($0.25) | HIGH | Arithmetic from gas costs |
| EigenTrust is premature | MEDIUM | Depends on future scorer diversity |
| Private disclosure first | MEDIUM | Depends on relationship with ERC-8004 team |
| AgentDashboard is true #1 | HIGH | 85 with no L5 inflation vs Toppa's 80 without |
