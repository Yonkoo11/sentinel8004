/**
 * weight-sensitivity.ts - Measures how score rankings change under different weight configs.
 *
 * Computes Spearman's rank correlation between current weights and 4 alternatives
 * to answer: "Do the weights actually matter, or do circuit breakers dominate?"
 *
 * Usage: npx tsx scripts/weight-sensitivity.ts
 */

import { readFileSync } from 'node:fs';

const data = JSON.parse(readFileSync('data/scan-results.json', 'utf-8'));
const reports = data.reports as Array<{
  agentId: number;
  compositeScore: number;
  layers: Array<{ layer: string; score: number; maxScore: number; flags: string[] }>;
  circuitBreakers: string[];
}>;

const CIRCUIT_BREAKERS: Record<string, number> = {
  MASS_REGISTRATION: 15,
  ALL_ENDPOINTS_DEAD: 35,
  METADATA_CLONE: 25,
  NEGATIVE_REPUTATION: 30,
  NO_METADATA: 20,
};

const CONFIGS: Record<string, Record<string, number>> = {
  current:        { registration: 0.8, liveness: 0.8, onchain: 0.8, sybil: 1.0, reputation: 1.0 },
  equal:          { registration: 1.0, liveness: 1.0, onchain: 1.0, sybil: 1.0, reputation: 1.0 },
  sybil_heavy:    { registration: 0.6, liveness: 0.6, onchain: 0.6, sybil: 1.0, reputation: 1.0 },
  metadata_heavy: { registration: 1.0, liveness: 0.8, onchain: 0.8, sybil: 0.8, reputation: 0.8 },
  liveness_heavy: { registration: 0.8, liveness: 1.0, onchain: 0.8, sybil: 0.8, reputation: 0.8 },
};

function scoreWithWeights(
  layers: Array<{ layer: string; score: number; flags: string[] }>,
  weights: Record<string, number>
): number {
  let rawScore = 0;
  for (const l of layers) {
    rawScore += l.score * (weights[l.layer] ?? 1.0);
  }

  const allFlags = layers.flatMap(l => l.flags).map(f => f.split(':')[0]);
  let cap = 100;
  for (const flag of allFlags) {
    const breakerCap = CIRCUIT_BREAKERS[flag];
    if (breakerCap !== undefined && breakerCap < cap) cap = breakerCap;
  }

  return Math.round(Math.min(rawScore, cap));
}

function spearmanRho(a: number[], b: number[]): number {
  const n = a.length;
  if (n < 2) return 1;

  function rank(arr: number[]): number[] {
    const sorted = arr.map((v, i) => ({ v, i })).sort((x, y) => y.v - x.v);
    const ranks = new Array(n);
    for (let i = 0; i < n; i++) {
      ranks[sorted[i].i] = i + 1;
    }
    return ranks;
  }

  const ranksA = rank(a);
  const ranksB = rank(b);
  let dSqSum = 0;
  for (let i = 0; i < n; i++) {
    const d = ranksA[i] - ranksB[i];
    dSqSum += d * d;
  }
  return 1 - (6 * dSqSum) / (n * (n * n - 1));
}

// Compute scores for each config
const results: Record<string, { scores: number[]; trusted: number; fair: number; flagged: number }> = {};

for (const [name, weights] of Object.entries(CONFIGS)) {
  const scores = reports.map(r => scoreWithWeights(r.layers, weights));
  results[name] = {
    scores,
    trusted: scores.filter(s => s >= 70).length,
    fair: scores.filter(s => s >= 30 && s < 70).length,
    flagged: scores.filter(s => s < 30).length,
  };
}

const currentScores = results.current.scores;

console.log('=== Weight Sensitivity Analysis ===\n');
console.log(`Agents analyzed: ${reports.length}\n`);

console.log('Config                | Weights (L1-L5)         | Trusted | Fair  | Flagged | Spearman rho');
console.log('─'.repeat(95));

for (const [name, res] of Object.entries(results)) {
  const weights = CONFIGS[name];
  const wStr = [weights.registration, weights.liveness, weights.onchain, weights.sybil, weights.reputation]
    .map(w => w.toFixed(1)).join(', ');
  const rho = name === 'current' ? '1.0000' : spearmanRho(currentScores, res.scores).toFixed(4);
  console.log(
    `${name.padEnd(22)}| [${wStr}] | ${String(res.trusted).padStart(7)} | ${String(res.fair).padStart(5)} | ${String(res.flagged).padStart(7)} | ${rho}`
  );
}

// Key insight
const rhos = Object.entries(results)
  .filter(([name]) => name !== 'current')
  .map(([, res]) => spearmanRho(currentScores, res.scores));
const minRho = Math.min(...rhos);

console.log(`\nKey insight: ${minRho > 0.95
  ? `All rank correlations > 0.95. Circuit breakers dominate; weight choice has minimal impact on rankings.`
  : minRho > 0.85
    ? `Rank correlations range ${minRho.toFixed(4)}-${Math.max(...rhos).toFixed(4)}. Weights matter moderately.`
    : `Rank correlations as low as ${minRho.toFixed(4)}. Weights significantly impact rankings and need justification.`
}`);
