import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';

const INPUT = 'data/scan-results.json';
const OUTPUT = 'dashboard/data/scores.json';

const raw = readFileSync(INPUT, 'utf-8');
const data = JSON.parse(raw);

// Try to load write results for on-chain stats
let onchainWritten = 0;
try {
  const writeData = JSON.parse(readFileSync('data/write-results.json', 'utf-8'));
  // Count both newly written and already-scored (both exist on-chain)
  onchainWritten = writeData.filter((r: any) =>
    (r.txHash && !r.error) || r.skipReason === 'already-scored'
  ).length;
} catch {
  // No write results yet, that's fine
}

// Transform for dashboard consumption
const output = {
  totalAgents: Math.max(data.totalAgents || 0, data.reports.length),
  scannedAt: data.scannedAt,
  scanMode: data.scanMode || 'unknown',
  onchainStats: {
    written: onchainWritten,
    total: data.totalAgents || data.reports.length,
    writerAddress: '0xf9946775891a24462cD4ec885d0D4E2675C84355',
    contractAddress: '0x8004BAa17C55a88189AE136b182e5fdA19dE9b63',
  },
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
