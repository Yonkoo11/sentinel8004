# Celo Proof of Ship — Season 8 packet (Sentinel8004)

Prepared 2026-06-15. Facts verified against talent.app + docs.gap.karmahq.xyz, not carried from the May packet.

## Verified program facts (2026-06-15)
- **Round:** Proof of Ship **Season 8**, window **June 1–22, 2026** (open; ~7 days left). Source: talent.app/~/earn/celo-proof-of-ship.
- **Prize:** $5,000, split across 50 winners (impact-metric scored).
- **Submit via:** Karma GAP project profile + Talent Protocol. Project profile is on-chain (Karma sponsors your first 5 txs; needs a Celo wallet — Rabby/Rainbow/MetaMask).
- **Base Talent eligibility shown:** (1) submit project + meet scoring eligibility, (2) add a hook + MiniPay compatibility, (3) deploy a smart contract on Celo mainnet.

## ⚠️ Honest fit note (read before submitting)
The base "scored" criteria lean toward **MiniPay mini-apps that deploy their own contract**. Sentinel8004 **writes to** the existing ReputationRegistry but does **not deploy its own contract** and is **not a MiniPay app** — it's agent/infrastructure. So:
- We should submit under the **agent / infra / AI angle** and pick the closest track in the Karma GAP UI at submit time (track list is shown there; docs didn't enumerate Season 8 tracks).
- Scoring is driven by **impact metrics + milestones** in the Karma profile, which favors real shipping — that's our strength (live mainnet attestations, 9,400-agent coverage).
- I can't confirm a dedicated AI track for S8 from the docs. If the only tracks are MiniPay-specific, the base prize fit is weak and we should say so rather than force it. Verify the track list when you reach step 3.

## Application steps (Karma GAP)
1. Create project profile at **https://gap.karmahq.xyz/community/celo** (one-time, on-chain).
2. Add contact info (email: see below).
3. Grants tab → **Add Funding → Join Funding Program → Celo → Proof of Ship (Season 8)** → select track(s).
4. Add milestones (below).
5. Project settings → add GitHub repo, contract addresses, divvi profile ID.
6. Update milestones, mark complete as you ship.
7. Final: mark grant complete + submit assets, **video (≤4 min)**, **slides (≤10)**.

## Project profile

**Name:** Sentinel8004

**One-liner:** The trust layer for Celo's ERC-8004 agent ecosystem — scans every registered agent, scores it 0–100 on real signals, and writes verifiable attestations on-chain.

**Description (current numbers):**
Sentinel8004 scans every agent on Celo's ERC-8004 IdentityRegistry — **9,400 as of the June 2026 rescan** — and scores each 0–100 across five deterministic layers: metadata quality, endpoint liveness, on-chain wallet behavior, Sybil/spam detection, and existing reputation. Scores are written on-chain to the ReputationRegistry as verifiable attestations, each backed by an IPFS-pinned evidence report. **3,541 attestations are live on mainnet** (covering the first 3,766 agents; the newly-scanned set is queued). Other agents query scores via an MCP server (check_agent_trust, list_flagged_agents, get_agent_report); humans browse a live dashboard. Scoring is fully deterministic — no LLM, no randomness — and circuit breakers cap manipulators (a mass registrar can't exceed 15). In the scanned set, 78.5% of agents trip at least one circuit breaker; one address controls 991+ identical clones and 1,797 sock-puppet wallets were found inflating three agents' reputation.

**Location of impact:** Global

## Social / links
- Twitter: @soligxbt
- GitHub: https://github.com/Yonkoo11/sentinel8004
- Website/dashboard: https://yonkoo11.github.io/sentinel8004/
- Logo: dashboard asset / sentinel8004-logo.png
- ReputationRegistry: https://celoscan.io/address/0x8004BAa17C55a88189AE136b182e5fdA19dE9b63
- Agent #1853 registration tx: https://celoscan.io/tx/0x336764f2c9fd6d125ce57009b4fa04fa65d9794c36366b630b2a0108b0a0e47f
- Contact email: alexmustapha11@gmail.com (the account used for the hackathon submission) — confirm which email you want listed

## Contract addresses (for project settings)
- ReputationRegistry (where attestations are written): `0x8004BAa17C55a88189AE136b182e5fdA19dE9b63`
- IdentityRegistry (read source): `0x8004A169FB4a3325136EB29fA0ceB6D2e539a432`
- Note: these are the canonical ERC-8004 registries, not contracts we deployed. State that plainly in the profile.

## Milestones (Season 8 — what we ship this window)

### Milestone 1 — Full-registry rescan to 9,400 agents ✅ (done 2026-06-15)
Extended scoring coverage from 3,766 (March) to all 9,400 currently-registered agents; made the scorer ~14x faster (concurrent + checkpointed); refreshed the live dashboard and README to honest current figures. Evidence: commit on main, dashboard shows 9,400.

### Milestone 2 — Write attestations for the newly-scanned agents on-chain
Write ReputationRegistry attestations (with IPFS reports) for the ~5,600 agents scanned in M1 that aren't yet on-chain, in resumable gas-estimated batches with a test tx first. Blocked on wallet funding / favorable gas (Celo gas is currently ~202 gwei vs ~27 in March). End date: target within S8 window if funded.

### Milestone 3 — Public read API for trust scores
Deploy a simple REST API (GET /agent/:id, GET /flagged) so any app/agent can query a trust score over HTTP without running the MCP server locally. End date: end of S8 window.

## Final submission assets (needed at step 7)
- **Video ≤4 min:** money shot = open dashboard → search an agent → show its 0–100 score + the on-chain attestation tx + IPFS report; then show the MCP query returning the same score. (Use /demo-video pipeline.)
- **Slides ≤10:** problem (no quality layer on 9,400 agents) → approach (5 deterministic layers + circuit breakers) → on-chain proof (3,541 attestations) → what shipped in S8 (rescan to 9,400) → roadmap.

## X post draft (current numbers)
Sentinel8004 — the trust layer for Celo's ERC-8004 agents.

It scans all 9,400 agents on the IdentityRegistry, scores them across 5 deterministic layers, and writes trust attestations on-chain. 78.5% trip a circuit breaker; 3,541 scores live on the ReputationRegistry.

Dashboard: https://yonkoo11.github.io/sentinel8004/
Code: https://github.com/Yonkoo11/sentinel8004

@Celo @CeloDevs @CeloPublicGoods

## You-only steps (need your wallet/accounts)
- A. Create the Karma GAP project (connect Celo wallet — the `0xf994…` operator wallet works, has CELO).
- B. Confirm the contact email and whether @soligxbt is current.
- C. At step 3, check the actual Season 8 track list and pick the best agent/infra fit (tell me what's offered and I'll recommend).
- D. divvi profile ID — do you have one? If not, leave blank.
