/**
 * threshold-analysis.ts - Analyzes the actual owner distribution to justify Sybil thresholds.
 *
 * Answers: Do the thresholds (<=3 normal, 4-10 moderate, 11-50 high, 50+ mass)
 * align with natural breaks in the data?
 *
 * Usage: npx tsx scripts/threshold-analysis.ts
 */

import { readFileSync } from 'node:fs';

const data = JSON.parse(readFileSync('data/scan-results.json', 'utf-8'));
const reports = data.reports as Array<{
  agentId: number;
  owner: string;
  compositeScore: number;
  layers: Array<{ layer: string; score: number; maxScore: number; details: string[]; flags: string[] }>;
}>;

// Build owner distribution
const ownerCounts = new Map<string, number>();
for (const r of reports) {
  ownerCounts.set(r.owner, (ownerCounts.get(r.owner) || 0) + 1);
}

const counts = [...ownerCounts.values()].sort((a, b) => a - b);
const totalOwners = counts.length;

// Histogram: how many owners have 1, 2, 3, ..., N agents
const histogram = new Map<number, number>();
for (const c of counts) {
  const bucket = c > 50 ? 51 : c;
  histogram.set(bucket, (histogram.get(bucket) || 0) + 1);
}

console.log('=== Sybil Threshold Analysis ===\n');
console.log(`Total agents: ${reports.length}`);
console.log(`Unique owners: ${totalOwners}\n`);

console.log('Owner Distribution (agents per owner):');
console.log('─'.repeat(60));

const buckets = [...histogram.entries()].sort((a, b) => a[0] - b[0]);
for (const [agentCount, ownerCount] of buckets) {
  const label = agentCount === 51 ? '51+' : String(agentCount);
  const bar = '#'.repeat(Math.min(50, Math.ceil(ownerCount / Math.max(1, totalOwners / 50))));
  const totalAgents = agentCount === 51
    ? counts.filter(c => c > 50).reduce((a, b) => a + b, 0)
    : agentCount * ownerCount;
  console.log(`  ${label.padStart(3)} agents: ${String(ownerCount).padStart(4)} owners (${totalAgents.toLocaleString()} agents total) ${bar}`);
}

// Threshold analysis
const brackets = [
  { label: '1-3 (normal)', min: 1, max: 3 },
  { label: '4-10 (moderate)', min: 4, max: 10 },
  { label: '11-50 (high)', min: 11, max: 50 },
  { label: '51+ (mass)', min: 51, max: Infinity },
];

console.log('\nThreshold Brackets:');
console.log('─'.repeat(70));

for (const bracket of brackets) {
  const owners = [...ownerCounts.entries()].filter(([, c]) => c >= bracket.min && c <= bracket.max);
  const agentCount = owners.reduce((sum, [, c]) => sum + c, 0);

  // Average L1 score (metadata quality) for agents in this bracket
  const bracketOwnerSet = new Set(owners.map(([addr]) => addr));
  const bracketReports = reports.filter(r => bracketOwnerSet.has(r.owner));
  const l1Scores = bracketReports
    .map(r => r.layers.find(l => l.layer === 'registration'))
    .filter(Boolean)
    .map(l => l!.score);
  const avgL1 = l1Scores.length > 0 ? (l1Scores.reduce((a, b) => a + b, 0) / l1Scores.length).toFixed(1) : 'N/A';

  console.log(`  ${bracket.label.padEnd(18)} ${String(owners.length).padStart(4)} owners, ${String(agentCount).padStart(5)} agents, avg L1 metadata: ${avgL1}/25`);
}

// Natural break analysis: find gaps in the distribution
console.log('\nNatural Breaks (gaps in owner-count distribution):');
console.log('─'.repeat(50));
const sortedCounts = [...new Set(counts)].sort((a, b) => a - b);
for (let i = 1; i < sortedCounts.length; i++) {
  const gap = sortedCounts[i] - sortedCounts[i - 1];
  if (gap > 2 && sortedCounts[i - 1] <= 100) {
    console.log(`  Gap: ${sortedCounts[i - 1]} → ${sortedCounts[i]} (jump of ${gap})`);
  }
}

// Key findings
const singleOwners = histogram.get(1) || 0;
const pctSingle = ((singleOwners / totalOwners) * 100).toFixed(1);
const massOwners = [...ownerCounts.entries()].filter(([, c]) => c > 50);
const massAgents = massOwners.reduce((sum, [, c]) => sum + c, 0);

console.log(`\nKey Findings:`);
console.log(`  - ${pctSingle}% of owners (${singleOwners}/${totalOwners}) have exactly 1 agent`);
console.log(`  - ${massOwners.length} owner(s) have 51+ agents, accounting for ${massAgents} agents (${((massAgents / reports.length) * 100).toFixed(1)}% of all agents)`);
console.log(`  - Current thresholds ${sortedCounts.length > 10 ? 'align with' : 'may not align with'} natural distribution breaks`);
