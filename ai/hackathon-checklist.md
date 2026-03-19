# Sentinel8004 — Full Hackathon Checklist

## Two Hackathons (can participate in both and win from both)

### Hackathon 1: Build Agents for the Real World V2
- **Organizer:** CeloDevs / CeloPublicGoods
- **Total prizes:** $8,500 USDT
- **Deadline:** March 18, 2026, 9:00 AM GMT (VERIFIED — from @CeloPublicGoods tweet)
- **Registration:** Karma Gap at https://app.karmahq.xyz/celo/programs/1059/apply
- **Official brief:** Notion page at https://celoplatform.notion.site/Build-Agents-for-the-Real-World-Celo-Hackathon-V2-2fdd5cb803de80c99010c04b6902a3a9 (NOT fetchable programmatically — requires JavaScript)

#### Tracks:
| Track | Prizes | Our fit |
|-------|--------|---------|
| Best Agent on Celo | $3K / $2K / $1K | Strong — we ARE an agent on Celo |
| Best Agent Infra on Celo | $2K | Strong — trust scoring IS infra |
| Highest Rank on AgentScan | $500 | Weak — rank #80352, 0 feedback |

#### Steps (from @CeloPublicGoods tweet):
1. ✅ Register project on Karma Gap — DONE
2. ⬜ Verify via AgentScan at 8004scan.io — SEE NOTES
3. ⬜ Verify via Self Agent ID — SEE NOTES
4. ⬜ Post on X tagging @Celo + @CeloDevs + @CeloPublicGoods — draft ready
5. ⬜ Submit via Karma Gap form — content ready in karma-submission.md

---

### Hackathon 2: The Synthesis
- **Organizer:** Ethereum Foundation + partners (Celo is a partner)
- **Total prizes:** 109 prizes, $14.5K open track + partner tracks
- **Building:** March 13-22, 2026
- **Winners announced:** March 25, 2026
- **Registration:** API-based at https://synthesis.devfolio.co/register
- **Celo's page:** https://www.celopg.eco/programs/synthesis (informational only)

#### Relevant Tracks:
| Track | Company | 1st Place |
|-------|---------|-----------|
| Best Agent on Celo | Celo | $3,000 |
| Best Agent on Celo (2nd) | Celo | $2,000 |
| Agents With Receipts — ERC-8004 | Protocol Labs | $4,000 |
| Agents With Receipts — ERC-8004 (2nd) | Protocol Labs | $3,000 |
| Agents With Receipts — ERC-8004 (3rd) | Protocol Labs | $1,004 |
| Synthesis Open Track | Community | $14,558 |
| Best Self Agent ID Integration | Self | $1,000 |

#### Registration requirements (from skill.md):
- POST /register with: name, description, image, agentHarness, model, humanInfo
- humanInfo: name, email, socialMediaHandle, background, cryptoExperience, aiAgentExperience, codingComfort, problemToSolve
- Creates ERC-8004 identity on BASE Mainnet
- Returns apiKey (shown only once), participantId, teamId

#### Rules (from skill.md):
1. Ship something that works
2. Agent must be a real participant, not a wrapper
3. Everything on-chain counts
4. Open source required
5. Document process via conversationLog field

---

## Verification Steps — What We Know vs Don't Know

### "Verify via AgentScan at 8004scan.io"
**Verified:** Agent #1853 IS visible at https://8004scan.io/agents/celo/1853 with correct name/metadata.
**NOT verified:** What "verify" specifically means. 8004scan docs describe no verification process. Likely means "confirm agent is visible on 8004scan" but uncertain.

### "Verify via Self Agent ID"
**Verified:** Self Agent ID links agents to verified humans via passport scan + ZK proofs. Self is a sponsor.
**NOT verified:** Whether this is REQUIRED for Build Agents V2, or just encouraged. Process requires Self app + passport NFC scan.

---

## Open Questions

1. **Notion page**: Open the link in browser and share the exact requirements
2. **Self Agent ID**: Do you have the Self app + compatible passport?
3. **Synthesis registration**: Need your name, email, background for the API call
4. **8004scan**: Check if there's a "verify" or "claim" button when logged in with wallet

---

## Action Items

### Build Agents V2 (March 18):
1. READ Notion page in browser for exact requirements
2. Self Agent ID verification (if required)
3. Post on X with tags
4. Submit via Karma Gap form

### The Synthesis (March 22):
1. Provide humanInfo for registration
2. Register via API
3. Submit project via API (submissions opening soon)

### Optional:
- Update on-chain metadata description "1,838" → "1,854" (costs gas)
- Self Agent ID SDK integration for $1,000 Synthesis prize
