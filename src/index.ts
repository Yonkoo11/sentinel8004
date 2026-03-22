import 'dotenv/config';
import { writeFileSync, readFileSync, mkdirSync, existsSync } from 'node:fs';
import { enumerateAgents, findTotalAgents } from './scanner.js';
import { scoreAgent, buildOwnerProfiles } from './scorer.js';
import { scoreRegistration } from './layers/registration.js';
import { writeFeedback, revokeAllFeedback } from './writer.js';
import { startMCPServer } from './mcp-server.js';
import { generateEcosystemReport } from './reporter.js';
import type { AgentRecord, TrustReport, LayerScore } from './types.js';

const RESULTS_DIR = 'data';

async function scan(args: string[]) {
  const maxAgents = getArgValue(args, '--max');
  const startFrom = getArgValue(args, '--start') || 1;
  const layer1Only = args.includes('--layer1');
  const skipMetadata = args.includes('--skip-metadata');

  console.log('=== Sentinel8004 Scanner ===');
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
          confidence: 'low',
          layers: [l1],
          circuitBreakers: [],
          scannedAt: new Date().toISOString(),
          reportVersion: 'trust-v2',
          errors: agent.metadataError ? [agent.metadataError] : [],
        });
      }
    } else {
      // Full scan: all 5 layers
      const skipReputation = args.includes('--skip-reputation');
      console.log('\n=== Full 5-Layer Scoring (v2) ===');
      if (skipLiveness) console.log('  (skipping L2 liveness probes)');
      if (skipOnchain) console.log('  (skipping L3 on-chain analysis)');
      if (skipReputation) console.log('  (skipping L5 reputation checks)');

      // Pre-compute owner profiles for Sybil detection (L4)
      const ownerProfileMap = buildOwnerProfiles(agents);
      console.log(`Owner profiles built: ${ownerProfileMap.size} unique owners`);

      // Smart mode: only run expensive L2/L3 on agents with metadata
      const smart = args.includes('--smart');
      if (smart) {
        console.log('Smart mode: L2/L3 only for agents with metadata');
      }

      // Score each agent sequentially (L2/L3 make network calls)
      for (let i = 0; i < agents.length; i++) {
        const agent = agents[i];
        const progress = `[${i + 1}/${agents.length}]`;

        // In smart mode, skip expensive layers for agents without metadata
        const agentSkipLiveness = skipLiveness || (smart && !agent.metadata);
        const agentSkipOnchain = skipOnchain || (smart && !agent.metadata);

        try {
          const agentSkipReputation = skipReputation || (smart && !agent.metadata);
          const report = await scoreAgent(agent, ownerProfileMap, {
            skipLiveness: agentSkipLiveness,
            skipOnchain: agentSkipOnchain,
            skipReputation: agentSkipReputation,
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
            confidence: 'low',
            layers: [],
            circuitBreakers: [],
            scannedAt: new Date().toISOString(),
            reportVersion: 'trust-v2',
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
    // Build accurate scan mode description
    let scanMode = 'full-v2';
    if (layer1Only) {
      scanMode = 'layer1';
    } else {
      const skippedLayers: string[] = [];
      if (args.includes('--skip-liveness')) skippedLayers.push('L2');
      if (args.includes('--skip-onchain')) skippedLayers.push('L3');
      if (args.includes('--skip-reputation')) skippedLayers.push('L5');
      if (args.includes('--smart')) scanMode = 'smart-v2';
      if (skippedLayers.length > 0) scanMode += ` (skip: ${skippedLayers.join(',')})`;
    }

    const output = {
      totalAgents: agents.length,
      scannedAt: new Date().toISOString(),
      scanMode,
      reports,
      ownerStats: ownerCounts,
    };
    const outputFile = getArgString(args, '--output') || `${RESULTS_DIR}/scan-results.json`;
    writeFileSync(outputFile, JSON.stringify(output, null, 2));
    console.log(`\nResults saved to ${outputFile}`);
  }
}

async function info() {
  console.log('=== Sentinel8004 Info ===');
  const total = await findTotalAgents();
  console.log(`Total agents on Celo: ${total}`);
}

function getArgValue(args: string[], flag: string): number | undefined {
  const idx = args.indexOf(flag);
  if (idx === -1 || idx + 1 >= args.length) return undefined;
  const val = parseInt(args[idx + 1], 10);
  return isNaN(val) ? undefined : val;
}

function getArgString(args: string[], flag: string): string | undefined {
  const idx = args.indexOf(flag);
  if (idx === -1 || idx + 1 >= args.length) return undefined;
  return args[idx + 1];
}

async function write(args: string[]) {
  const dryRun = args.includes('--dry-run');
  const skipPinning = args.includes('--skip-pinning');
  const ownAgentIdStr = getArgValue(args, '--own-agent-id');

  console.log('=== Sentinel8004 Writer ===');
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

  // Merge write results into existing file (preserves prior on-chain data)
  if (!dryRun) {
    mkdirSync(RESULTS_DIR, { recursive: true });
    const writeResultsPath = `${RESULTS_DIR}/write-results.json`;
    let existing: typeof results = [];
    try {
      existing = JSON.parse(readFileSync(writeResultsPath, 'utf-8'));
    } catch { /* no existing file */ }

    // Build map of existing results, then overlay new results
    const merged = new Map<number, (typeof results)[0]>();
    for (const wr of existing) merged.set(wr.agentId, wr);
    for (const wr of results) {
      const prev = merged.get(wr.agentId);
      // Keep the better result: prefer entries with successful txHash
      if (!prev || (wr.txHash && !wr.error) || (!prev.txHash || prev.error)) {
        merged.set(wr.agentId, wr);
      }
    }
    const mergedArr = [...merged.values()].sort((a, b) => a.agentId - b.agentId);
    writeFileSync(writeResultsPath, JSON.stringify(mergedArr, null, 2));
    console.log(`Write results merged and saved to ${writeResultsPath} (${mergedArr.length} entries)`);
  }
}

/**
 * Incremental rescan: only scan agents registered AFTER the last scan.
 * Merges new results into the existing scan-results.json.
 */
async function rescan(args: string[]) {
  const scanFile = `${RESULTS_DIR}/scan-results.json`;
  let existingReports: TrustReport[] = [];
  let lastAgentId = 0;

  if (existsSync(scanFile)) {
    const raw = readFileSync(scanFile, 'utf-8');
    const data = JSON.parse(raw);
    existingReports = data.reports || [];
    lastAgentId = Math.max(...existingReports.map((r: TrustReport) => r.agentId), 0);
    console.log(`Existing scan: ${existingReports.length} agents, last ID: ${lastAgentId}`);
  }

  const totalOnChain = await findTotalAgents();
  if (totalOnChain <= lastAgentId) {
    console.log(`No new agents (on-chain total: ${totalOnChain}, last scanned: ${lastAgentId})`);
    return;
  }

  const newCount = totalOnChain - lastAgentId;
  console.log(`Found ${newCount} new agent(s) to scan (${lastAgentId + 1} to ${totalOnChain})`);

  // Scan only new agents
  const newAgents = await enumerateAgents({
    startFrom: lastAgentId + 1,
    maxAgents: undefined,
    skipMetadata: false,
  });

  if (newAgents.length === 0) {
    console.log('No new agents found after enumeration');
    return;
  }

  // Build owner profiles from existing scan data + new agents (no extra network calls)
  const existingAsRecords = existingReports.map(r => ({
    agentId: r.agentId,
    owner: r.owner,
    metadata: r.name ? { name: r.name } : null,
    metadataFormat: 'cached',
    tokenURI: '',
    agentWallet: '',
    metadataError: null,
  })) as unknown as AgentRecord[];
  const ownerProfileMap = buildOwnerProfiles([...existingAsRecords, ...newAgents]);

  const skipLiveness = args.includes('--skip-liveness');
  const skipOnchain = args.includes('--skip-onchain');
  const skipReputation = args.includes('--skip-reputation');

  const newReports: TrustReport[] = [];
  for (let i = 0; i < newAgents.length; i++) {
    const agent = newAgents[i];
    const progress = `[${i + 1}/${newAgents.length}]`;
    try {
      const report = await scoreAgent(agent, ownerProfileMap, {
        skipLiveness,
        skipOnchain,
        skipReputation,
      });
      newReports.push(report);
      console.log(`${progress} #${agent.agentId} "${report.name}" → ${report.compositeScore}/100`);
    } catch (e) {
      console.error(`${progress} #${agent.agentId} FAILED: ${(e as Error).message}`);
      newReports.push({
        agentId: agent.agentId,
        owner: agent.owner,
        name: agent.metadata?.name || 'Unknown',
        compositeScore: 0,
        confidence: 'low',
        layers: [],
        circuitBreakers: [],
        scannedAt: new Date().toISOString(),
        reportVersion: 'trust-v2',
        errors: [(e as Error).message],
      });
    }
  }

  // Merge: replace any existing reports with same agentId, add truly new ones
  const reportMap = new Map<number, TrustReport>();
  for (const r of existingReports) reportMap.set(r.agentId, r);
  for (const r of newReports) reportMap.set(r.agentId, r);

  const mergedReports = [...reportMap.values()].sort((a, b) => a.agentId - b.agentId);

  const output = {
    totalAgents: mergedReports.length,
    scannedAt: new Date().toISOString(),
    scanMode: 'incremental-v2',
    reports: mergedReports,
  };

  mkdirSync(RESULTS_DIR, { recursive: true });
  writeFileSync(scanFile, JSON.stringify(output, null, 2));
  console.log(`\nMerged ${newReports.length} new + ${existingReports.length} existing = ${mergedReports.length} total`);
  console.log(`Saved to ${scanFile}`);
}

/**
 * Revoke all existing Sentinel feedback. Used before a full rescore.
 */
async function revoke(args: string[]) {
  const dryRun = args.includes('--dry-run');
  console.log('=== Sentinel8004 Revoke ===');
  if (dryRun) console.log('DRY RUN MODE');

  // Load scan results to get agent IDs
  let agentIds: number[];
  try {
    const raw = readFileSync(`${RESULTS_DIR}/scan-results.json`, 'utf-8');
    const data = JSON.parse(raw);
    agentIds = (data.reports as TrustReport[]).map(r => r.agentId);
  } catch {
    console.error('No scan results found. Run "scan" first.');
    return;
  }

  console.log(`Checking ${agentIds.length} agents for existing feedback...`);
  const result = await revokeAllFeedback(agentIds, { dryRun });
  console.log(`\nRevoked: ${result.revoked}, Errors: ${result.errors}`);
}

// CLI dispatch
const command = process.argv[2];
const args = process.argv.slice(3);

switch (command) {
  case 'scan':
    scan(args).catch(console.error);
    break;
  case 'rescan':
    rescan(args).catch(console.error);
    break;
  case 'info':
    info().catch(console.error);
    break;
  case 'write':
    write(args).catch(console.error);
    break;
  case 'revoke':
    revoke(args).catch(console.error);
    break;
  case 'serve':
    startMCPServer().catch(console.error);
    break;
  case 'report':
    console.log(generateEcosystemReport(`${RESULTS_DIR}/scan-results.json`));
    break;
  default:
    console.log('Usage: tsx src/index.ts <scan|rescan|info|write|revoke|serve|report>');
    console.log('  scan [--max N] [--start N] [--smart] [--skip-liveness] [--skip-onchain] [--skip-reputation]');
    console.log('  rescan               Incremental: scan only new agents, merge with existing');
    console.log('  info                 Show total agent count');
    console.log('  write [--dry-run]    Write scores to chain');
    console.log('  revoke [--dry-run]   Revoke all existing Sentinel feedback');
    console.log('  serve                Start MCP server');
    console.log('  report               Generate ecosystem report');
}
