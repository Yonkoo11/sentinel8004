import { readFileSync } from 'node:fs';
import type { TrustReport } from './types.js';

interface ScanData {
  totalAgents: number;
  scannedAt: string;
  scanMode: string;
  reports: TrustReport[];
  ownerStats: Record<string, number>;
}

export function generateEcosystemReport(dataPath: string): string {
  const raw = readFileSync(dataPath, 'utf-8');
  const data: ScanData = JSON.parse(raw);
  const { reports } = data;

  const total = reports.length;
  const avg = Math.round(reports.reduce((s, r) => s + r.compositeScore, 0) / total);
  const trusted = reports.filter(r => r.compositeScore >= 70);
  const fair = reports.filter(r => r.compositeScore >= 30 && r.compositeScore < 70);
  const flagged = reports.filter(r => r.compositeScore < 30);

  // Owner analysis
  const ownerAgents: Record<string, TrustReport[]> = {};
  for (const r of reports) {
    (ownerAgents[r.owner] ||= []).push(r);
  }
  const owners = Object.entries(ownerAgents).sort((a, b) => b[1].length - a[1].length);
  const massRegistrars = owners.filter(([, agents]) => agents.length > 50);
  const spamAgentCount = massRegistrars.reduce((s, [, a]) => s + a.length, 0);

  // Flag analysis
  const allFlags: Record<string, number> = {};
  for (const r of reports) {
    for (const layer of r.layers) {
      for (const flag of layer.flags) {
        const key = flag.split(':')[0];
        allFlags[key] = (allFlags[key] || 0) + 1;
      }
    }
  }

  // Top agents
  const topAgents = [...reports].sort((a, b) => b.compositeScore - a.compositeScore).slice(0, 10);

  // Build report
  const lines: string[] = [];
  const ln = (s = '') => lines.push(s);

  ln(`# Celo ERC-8004 Agent Ecosystem Report`);
  ln(`Generated: ${data.scannedAt}`);
  ln(`Scan mode: ${data.scanMode}`);
  ln();
  ln(`## Summary`);
  ln();
  ln(`| Metric | Value |`);
  ln(`|--------|-------|`);
  ln(`| Total Agents | ${total.toLocaleString()} |`);
  ln(`| Average Trust Score | ${avg}/100 |`);
  ln(`| Trusted (70+) | ${trusted.length} (${((trusted.length/total)*100).toFixed(1)}%) |`);
  ln(`| Fair (30-69) | ${fair.length} (${((fair.length/total)*100).toFixed(1)}%) |`);
  ln(`| Flagged (<30) | ${flagged.length} (${((flagged.length/total)*100).toFixed(1)}%) |`);
  ln(`| Unique Owners | ${owners.length} |`);
  ln(`| Mass Registrars (50+ agents) | ${massRegistrars.length} |`);
  ln(`| Agents from Mass Registrars | ${spamAgentCount.toLocaleString()} (${((spamAgentCount/total)*100).toFixed(1)}%) |`);
  ln();

  ln(`## Risk Flags`);
  ln();
  ln(`| Flag | Count | % of Registry |`);
  ln(`|------|-------|---------------|`);
  for (const [flag, count] of Object.entries(allFlags).sort((a, b) => b[1] - a[1])) {
    ln(`| ${flag} | ${count.toLocaleString()} | ${((count/total)*100).toFixed(1)}% |`);
  }
  ln();

  ln(`## Top 10 Agents`);
  ln();
  ln(`| Rank | ID | Name | Score | Owner |`);
  ln(`|------|----|------|-------|-------|`);
  for (let i = 0; i < topAgents.length; i++) {
    const r = topAgents[i];
    ln(`| ${i+1} | #${r.agentId} | ${r.name} | ${r.compositeScore}/100 | ${r.owner.slice(0,10)}... |`);
  }
  ln();

  ln(`## Mass Registrar Analysis`);
  ln();
  if (massRegistrars.length === 0) {
    ln(`No mass registrars found (50+ agents from single owner).`);
  } else {
    ln(`| Owner | Agent Count | Avg Score | Sample Names |`);
    ln(`|-------|-------------|-----------|-------------|`);
    for (const [owner, agents] of massRegistrars) {
      const avgScore = Math.round(agents.reduce((s, a) => s + a.compositeScore, 0) / agents.length);
      const names = agents.slice(0, 3).map(a => a.name).join(', ');
      ln(`| ${owner.slice(0,10)}... | ${agents.length} | ${avgScore}/100 | ${names} |`);
    }
  }
  ln();

  ln(`## Methodology`);
  ln();
  ln(`Sentinel8004 v2 scores agents across 5 independent layers with circuit breakers:`);
  ln();
  ln(`1. **Registration Quality (0-25, weighted 0.8x)**: Metadata completeness, placeholder detection`);
  ln(`2. **Endpoint Liveness (0-25, weighted 0.8x)**: HTTP probes, .well-known domain verification`);
  ln(`3. **On-Chain Behavior (0-25, weighted 0.8x)**: Wallet age, tx history, approvals via Blockscout`);
  ln(`4. **Sybil/Spam Detection (0-25, weighted 1.0x)**: Owner concentration, metadata similarity, naming patterns`);
  ln(`5. **Existing Reputation (0-15, weighted 1.0x)**: On-chain feedback from ReputationRegistry clients`);
  ln();
  ln(`### Circuit Breakers`);
  ln(`Critical flags cap the maximum score regardless of other layers:`);
  ln(`- MASS_REGISTRATION (50+ agents from one owner) → capped at 15/100`);
  ln(`- METADATA_CLONE (>80% metadata similarity) → capped at 25/100`);
  ln(`- NEGATIVE_REPUTATION (net negative on-chain feedback) → capped at 30/100`);
  ln(`- ALL_ENDPOINTS_DEAD → capped at 35/100`);
  ln(`- NO_METADATA → capped at 20/100`);
  ln();
  ln(`### Design Principles`);
  ln(`- **No neutral inflation**: Missing data scores 0, not middle-of-range. Unknown is not positive.`);
  ln(`- **Security layers weighted higher**: Sybil detection and reputation carry full weight; metadata checks are weighted 0.8x because they're easy to game.`);
  ln(`- **Confidence levels**: Each score carries high/medium/low confidence based on how many layers had real data to evaluate.`);
  ln(`- **Deterministic**: All checks are reproducible. No LLM in the scoring pipeline.`);
  ln();
  ln(`### Adversarial Analysis`);
  ln(`We openly document how each layer can be gamed and what it costs:`);
  ln();
  ln(`| Layer | Gaming Cost | What It Proves | What It Doesn't Prove |`);
  ln(`|-------|-------------|----------------|----------------------|`);
  ln(`| L1 Registration | Free (write good JSON) | Someone filled in fields | Agent does what it claims |`);
  ln(`| L2 Liveness | ~$5/mo (any server) | A server responds | Server does anything useful |`);
  ln(`| L3 On-Chain | ~$10+ (fund wallet, make txs) | Wallet has history | Wallet belongs to a real agent |`);
  ln(`| L4 Sybil | High (need many wallets + varied metadata) | Owner isn't mass-registering | Coordination between owners |`);
  ln(`| L5 Reputation | Very High (need independent clients to vouch) | Other clients trust this agent | Clients aren't colluding |`);
  ln();
  ln(`The scoring system is designed so that the cheapest-to-game layers (L1, L2) carry the least weight, while the hardest-to-game layers (L4, L5) carry the most.`);
  ln(`Circuit breakers ensure that a single strong negative signal can't be drowned out by easy positive signals.`);
  ln();
  ln(`### Known Limitations`);
  ln(`- Single-snapshot scoring; no longitudinal tracking yet`);
  ln(`- L4 Sybil detection is address-based; multi-wallet Sybils are not detected`);
  ln(`- L2 probes check liveness, not functionality`);
  ln(`- L5 depends on existing ReputationRegistry adoption`);
  ln();
  ln(`---`);
  ln(`*Generated by [Sentinel8004](https://github.com/Yonkoo11/sentinel8004) - Autonomous ERC-8004 Trust Scoring Agent*`);

  return lines.join('\n');
}
