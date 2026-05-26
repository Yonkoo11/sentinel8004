# Celo Proof of Ship — AI Track Registration Packet (Sentinel8004)

Built 2026-05-26. All on-chain values verified by direct RPC call to forno.celo.org, not copied from files.

## Program facts (factchecked)

- **Proof of Ship** is Celo's monthly builder program. Current window shown on talent.app: **May 4–29**. Distribution layer = Talent Protocol (talent.app); project/milestone registration = KarmaGAP (gap.karmahq.xyz).
- Base program prize: $5,000 split across 50 winners.
- **AI Track** is a separate add-on prize: **$1,000 total → 4 projects get $250 each** for "integrating AI Agents successfully."
- AI Track hard requirements (from the user's program blurb + the Google form):
  1. Registered with **8004** → ✅ Sentinel8004 is ERC-8004 agent **#1853**
  2. Registered with **Self Agent ID (@selfxyz)** → ❌ NOT DONE — the one blocker
  3. Wallet with **on-chain tx** → ✅ agent wallet has 4,310 txs
- AI Track requires a SECOND submission via the Google Form (in addition to the Talent/KarmaGAP project entry).

## On-chain verification (RPC, 2026-05-26)

- Agent #1853 `ownerOf` = **`0xf9946775891a24462cd4ec885d0d4e2675c84355`** — this is the real agent/operator wallet.
  - tx count: **4,310**, balance: ~12.68 CELO. Registered the agent and wrote the attestations.
- The `operatorWallet` previously written in `agent.json` (`0x67Fb…FB52`) has **0 tx / 0 balance** — never used. FIXED agent.json to the real wallet.
- Registration tx: `0x336764f2c9fd6d125ce57009b4fa04fa65d9794c36366b630b2a0108b0a0e47f` (block 61,533,359), from `0xf994…`, to IdentityRegistry `0x8004A169…`.
- IdentityRegistry `0x8004A169FB4a3325136EB29fA0ceB6D2e539a432` matches Celo official docs.

## Google Form answers (https://docs.google.com/forms/d/e/1FAIpQLScNUXE54uA-XkmynIZSMHg7W7ZtlKZ7rwgxZRX5MH6nFC-OiA)

1. **Project/Agent name:** Sentinel8004
2. **Link to Project on Talent Protocol:** ⚠️ NEEDS the Talent Protocol project URL — created when you register the project on talent.app (wallet connect required). Fill after step A below.
3. **Email (Primary Contact):** mustaphadamilola201@gmail.com
4. **Telegram Username:** ⚠️ NEED FROM YOU
5. **Twitter Handle:** @soligxbt  *(from karma draft — confirm this is current)*
6. **GitHub Repository:** https://github.com/Yonkoo11/sentinel8004
7. **Website/Demo:** https://yonkoo11.github.io/sentinel8004/
8. **Agent's Wallet Address on Celo:** `0xf9946775891a24462cd4ec885d0d4e2675c84355`
9. **Link to agent on 8004.io:** https://8004.io/agent/1853  *(verify it renders; fallback = CeloScan token #1853 on IdentityRegistry)*
10. **Self Agent ID NFT (or reason):** See "Self Agent ID" below. If not done by submit time, paste the explanation draft.
11. **Short Description (≤300 words):** see below.
12. **Builder feedback / missing infra:** see below.
13. **Completion stage:** **Ready for Demo/Shipment**

### Field 11 — Short description (~210 words)

Sentinel8004 is the trust layer for Celo's ERC-8004 agent ecosystem. It scans every agent registered on the IdentityRegistry (3,766 and growing), scores each one 0–100 across five deterministic layers — registration quality, endpoint liveness, on-chain wallet behavior, Sybil/spam detection, and existing reputation — and writes the scores on-chain to the ReputationRegistry as verifiable attestations, each backed by an IPFS-pinned evidence report.

The problem it solves: anyone can register an ERC-8004 agent, and most register junk. Sentinel8004 found one address controlling 991+ identical clones, 1,797 sock-puppet wallets inflating three agents' reputation scores, dead endpoints, and placeholder "YOUR_USER/YOUR_REPO" metadata. 97.6% of agents trip at least one circuit breaker. Before Sentinel8004, an app or agent deciding whom to interact with had no quality signal.

Sentinel8004 is itself a registered agent (#1853) and has written 3,300+ trust attestations to mainnet. Other agents query its scores through an MCP server (check_agent_trust, list_flagged_agents, get_agent_report); humans browse them on a live dashboard. Scoring is fully deterministic — no LLM, no randomness — so every score is reproducible and auditable. Circuit breakers cap manipulators: a mass registrar cannot score above 15 no matter how polished its metadata looks.

### Field 12 — Builder feedback (draft)

The ERC-8004 registries shipped without any quality or anti-Sybil layer, so the IdentityRegistry filled with mass-registered clones and the ReputationRegistry is already being gamed by sock-puppet feedback (getSummary returns attacker-inflated numbers on mainnet today). Missing infra: (1) a canonical agent explorer with trust signals baked in, (2) a standard way to whitelist/identify legitimate scorers so ReputationRegistry reads aren't trivially Sybil-able, (3) revoke-before-rescore tooling. Self Agent ID is the right primitive to fix the human-backing gap — wiring it into the registries by default would kill most of the spam we measured.

## Self Agent ID — the one blocker

- Get it at **https://app.ai.self.xyz/** using the **Self mobile app** + a **passport NFC scan** (proves humanity, mints a soulbound agent-ID NFT). Cost ~$0.20 on an L2. This is the only step that genuinely can't be automated — it needs your phone + passport.
- It directly strengthens the pitch: Sentinel8004 measures the exact Sybil problem Self Agent ID solves.
- If not done before the deadline, field-10 explanation draft:
  > "Self Agent ID requires an in-person passport NFC scan via the Self mobile app; I'm completing it now and will link the soulbound NFT as soon as it's minted. Sentinel8004 already implements the on-chain identity half of this stack (registered ERC-8004 agent #1853) and its entire purpose is detecting the Sybil/sock-puppet attacks that Self Agent ID's proof-of-humanity is designed to prevent."

## Action plan

**You-only (need your wallet/phone/accounts):**
- **A. Register the project on Talent Protocol** (talent.app → connect the `0xf994…` wallet → add Sentinel8004, GitHub, website). Produces the form's field-2 URL. Likely also needs the KarmaGAP project entry — the draft is ready in `ai/karma-submission.md`.
- **B. Get Self Agent ID** at app.ai.self.xyz on your phone with passport.
- **C. Give me your Telegram username** and confirm Twitter is **@soligxbt**.
- **D. Submit the Google Form** once A–C are filled (paste answers above).

**Done / ready (me):**
- All on-chain facts verified; agent wallet corrected in `agent.json`.
- Form answers, 300-word description, builder feedback, and Self explanation drafted.
