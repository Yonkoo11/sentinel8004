# Sentinel8004 - Progress

## Status: BOTH HACKATHONS SUBMITTED (March 19, 2026)

## Last Session Summary
- **Date:** March 16, 2026
- **What was done:**
  - Deep research into both hackathons (Build Agents V2 + The Synthesis)
  - Created ai/hackathon-checklist.md with full requirements for both
  - Confirmed Sentinel8004 visible on agentscan.info (agent #1853, token_id 1853, status active)
  - Confirmed agent visible on 8004scan.io at /agents/celo/1853
  - Mapped all relevant Synthesis prize tracks (ERC-8004 $4K/$3K/$1K, Celo $3K/$2K, Open Track $14.5K)
  - Started Self AI verification but hit blocker: user can't find passport
  - Karma Gap registration already done in prior session (unverified claim)
- **What's next:** Submit to both hackathons (see below)
- **Blockers:** Self AI verification requires biometric passport with NFC chip. User couldn't find passport.

## Handover Notes — SUBMISSION STEPS

### Build Agents V2 (deadline: March 22, 9am GMT)
1. ✅ Register project on Karma Gap
2. ✅ Join Telegram
3. ⬜ Self AI verification — deferred (no passport)
4. ✅ Tweet posted (single tweet with 8004scan link, agentscan agentId, tags)
5. ✅ Karma Gap form submitted — ref: APP-SGZ0Y1A7-V4XQWM (March 19, 12:58 PM)

### The Synthesis (deadline: March 22)
1. ✅ Registered via API — participantId: 8d8b221bbac34e76a05fd64c22ee934d
2. ✅ On-chain registration TX (Base): https://basescan.org/tx/0xa6cabdf09c5cdb70002b109236aa539595e061648f47cd7ca6859e33360feeb3
3. ✅ Project draft created (ID: 182, uuid: 44047eed8b3545f28c33779685d88e00)
4. ✅ Self-custody transfer completed to 0x67FbCB8A3C9136eAA83A550ef0aA17a5549aFB52
5. ✅ Project PUBLISHED — slug: sentinel8004-4cff
6. Tracks: "Best Agent on Celo" ($5K) + "Agents With Receipts — ERC-8004" ($4K)
7. API Key: saved locally (sk-synth-... — do NOT commit)

### Key URLs
- agentscan: https://agentscan.info/api/agents?search=Sentinel8004
- 8004scan: https://8004scan.io/agents/celo/1853
- Self AI: https://app.ai.self.xyz
- Karma Gap: https://app.karmahq.xyz/celo/programs/1059/apply
- Synthesis: https://synthesis.devfolio.co/register

---

### Completed (prior sessions)
- All source code: scanner, 5 scoring layers (v2), scorer with circuit breakers, writer, IPFS pinner, MCP server, dashboard
- Full scan: 1,855 agents scored (all agents on Celo IdentityRegistry as of March 14)
- 1,854 trust attestations written on-chain to ReputationRegistry (1 excluded: self-feedback blocked by contract)
- Sentinel8004 self-registered as agent #1853
- On-chain metadata updated to Sentinel8004
- IPFS pinning restored and verified
- Dashboard: 3 pages live on GitHub Pages
- MCP server: all 3 tools verified with real data
- tag1 updated to "sentinel8004" for future writes

### Bugs Fixed (March 15)
1. **reputation.ts**: `readFeedback` called with index 0 but contract requires >= 1 (1-based). Fixed 0n -> 1n.
2. **liveness.ts**: Operator precedence bug in parking page detection. Fixed with parentheses.
3. **onchain.ts**: Added `.toLowerCase()` on tx.input for case safety.
4. **scan-results.json**: totalAgents was 1853 but reports had 1855 entries. Fixed.

### Known Limitations (documented, not bugs)
- On-chain attestations for agents #1849/#1850 have pre-fix scores (81/85). Immutable.
- First 1,852 attestations use tag1="agentguard" (immutable). New writes use "sentinel8004".
- First 1,852 attestations have empty feedbackURI (IPFS was broken). Pipeline now works.
- Wallet age for 100+ tx wallets may be underreported (uses 100-tx window, not full history).
- `HIGH_CONCENTRATION` flag (11-50 agents) has no circuit breaker by design.

### Live
- Dashboard: https://yonkoo11.github.io/sentinel8004/
- ReputationRegistry: https://celoscan.io/address/0x8004BAa17C55a88189AE136b182e5fdA19dE9b63
- GitHub: https://github.com/Yonkoo11/sentinel8004
