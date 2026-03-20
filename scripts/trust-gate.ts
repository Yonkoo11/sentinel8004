/**
 * trust-gate.ts - Demonstrates how another agent would consume Sentinel8004's
 * trust data before deciding whether to interact with an ERC-8004 agent.
 *
 * This is the core value proposition: any agent in the Celo ecosystem can query
 * Sentinel8004's scan results (via MCP or direct file read) and gate interactions
 * based on trust scores, flags, and circuit breakers.
 *
 * Usage: npx tsx scripts/trust-gate.ts <agentId>
 */

import { readFileSync } from 'fs';
import { join } from 'path';
import type { ScanResult, TrustReport } from '../src/types.js';

const SCAN_PATH = join(import.meta.dirname!, '..', 'data', 'scan-results.json');

function decide(score: number): { label: string; color: string } {
  if (score >= 50) return { label: 'SAFE to interact', color: '\x1b[32m' };
  if (score >= 30) return { label: 'PROCEED WITH CAUTION', color: '\x1b[33m' };
  return { label: 'DO NOT INTERACT', color: '\x1b[31m' };
}

function printReport(report: TrustReport): void {
  const reset = '\x1b[0m';
  const bold = '\x1b[1m';
  const dim = '\x1b[2m';
  const { label, color } = decide(report.compositeScore);

  const allFlags = report.layers.flatMap(l => l.flags);
  const breakers = report.circuitBreakers;

  console.log(`\n${bold}--- Sentinel8004 Trust Gate ---${reset}\n`);
  console.log(`  Agent:      #${report.agentId} ${report.name}`);
  console.log(`  Owner:      ${report.owner}`);
  console.log(`  Score:      ${report.compositeScore}/100`);
  console.log(`  Confidence: ${report.confidence}`);

  if (allFlags.length > 0) {
    console.log(`  Flags:      ${allFlags.join(', ')}`);
  }
  if (breakers.length > 0) {
    console.log(`  ${dim}Breakers:   ${breakers.join('; ')}${reset}`);
  }

  console.log(`\n  Layers:`);
  for (const l of report.layers) {
    console.log(`    ${l.layer.padEnd(14)} ${l.score}/${l.maxScore}`);
  }

  console.log(`\n  ${color}${bold}Decision: ${label}${reset}\n`);
}

// --- main ---
const agentId = Number(process.argv[2]);
if (!agentId || isNaN(agentId)) {
  console.error('Usage: npx tsx scripts/trust-gate.ts <agentId>');
  process.exit(1);
}

const data: ScanResult = JSON.parse(readFileSync(SCAN_PATH, 'utf-8'));
const report = data.reports.find(r => r.agentId === agentId);

if (!report) {
  console.error(`Agent #${agentId} not found in scan results (${data.totalAgents} agents scanned).`);
  process.exit(1);
}

printReport(report);
