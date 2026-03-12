import 'dotenv/config';
import { writeFileSync, mkdirSync } from 'node:fs';
import { enumerateAgents, findTotalAgents } from './scanner.js';
import { scoreAgent, buildOwnerProfiles } from './scorer.js';
import { scoreRegistration } from './layers/registration.js';
import { writeFeedback } from './writer.js';
import { startMCPServer } from './mcp-server.js';
import type { AgentRecord, TrustReport, LayerScore } from './types.js';

const RESULTS_DIR = 'data';

async function scan(args: string[]) {
  const maxAgents = getArgValue(args, '--max');
  const startFrom = getArgValue(args, '--start') || 1;
  const layer1Only = args.includes('--layer1');
  const skipMetadata = args.includes('--skip-metadata');

  console.log('=== AgentGuard Scanner ===');
  console.log(`Mode: ${layer1Only ? 'Layer 1 only' : 'Full scan'}`);
  if (maxAgents) console.log(`Max agents: ${maxAgents}`);

  const agents = await enumerateAgents({
    maxAgents,
    startFrom,
    skipMetadata,
  });

  console.log(`\nScanned ${agents.length} agents`);

  // Owner concentration stats
  const ownerCounts: Record<string, number> = {};
  for (const agent of agents) {
    ownerCounts[agent.owner] = (ownerCounts[agent.owner] || 0) + 1;
  }
  const uniqueOwners = Object.keys(ownerCounts).length;
  const topOwners = Object.entries(ownerCounts)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5);

  console.log(`\nUnique owners: ${uniqueOwners}`);
  console.log('Top owners:');
  for (const [owner, count] of topOwners) {
    console.log(`  ${owner.slice(0, 10)}... → ${count} agents`);
  }

  // Metadata format distribution
  const formatCounts: Record<string, number> = {};
  for (const agent of agents) {
    formatCounts[agent.metadataFormat] = (formatCounts[agent.metadataFormat] || 0) + 1;
  }
  console.log('\nMetadata formats:');
  for (const [format, count] of Object.entries(formatCounts)) {
    console.log(`  ${format}: ${count}`);
  }

  // Scoring
  if (!skipMetadata) {
    const reports: TrustReport[] = [];
    const skipLiveness = args.includes('--skip-liveness');
    const skipOnchain = args.includes('--skip-onchain');

    if (layer1Only) {
      // Fast mode: Layer 1 only (sync, no network calls)
      console.log('\n=== Layer 1 Only: Registration Quality ===');
      for (const agent of agents) {
        const l1 = scoreRegistration(agent);
        reports.push({
          agentId: agent.agentId,
          owner: agent.owner,
          name: agent.metadata?.name || 'Unknown',
          compositeScore: l1.score,
          layers: [l1],
          scannedAt: new Date().toISOString(),
          reportVersion: 'trust-v1',
          errors: agent.metadataError ? [agent.metadataError] : [],
        });
      }
    } else {
      // Full scan: all 4 layers
      console.log('\n=== Full 4-Layer Scoring ===');
      if (skipLiveness) console.log('  (skipping L2 liveness probes)');
      if (skipOnchain) console.log('  (skipping L3 on-chain analysis)');

      // Pre-compute owner profiles for Sybil detection (L4)
      const ownerProfileMap = buildOwnerProfiles(agents);
      console.log(`Owner profiles built: ${ownerProfileMap.size} unique owners`);

      // Score each agent sequentially (L2/L3 make network calls)
      for (let i = 0; i < agents.length; i++) {
        const agent = agents[i];
        const progress = `[${i + 1}/${agents.length}]`;
        try {
          const report = await scoreAgent(agent, ownerProfileMap, {
            skipLiveness,
            skipOnchain,
          });
          reports.push(report);
          const flagCount = report.layers.reduce((sum, l) => sum + l.flags.length, 0);
          console.log(`${progress} #${agent.agentId} "${report.name}" → ${report.compositeScore}/100${flagCount > 0 ? ` (${flagCount} flags)` : ''}`);
        } catch (e) {
          console.error(`${progress} #${agent.agentId} FAILED: ${(e as Error).message}`);
          // Push a minimal report so we don't lose the agent
          reports.push({
            agentId: agent.agentId,
            owner: agent.owner,
            name: agent.metadata?.name || 'Unknown',
            compositeScore: 0,
            layers: [],
            scannedAt: new Date().toISOString(),
            reportVersion: 'trust-v1',
            errors: [(e as Error).message],
          });
        }
      }
    }

    // Score distribution
    const maxScore = layer1Only ? 25 : 100;
    const buckets = { high: 0, medium: 0, low: 0, zero: 0 };
    for (const r of reports) {
      const pct = r.compositeScore / maxScore;
      if (r.compositeScore === 0) buckets.zero++;
      else if (pct < 0.3) buckets.low++;
      else if (pct < 0.7) buckets.medium++;
      else buckets.high++;
    }
    console.log(`\nScore distribution (max ${maxScore}):`);
    console.log(`  70-100% (good): ${buckets.high}`);
    console.log(`  30-69% (fair):  ${buckets.medium}`);
    console.log(`  1-29%  (poor):  ${buckets.low}`);
    console.log(`  0      (fail):  ${buckets.zero}`);

    // Collect all flags across all reports
    const allFlags: Record<string, number> = {};
    for (const r of reports) {
      for (const layer of r.layers) {
        for (const flag of layer.flags) {
          const key = flag.split(':')[0]; // Group by flag type
          allFlags[key] = (allFlags[key] || 0) + 1;
        }
      }
    }
    if (Object.keys(allFlags).length > 0) {
      console.log('\nFlag summary:');
      for (const [flag, count] of Object.entries(allFlags).sort((a, b) => b[1] - a[1])) {
        console.log(`  ${flag}: ${count}`);
      }
    }

    // Show top and bottom 5
    reports.sort((a, b) => b.compositeScore - a.compositeScore);
    console.log(`\nTop 5 agents:`);
    for (const r of reports.slice(0, 5)) {
      console.log(`  #${r.agentId} "${r.name}" → ${r.compositeScore}/${maxScore}`);
    }
    console.log('\nBottom 5 agents:');
    for (const r of reports.slice(-5).reverse()) {
      console.log(`  #${r.agentId} "${r.name}" → ${r.compositeScore}/${maxScore}`);
      const flags = r.layers.flatMap(l => l.flags);
      for (const flag of flags.slice(0, 3)) {
        console.log(`    FLAG: ${flag}`);
      }
    }

    // Save results
    mkdirSync(RESULTS_DIR, { recursive: true });
    const output = {
      totalAgents: agents.length,
      scannedAt: new Date().toISOString(),
      scanMode: layer1Only ? 'layer1' : 'full',
      reports,
      ownerStats: ownerCounts,
    };
    writeFileSync(`${RESULTS_DIR}/scan-results.json`, JSON.stringify(output, null, 2));
    console.log(`\nResults saved to ${RESULTS_DIR}/scan-results.json`);
  }
}

async function info() {
  console.log('=== AgentGuard Info ===');
  const total = await findTotalAgents();
  console.log(`Total agents on Celo: ${total}`);
}

function getArgValue(args: string[], flag: string): number | undefined {
  const idx = args.indexOf(flag);
  if (idx === -1 || idx + 1 >= args.length) return undefined;
  const val = parseInt(args[idx + 1], 10);
  return isNaN(val) ? undefined : val;
}

async function write(args: string[]) {
  const dryRun = args.includes('--dry-run');
  const skipPinning = args.includes('--skip-pinning');
  const ownAgentIdStr = getArgValue(args, '--own-agent-id');

  console.log('=== AgentGuard Writer ===');
  if (dryRun) console.log('DRY RUN MODE — no transactions will be sent');

  // Load scan results
  let scanData: { reports: TrustReport[] };
  try {
    const raw = (await import('node:fs')).readFileSync(`${RESULTS_DIR}/scan-results.json`, 'utf-8');
    scanData = JSON.parse(raw);
  } catch {
    console.error('No scan results found. Run "scan" first.');
    return;
  }

  const reports = scanData.reports;
  console.log(`Loaded ${reports.length} reports`);

  const results = await writeFeedback(reports, {
    dryRun,
    skipPinning,
    ownAgentId: ownAgentIdStr,
  });

  // Summary
  const written = results.filter(r => !r.skipped && !r.error).length;
  const skipped = results.filter(r => r.skipped).length;
  const failed = results.filter(r => r.error).length;

  console.log(`\n=== Write Summary ===`);
  console.log(`Written: ${written}`);
  console.log(`Skipped: ${skipped}`);
  console.log(`Failed:  ${failed}`);
}

// CLI dispatch
const command = process.argv[2];
const args = process.argv.slice(3);

switch (command) {
  case 'scan':
    scan(args).catch(console.error);
    break;
  case 'info':
    info().catch(console.error);
    break;
  case 'write':
    write(args).catch(console.error);
    break;
  case 'serve':
    startMCPServer().catch(console.error);
    break;
  default:
    console.log('Usage: tsx src/index.ts <scan|info|write|serve>');
    console.log('  scan [--max N] [--start N] [--layer1] [--skip-metadata] [--skip-liveness] [--skip-onchain]');
    console.log('  info                 Show total agent count');
    console.log('  write [--dry-run]    Write scores to chain');
    console.log('  serve                Start MCP server');
}
