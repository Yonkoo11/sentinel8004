# Sentinel8004 - Progress

## Status: SCANNING NEW AGENTS (March 20, 2026, Session 3)

## What's Done This Session

### Session 2 (completed)
- Fixed 15 issues across code, dashboard, docs (commit af1320d, pushed)
- IPFS hash mismatch, writer IPFS enforcement, MCP paths, L5 reputation, ownerOf, dashboard hardcoded numbers, OG image, README, agent_log.json, package.json version

### Session 3 (current)
1. **Committed and pushed** all session 2 fixes (af1320d)
2. **Added `--output` flag** to scanner CLI for parallel scans
3. **Created merge script** at `scripts/merge-scans.ts`
4. **Old agents scan complete** — `data/scan-old.json`: 1,860 reports (L1-only, agents #1-1860)
5. **New agents smart scan IN PROGRESS** — background PID running, writing to `data/scan-results.json` (agents #1859-2902+, smart mode with L2-L5)
   - At 260/1044 as of last check, ~55 min remaining
   - Most new agents are a spam cluster scoring 15/100
6. **Updated hackathon-draft.md** — counts to 2,900+, tracks to include Open Track
7. **Verified GitHub Pages** — deploys from `dashboard/` via Actions workflow, triggers on `dashboard/**` pushes

## What's In Progress
- **Background smart scan** running for agents 1859-2902+ (PID from `nohup` in /tmp/sentinel-scan.log)

## What's Next (after smart scan finishes)
1. **Merge scans**: `npx tsx scripts/merge-scans.ts data/scan-old.json data/scan-results.json`
2. **Write new attestations**: `npx tsx src/index.ts write --own-agent-id 1853`
   - Budget: 4.39 CELO = ~731 writes at 0.006 CELO each
   - Writer auto-skips already-scored agents (1-1858 already on-chain)
   - Need LIGHTHOUSE_API_KEY or PINATA_JWT for IPFS
3. **Regenerate dashboard**: `npx tsx scripts/generate-dashboard.ts`
4. **Commit + push** — triggers GitHub Pages deploy
5. **Update agent_log.json** with batch 3 stats
6. **Synthesis API key** — User needs to recover from nsb.dev/synthesis-chat or @synthesis_md
   - Need key to update tracks (add Open Track) and conversation log
   - Project UUID: 44047eed8b3545f28c33779685d88e00
   - Track UUIDs: ff26ab4933c84eea856a5c6bf513370b (Celo), 3bf41be958da497bbb69f1a150c76af9 (ERC-8004), fdb76d08812b43f6a5f454744b66f590 (Open)

## Synthesis Update
- Team confirmed: "You can ask your agent to modify tracks. Changes are allowed till the deadline."
- API key still lost. User should ask at nsb.dev/synthesis-chat or DM @synthesis_md
- Project UUID: 44047eed8b3545f28c33779685d88e00
- Current tracks: Best Agent on Celo + Agents With Receipts (missing: Open Track)

## Key Credentials
- Synthesis participantId: 8d8b221bbac34e76a05fd64c22ee934d
- Synthesis project UUID: 44047eed8b3545f28c33779685d88e00
- Synthesis slug: sentinel8004-4cff
- Synthesis teamUUID: a6c9ac11ae7040b6905ebc96a6d05e4f
- Karma Gap ref: APP-SGZ0Y1A7-V4XQWM
- User wallet: 0x67FbCB8A3C9136eAA83A550ef0aA17a5549aFB52
- Celo agent: #1853
- Writer address: 0xf9946775891a24462cD4ec885d0D4E2675C84355

## Agent Count
- Celo IdentityRegistry: 2,904 agents (as of this session)
- Previously scanned: 1-1858
- Currently scanning: 1859-2904 (smart mode, background)
- On-chain attestations: 1,857 (1,854 without IPFS + 3 with IPFS)
