/**
 * Merge multiple scan-results files into one.
 * Usage: npx tsx scripts/merge-scans.ts file1.json file2.json [--output merged.json]
 *
 * When agents appear in multiple files, the later file wins.
 * This lets you combine a L1-only scan of old agents with a smart scan of new agents.
 */
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';

const args = process.argv.slice(2);
const outputIdx = args.indexOf('--output');
const outputPath = outputIdx >= 0 ? args[outputIdx + 1] : 'data/scan-results.json';
const inputFiles = args.filter((_, i) => i !== outputIdx && i !== outputIdx + 1);

if (inputFiles.length < 2) {
  console.error('Usage: npx tsx scripts/merge-scans.ts file1.json file2.json [--output merged.json]');
  process.exit(1);
}

const reportMap = new Map<number, any>();
let latestMeta = { totalAgents: 0, scannedAt: '', scanMode: '', ownerStats: {} as any };

for (const file of inputFiles) {
  console.log(`Reading ${file}...`);
  const data = JSON.parse(readFileSync(file, 'utf-8'));

  // Later files override earlier ones
  latestMeta.totalAgents = Math.max(latestMeta.totalAgents, data.totalAgents || 0);
  latestMeta.scannedAt = data.scannedAt || latestMeta.scannedAt;
  latestMeta.scanMode = `merged (${data.scanMode || 'unknown'})`;

  // Merge owner stats
  if (data.ownerStats) {
    for (const [owner, count] of Object.entries(data.ownerStats)) {
      const existing = (latestMeta.ownerStats[owner] as number) || 0;
      latestMeta.ownerStats[owner] = Math.max(existing, count as number);
    }
  }

  for (const report of data.reports) {
    reportMap.set(report.agentId, report);
  }
  console.log(`  ${data.reports.length} reports loaded`);
}

const mergedReports = Array.from(reportMap.values()).sort((a, b) => a.agentId - b.agentId);

const output = {
  totalAgents: latestMeta.totalAgents,
  scannedAt: new Date().toISOString(),
  scanMode: latestMeta.scanMode,
  reports: mergedReports,
  ownerStats: latestMeta.ownerStats,
};

mkdirSync('data', { recursive: true });
writeFileSync(outputPath, JSON.stringify(output, null, 2));
console.log(`\nMerged ${mergedReports.length} reports → ${outputPath}`);
console.log(`Agent range: #${mergedReports[0].agentId} - #${mergedReports[mergedReports.length - 1].agentId}`);
