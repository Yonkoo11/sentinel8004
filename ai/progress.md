# Sentinel8004 - Progress

## Status: ARCHITECTURE AUDIT COMPLETE (March 21, 2026, Session 6-7)

## What's Done (Sessions 3-5)

### Session 3-4: Initial Critique Fixes (committed bba88a9)
1. Canonical JSON serialization (`canonicalJSON()` in utils.ts)
2. Worked example on methodology page (Toppa #1870 vs Scarlet Orbit #1900)
3. IPFS report links in registry detail view
4. Search debounce (200ms)
5. Cost/tx corrected to ~0.009 CELO

### Session 5: Full Critique Plan Implementation (9 items)

**Phase 1: Narrative & Positioning**
- 1.1: Reframed hero to "Infrastructure-grade trust layer", added Design Principles to methodology, Integration section with 3 paths (contract, MCP, JSON), reframed hackathon-draft.md
- 1.2: Rewrote trust-gate.ts to query ReputationRegistry on-chain via viem (was local JSON)
- 1.3: Added Integration Surfaces section to hackathon-draft.md

**Phase 2: Code Quality**
- 2.1: Writer checkpoint system (data/write-checkpoint.json, --resume flag, auto-skip)
- 2.2: Vitest + 21 unit tests (scorer 6, canonical-json 7, sybil 8) — ALL PASSING

**Phase 3: Dashboard Performance**
- 3.1: scores.json stripped of layer details arrays, compact JSON — 3.5MB → 1.14MB (67% reduction)

**Phase 4: Methodology Rigor**
- 4.1: Weight sensitivity analysis script + results in methodology (5 configs, all Spearman rho > 0.96)
- 4.2: Threshold analysis script + results in methodology (68% single-owner, 3 mass registrators = 92.8%)
- 4.3: Timing cluster analysis script (written, compiles, NOT successfully run — Celo public RPC too slow for historical getLogs)

## Verification
- `npm test`: 21/21 passing
- `tsc --noEmit`: clean compile
- `generate-dashboard.ts`: outputs 1.14MB
- weight-sensitivity.ts: ran, all rho > 0.96
- threshold-analysis.ts: ran, validates thresholds
- timing-cluster-analysis.ts: NOT verified (RPC timeout)

## Files Modified/Created This Session
- Modified: dashboard/index.html, dashboard/methodology.html, ai/hackathon-draft.md, scripts/trust-gate.ts, src/writer.ts, scripts/generate-dashboard.ts, package.json
- Created: vitest.config.ts, tests/scorer.test.ts, tests/canonical-json.test.ts, tests/sybil.test.ts, scripts/weight-sensitivity.ts, scripts/threshold-analysis.ts, scripts/timing-cluster-analysis.ts

## Session 6-7: Deep Architecture Audit (March 21, 2026)

Full first-principles audit. No code written. All findings in `ai/architecture-audit.md`.

**Key Findings:**
1. L5 compromised: Toppa (#1870) scored 95 but true score is 80. 431 sock puppets added +15 via L5.
2. Loopuman (#17) has 931 sock puppets, getSummary returns 98 vs Sentinel's 35.
3. Agent #1865 has 437 sock puppets.
4. Zero legitimate third-party scorers exist. 466/480 scored agents = Sentinel-only.
5. 1,797 total sock puppet wallets across 3 agents, zero overlap.
6. getSummary is actively returning attacker-controlled data on mainnet.
7. Contract owner identified: Leonard Tan (Web3Auth CTO), single EOA, 40+ chains.
8. IPFS hash integrity verified (5/5 match).
9. ValidationRegistry also gamed by same Toppa owner (25 coordinated validations).
10. AgentDashboard (#1869, score 85) is the true #1 agent.

**Corrected ranking (top 3):**
1. AgentDashboard (#1869): 85 (clean)
2. Toppa (#1870): 80 (was 95, -15 from L5 sock puppet removal)
3. CRIA (#2335): 77 (clean)

**Required changes (priority order):**
1. Fix L5: filter providers by tx history + funding independence
2. Revoke-before-rescore: call revokeFeedback before new writes
3. TrustGate consumer library: readAllFeedback with scorer whitelist
4. Dashboard fraud indicators: Sybil alerts for #17, #1865, #1870
5. Tag standardization: "sentinel8004/trust-v2" consistently

**Full details:** ai/architecture-audit.md

## Session 8: Implementation (March 21, 2026)

**IPFS Provider Switch:**
- Pinata limits hit. Added Filebase (S3-compatible, 5GB free) as primary IPFS provider.
- Modified: `src/ipfs.ts` (added `pinViaFilebase` with AWS4 signing), `.env`, `.env.example`
- Tested: pinned test JSON, got CID `QmfGPfGYyCe37T3K7sZrQXttA2dYm9L7o6mdvyrV9wjR79`
- Provider priority: Filebase > Lighthouse > Pinata

**L5 Fix (Priority #1 from audit):**
- Modified: `src/layers/reputation.ts` (full rewrite with 3 anti-Sybil filters)
  1. Excludes SENTINEL_WRITER_ADDRESS from client list (prevents self-referential loop)
  2. Excludes providers with <5 total txs (sock puppet filter via Blockscout)
  3. Uniformity filter: all scores >90 from qualified providers = SYBIL_BOOSTED flag
- Modified: `src/config.ts` (added SENTINEL_WRITER_ADDRESS constant)
- **VERIFIED ON LIVE CHAIN**: 5/5 agents pass
  - Toppa (#1870): 431 puppets filtered, score 0/15, SYBIL_BOOSTED flag
  - Loopuman (#17): 936 external clients filtered, score 0/15, SYBIL_BOOSTED flag
  - Agent #1865: 437 puppets filtered, score 0/15, SYBIL_BOOSTED flag
  - AgentDashboard (#1869): Sentinel-only, score 0/15, no flag (correct)
  - CRIA (#2335): Sentinel-only, score 0/15, no flag (correct)

**Revoke Capability (Priority #2):**
- Added `revokeAllFeedback()` to `src/writer.ts`
- Added `revokeFeedback` ABI to `src/config.ts`
- NOT YET TESTED on-chain (requires gas)

**Dashboard Updates:**
- `SYBIL_BOOSTED` added to red flag set in `app.js`
- IPFS gateway switched from Lighthouse to Filebase across all files
- Methodology worked example updated: Toppa now shows 80/100 with Sybil correction explanation
- `src/config.ts` IPFS_GATEWAYS updated

**All tests pass:** 21/21, clean compile.

**Session 9: Rescan + L5 Correction (March 21, 2026)**

- Incremental rescan: 317 new agents (IDs 2903-3219), merged to 3,219 total
- L5 re-scored for 2 agents with non-zero reputation:
  - Toppa #1870: 95 → 80 (430 sock puppets filtered, SYBIL_BOOSTED flag)
  - Orbiting Parity #2259: stays 15 (1 legitimate external client, 85+ txs)
- Dashboard regenerated: scores.json now matches methodology page (Toppa = 80)
- All new agents scored 15-20 (mass registration spam, no metadata)
- 21/21 tests pass, clean tsc compile

**Remaining from audit:**
- [ ] Full revoke-and-rescore (~42 CELO) - revokes old on-chain scores, rewrites with corrected L5
- [ ] TrustGate consumer library
- [ ] Tag standardization (happens automatically during rescore)
- [ ] Disclosure document for ERC-8004 team

## Session 10: On-Chain Write Batch 2 (March 22, 2026)

**Problem found:** write-results.json only had 469 successful tx entries but 2,338 agents were already on-chain.
Writer was re-writing agents 1-12 (wasted ~0.1 CELO, created duplicate entries).

**Fix applied:**
1. Binary search found on-chain cutoff: agents 1-2338 written, 2339+ not written
2. Rebuilt write-results.json with 2,338 entries marked as already-written
3. Fixed src/index.ts: dry-run no longer overwrites write-results.json
4. Updated checkpoint to lastAgentId=2338

**Batch 2+3 write results:**
- 231 agents written in batch 2 (Filebase IPFS + on-chain)
- 9 agents written in batch 3 before Filebase quota hit
- Total on-chain: 2,569 of 3,219 agents
- 650 remaining (need IPFS provider)

**IPFS provider status:**
- Filebase: QUOTA EXCEEDED (5GB free tier full)
- Pinata: BLOCKED (plan usage limit)
- Lighthouse: NOT CONFIGURED (need API key from files.lighthouse.storage)
- **ipfs.ts now has fallback logic**: tries all providers in order instead of failing on first

**Code fixes this session:**
- `src/ipfs.ts`: Added provider fallback (was fail-fast, now tries Filebase > Lighthouse > Pinata)
- `src/index.ts`: write-results.json merge instead of overwrite (preserves prior on-chain data)
- `src/index.ts`: dry-run no longer clobbers write-results.json

**Duplicate cleanup needed:**
- Agents 1-5, 7-12 have lastIndex=2 (duplicate entries from accidental re-write)
- Script at scripts/revoke-duplicates.ts ready to run

## Session 11: Scoring Critique + SYBIL_BOOSTED Fix (March 22, 2026)

**Deep scoring critique — 6 bugs found:**

1. **SYBIL_BOOSTED not a circuit breaker (CRITICAL, FIXED):** Flag was set by L5 but never capped score. Toppa scored 80 despite 431 sock puppets. Added SYBIL_BOOSTED to CIRCUIT_BREAKERS map with cap at 40. Toppa now scores 40/100. Verified on live chain.

2. **Reporter adversarial analysis wrong about L5 (FIXED):** Claimed "Very High" gaming cost. Corrected to "Low (~$5 for 400+ sock puppet wallets; mitigated by tx-count + uniformity filters)."

3. **L2 domain verification counts Telegram URLs (NOT FIXED):** t.me returns 200 for .well-known checks. Toppa gets domainVerified partly from Telegram bot URL. Low priority — only affects 5 points.

4. **L3 wallet age uses wrong window (NOT FIXED):** Only fetches 100 txs, uses oldest in window as "wallet age." Active wallets show 0 days. Would need Blockscout pagination or different API. Low priority.

5. **Score distribution is bimodal (NOT FIXED, documented):** 98.7% of agents score below 30. The 0-100 range is misleading. System is effectively a binary spam detector. This is actually correct behavior given the registry is 98%+ spam.

6. **L5 only checks first 20 external clients (NOT FIXED):** `.slice(0, 20)` limits check scope. Uniformity filter catches coordinated attacks anyway. Low priority.

**Files modified:**
- `src/scorer.ts`: Added SYBIL_BOOSTED circuit breaker (cap 40)
- `src/reporter.ts`: Fixed L5 adversarial analysis, added SYBIL_BOOSTED to breaker list
- `tests/scorer.test.ts`: Added SYBIL_BOOSTED to test breaker map + new test case
- `dashboard/methodology.html`: Added SYBIL_BOOSTED card, updated Toppa worked example (80→40)
- `dashboard/data/scores.json`: Regenerated with corrected Toppa score
- `data/scan-results.json`: Updated Toppa from 80 to 40
- `CLAUDE.md`: Updated scoring reference table

**Corrected top 5:**
1. AgentDashboard (#1869): 85
2. CRIA (#2335): 77
3. Celo GovAI Hub (#2807): 75
4. Fixr (#1873): 74
5. OG_Bot (#3040): 72

Toppa (#1870): 40 (was 80, capped by SYBIL_BOOSTED)

**Verification:** 22/22 tests pass, clean tsc compile, live chain scoring verified.

## NOT Done
- 650 agents need IPFS + on-chain write (blocked on IPFS provider)
- ACTION NEEDED: Get Lighthouse API key from files.lighthouse.storage, add LIGHTHOUSE_API_KEY to .env
- Duplicate revocation pending
- Dashboard regeneration (do after all writes complete)
- Timing cluster script never ran to completion

## Key Credentials
- Synthesis participantId: 8d8b221bbac34e76a05fd64c22ee934d
- Synthesis project UUID: 44047eed8b3545f28c33779685d88e00
- Synthesis slug: sentinel8004-4cff
- Synthesis teamUUID: a6c9ac11ae7040b6905ebc96a6d05e4f
- Karma Gap ref: APP-SGZ0Y1A7-V4XQWM
- User wallet: 0x67FbCB8A3C9136eAA83A550ef0aA17a5549aFB52
- Celo agent: #1853
- Writer address: 0xf9946775891a24462cD4ec885d0D4E2675C84355
