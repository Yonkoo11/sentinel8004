import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';

const INPUT = 'data/scan-results.json';
const OUTPUT = 'dashboard/data/scores.json';

const raw = readFileSync(INPUT, 'utf-8');
const data = JSON.parse(raw);

// Transform for dashboard consumption
const output = {
  totalAgents: data.totalAgents,
  scannedAt: data.scannedAt,
  scanMode: data.scanMode || 'unknown',
  reports: data.reports.map((r: any) => ({
    agentId: r.agentId,
    owner: r.owner,
    name: r.name,
    compositeScore: r.compositeScore,
    confidence: r.confidence,
    layers: r.layers,
    circuitBreakers: r.circuitBreakers,
    errors: r.errors,
  })),
};

mkdirSync('dashboard/data', { recursive: true });
writeFileSync(OUTPUT, JSON.stringify(output, null, 2));
console.log(`Dashboard data written to ${OUTPUT} (${output.reports.length} agents)`);
