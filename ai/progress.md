# Sentinel8004 - Progress

## Status: CRITIQUE FIXES IN PROGRESS (March 20, 2026, Session 4)

## What's Done This Session

### Critique-Driven Fixes
1. **Canonical JSON serialization** - Added `canonicalJSON()` to utils.ts, used in writer.ts and ipfs.ts. Fixes feedbackHash determinism issue (JSON.stringify key order not guaranteed).
2. **Worked example on methodology page** - Two real agents: Toppa #1870 (95/100, clean) and Scarlet Orbit #1900 (15/100, MASS_REGISTRATION breaker). Shows exact layer math.
3. **IPFS report links in registry** - Updated generate-dashboard.ts to include CID map from write-results.json. Registry detail view shows "IPFS Report" link when CID available.
4. **Search debounce** - 200ms debounce on registry search input.
5. **Cost/tx corrected** - Updated from ~0.006 to ~0.009 CELO everywhere (index.html, methodology.html, CLAUDE.md).

### On-Chain Writes (STILL RUNNING)
- Background writer at #2206/2902 as of last check
- Balance: 23.68 CELO (plenty for all remaining agents)
- All new writes include IPFS pinning (Lighthouse)
- 334+ IPFS CIDs so far

## What's Next
1. **Wait for writes to complete** - check `tail -2 /tmp/sentinel-write.log`
2. **Regenerate dashboard** - `npx tsx scripts/generate-dashboard.ts` (will include IPFS CIDs)
3. **Commit + push all changes** - critique fixes + updated dashboard
4. **Verify dashboard live** - check GitHub Pages deployment
5. **Update hackathon draft** with final numbers

## Critique Issues Addressed
- [x] feedbackHash non-determinism (canonical JSON)
- [x] No worked example on methodology page
- [x] No per-agent IPFS links in registry
- [x] No search debounce
- [x] Wrong cost/tx number (0.006 vs 0.009)

## Critique Issues NOT Addressed (documented trade-offs)
- [ ] 3.5MB scores.json (pagination would help, but 2,902 agents loads in <2s on modern connections)
- [ ] Nonce desync risk (sequential writes avoid this; a full recovery system is over-engineering for hackathon)
- [ ] Multi-wallet Sybil bypass (documented in methodology Known Limitations)
- [ ] Zero tests (time trade-off: on-chain writes are more impactful for judges)
- [ ] Weight calibration (documented as intuition-based in methodology, honest about it)
- [ ] Zero adoption evidence (would need another builder to integrate, can't force this)

## Key Numbers
- Celo IdentityRegistry: 2,904+ agents
- Scanned: 2,902 agents
- On-chain attestations: ~2,200+ and counting (batch 3 with IPFS)
- Balance: ~23.68 CELO
- Gas cost: ~0.009 CELO per write

## Key Credentials
- Synthesis participantId: 8d8b221bbac34e76a05fd64c22ee934d
- Synthesis project UUID: 44047eed8b3545f28c33779685d88e00
- Synthesis slug: sentinel8004-4cff
- Synthesis teamUUID: a6c9ac11ae7040b6905ebc96a6d05e4f
- Karma Gap ref: APP-SGZ0Y1A7-V4XQWM
- User wallet: 0x67FbCB8A3C9136eAA83A550ef0aA17a5549aFB52
- Celo agent: #1853
- Writer address: 0xf9946775891a24462cD4ec885d0D4E2675C84355
