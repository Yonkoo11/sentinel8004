# Sentinel8004 - Progress

## Status: CRITICAL FIXES APPLIED (March 20, 2026, Session 2)

## What Was Done This Session

### Code Fixes (all verified, tsc --noEmit clean)
1. **IPFS hash mismatch fixed** — `src/ipfs.ts`: Pinata now uses `pinFileToIPFS` with raw JSON bytes (same as Lighthouse), ensuring CID matches `feedbackHash` on-chain
2. **Writer blocks on IPFS failure** — `src/writer.ts`: IPFS pin failure now skips the agent instead of writing with empty feedbackURI. Enforces CLAUDE.md rule.
3. **MCP server absolute paths** — `src/mcp-server.ts`: Uses `import.meta.url` to resolve `data/scan-results.json` relative to project root, works from any cwd
4. **MCP input validation** — agentId validated as positive integer, limit capped at 100
5. **L5 reputation uses getLastIndex** — `src/layers/reputation.ts`: Reads most recent feedback per client instead of hardcoded index 1n
6. **ownerOf propagates RPC errors** — `src/chain.ts`: Only returns null for ERC-721 "nonexistent token" reverts, throws on network errors
7. **findTotalAgents fails safely** — `src/scanner.ts`: Wraps ownerOf in safeOwnerOf that throws fatal error on RPC failures during enumeration

### Dashboard Fixes
8. **Removed all hardcoded numbers** — Meta tags, OG tags, footer now dynamic. spam-pct default changed from "98.3%" to "..."
9. **OG image converted to PNG** — 1200x630 PNG (was SVG, which doesn't render on Twitter/Discord)
10. **rel="noopener noreferrer"** added to all target="_blank" links (index, registry, methodology)
11. **Error handler fixed** — Appends to `.hero-left` (was `.hero-content` which doesn't exist)
12. **Footer attestation count dynamic** — `<span id="footer-attestations">...</span>` populated by JS
13. **`<main>` landmark added** to registry.html and methodology.html
14. **Skip link target fixed** — registry.html now targets `<table>` not `<tbody>`
15. **Meta descriptions** — removed hardcoded counts from all 3 pages

### Documentation Fixes
16. **README tag1 honest** — Documents that first 1,852 attestations use "agentguard" (immutable), not "sentinel8004"
17. **README counts updated** — No more hardcoded 1,855, uses "2,800+" or "1,857+"
18. **agent_log.json rewritten** — Real tx hashes, gas data, failure details, 3 specific batch2 transactions with CIDs
19. **Version mismatch fixed** — package.json now 0.2.0 (matches agent.json)

## What's Next
1. **Scan agents 1859-2881** — ~1,023 new agents. Run `scan --start 1859 --max 1100`
2. **Write new attestations with IPFS** — All new writes get proper feedbackURI
3. **Regenerate dashboard** — Include all data
4. **Check CELO balance** — Need ~6 CELO for writes
5. **Commit and push** all fixes
6. **Synthesis API key** — Ask in nsb.dev/synthesis-chat for key recovery

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
