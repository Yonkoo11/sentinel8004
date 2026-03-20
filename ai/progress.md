# Sentinel8004 - Progress

## Status: POLISH PHASE (March 20, 2026)

## Last Session Summary
- **Date:** March 20, 2026
- **What was done:**
  - IPFS provider switched from Pinata (blocked) to Lighthouse.storage in src/ipfs.ts (code ready, needs API key)
  - Created scripts/trust-gate.ts — demo of another agent consuming Sentinel8004 trust data (tested: #132 SAFE, #50 DO NOT INTERACT)
  - MCP server fully tested via stdin pipe: all 3 tools return correct data (check_agent_trust, list_flagged_agents, get_agent_report)
  - Dashboard verified at 1280x800 (desktop) and 375x812 (mobile) — responsive, no overflow
  - Fixed stale "Scanned: 7 days ago" label to show absolute date
  - Added trust-gate demo section to README
  - Documented IPFS limitation in README Known Limitations
  - agent.json + agent_log.json committed and pushed
  - Synthesis update BLOCKED: API key lost (shown once at registration, not saved). Cannot add Open Track or update conversationLog.
  - Updated ai/memory.md to match current state

- **What was NOT done:**
  - IPFS pipeline NOT proven end-to-end (no Lighthouse API key yet)
  - No supplemental on-chain writes with feedbackURI
  - No video demo (screenshots taken but no shareable video)
  - Synthesis submission not updated (API key lost)

## What's Next
1. Get Lighthouse.storage API key → test IPFS pin → write supplemental batch with feedbackURI
2. Deploy updated dashboard to GitHub Pages (local changes pushed to main, Pages should auto-deploy)
3. Optional: screen recording for video demo

## Hackathon Submissions

### Build Agents V2 (deadline: March 22, 9am GMT)
1. ✅ Register project on Karma Gap
2. ✅ Join Telegram
3. ⬜ Self AI verification — deferred (no passport)
4. ✅ Tweet posted (single tweet with 8004scan link, agentscan agentId, tags)
5. ✅ Karma Gap form submitted — ref: APP-SGZ0Y1A7-V4XQWM (March 19, 12:58 PM)

### The Synthesis (deadline: March 22)
1. ✅ Registered — participantId: 8d8b221bbac34e76a05fd64c22ee934d
2. ✅ On-chain registration TX (Base): https://basescan.org/tx/0xa6cabdf09c5cdb70002b109236aa539595e061648f47cd7ca6859e33360feeb3
3. ✅ Project published — slug: sentinel8004-4cff
4. ✅ Self-custody transfer to 0x67FbCB8A3C9136eAA83A550ef0aA17a5549aFB52
5. ⬜ Update with Open Track + richer conversationLog — BLOCKED (API key lost)
6. Tracks: "Best Agent on Celo" ($5K) + "Agents With Receipts — ERC-8004" ($4K)

### Key URLs
- Dashboard: https://yonkoo11.github.io/sentinel8004/
- GitHub: https://github.com/Yonkoo11/sentinel8004
- agentscan: https://agentscan.info/api/agents?search=Sentinel8004
- 8004scan: https://8004scan.io/agents/celo/1853
- ReputationRegistry: https://celoscan.io/address/0x8004BAa17C55a88189AE136b182e5fdA19dE9b63
- Karma Gap: APP-SGZ0Y1A7-V4XQWM

### Verified This Session
- MCP server: all 3 tools return correct data via stdin pipe
- Dashboard: responsive at desktop (1280px) and mobile (375px)
- trust-gate.ts: tested with agents #132 and #50
- Scan data: 1,855 reports, Clenja #132 = 57, Sentinel8004 #1853 = 75

### Known Limitations (documented)
- All 1,854 on-chain attestations have empty feedbackURI (Pinata rate-limited, immutable)
- First 1,852 attestations use tag1="agentguard" (immutable)
- Pre-fix scores for agents #1849/#1850 (81/85) are immutable
- Self-feedback blocked by contract design
- Synthesis API key lost — cannot update submission
