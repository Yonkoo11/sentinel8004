/**
 * timing-cluster-analysis.ts - Cross-owner Sybil detection via registration timing.
 *
 * Analyzes agents registered in the same block or within 60 seconds,
 * then checks metadata similarity across different owners to find
 * potential multi-wallet Sybil attacks.
 *
 * This is an enhancement layer that adds a TIMING_CLUSTER_SYBIL signal
 * without changing existing scores.
 *
 * Usage: npx tsx scripts/timing-cluster-analysis.ts [--sample N]
 */

import { readFileSync } from 'node:fs';
import { createPublicClient, http } from 'viem';
import { celo } from 'viem/chains';
import pLimit from 'p-limit';
import { jaccard, wordSet } from '../src/utils.js';
import { CELO_RPC_URL, IDENTITY_REGISTRY_ADDRESS, IDENTITY_REGISTRY_ABI } from '../src/config.js';

const client = createPublicClient({
  chain: celo,
  transport: http(CELO_RPC_URL),
});

const data = JSON.parse(readFileSync('data/scan-results.json', 'utf-8'));
const reports = data.reports as Array<{
  agentId: number;
  owner: string;
  name: string;
  compositeScore: number;
  layers: Array<{ layer: string; score: number; details: string[]; flags: string[] }>;
}>;

// Parse sample size from args
const sampleArg = process.argv.indexOf('--sample');
const sampleSize = sampleArg !== -1 ? Number(process.argv[sampleArg + 1]) : 200;

// Select agents to analyze (sample for speed, focus on non-mass-registration agents)
const singleOwnerAgents = reports.filter(r => {
  const ownerCount = reports.filter(r2 => r2.owner === r.owner).length;
  return ownerCount <= 10; // Skip known mass registrations
});

const sample = singleOwnerAgents.slice(0, sampleSize);
console.log(`=== Cross-Owner Timing Cluster Analysis ===\n`);
console.log(`Analyzing ${sample.length} agents (${singleOwnerAgents.length} non-mass-registration agents total)\n`);

// Fetch registration block numbers via Transfer event (mint = transfer from 0x0)
const TRANSFER_EVENT_ABI = [{
  type: 'event',
  name: 'Transfer',
  inputs: [
    { name: 'from', type: 'address', indexed: true },
    { name: 'to', type: 'address', indexed: true },
    { name: 'tokenId', type: 'uint256', indexed: true },
  ],
}] as const;

interface AgentRegistration {
  agentId: number;
  owner: string;
  name: string;
  description: string;
  blockNumber: bigint;
  timestamp: number;
}

async function getRegistrationBlock(agentId: number): Promise<bigint | null> {
  try {
    const logs = await client.getLogs({
      address: IDENTITY_REGISTRY_ADDRESS,
      event: TRANSFER_EVENT_ABI[0],
      args: {
        from: '0x0000000000000000000000000000000000000000',
        tokenId: BigInt(agentId),
      },
      fromBlock: 0n,
      toBlock: 'latest',
    });
    return logs.length > 0 ? logs[0].blockNumber : null;
  } catch {
    return null;
  }
}

async function main() {
  // Fetch registration blocks with rate limiting
  const limit = pLimit(5);
  const registrations: AgentRegistration[] = [];
  const blockTimestampCache = new Map<bigint, number>();

  console.log('Fetching registration blocks...');
  const results = await Promise.all(
    sample.map(r => limit(async () => {
      const blockNumber = await getRegistrationBlock(r.agentId);
      return { ...r, blockNumber };
    }))
  );

  // Filter agents with valid blocks
  const withBlocks = results.filter(r => r.blockNumber !== null);
  console.log(`  Got blocks for ${withBlocks.length}/${sample.length} agents`);

  // Fetch timestamps for unique blocks
  const uniqueBlocks = [...new Set(withBlocks.map(r => r.blockNumber!))];
  console.log(`  Fetching timestamps for ${uniqueBlocks.length} unique blocks...`);

  await Promise.all(
    uniqueBlocks.map(bn => limit(async () => {
      try {
        const block = await client.getBlock({ blockNumber: bn });
        blockTimestampCache.set(bn, Number(block.timestamp));
      } catch {
        // skip
      }
    }))
  );

  // Build registration records
  for (const r of withBlocks) {
    const ts = blockTimestampCache.get(r.blockNumber!);
    if (ts === undefined) continue;

    const report = reports.find(rep => rep.agentId === r.agentId);
    const regLayer = report?.layers.find(l => l.layer === 'registration');
    const description = regLayer?.details?.find(d => d.includes('description'))?.replace(/.*: /, '') || '';

    registrations.push({
      agentId: r.agentId,
      owner: r.owner,
      name: r.name,
      description,
      blockNumber: r.blockNumber!,
      timestamp: ts,
    });
  }

  registrations.sort((a, b) => a.timestamp - b.timestamp);

  // Cluster by timing: agents registered within 60 seconds of each other
  const TIMING_WINDOW = 60; // seconds
  const clusters: AgentRegistration[][] = [];
  let currentCluster: AgentRegistration[] = [];

  for (const reg of registrations) {
    if (currentCluster.length === 0) {
      currentCluster.push(reg);
    } else {
      const lastTs = currentCluster[currentCluster.length - 1].timestamp;
      if (reg.timestamp - lastTs <= TIMING_WINDOW) {
        currentCluster.push(reg);
      } else {
        if (currentCluster.length >= 2) clusters.push(currentCluster);
        currentCluster = [reg];
      }
    }
  }
  if (currentCluster.length >= 2) clusters.push(currentCluster);

  // Filter clusters with multiple different owners
  const crossOwnerClusters = clusters.filter(c => {
    const owners = new Set(c.map(r => r.owner));
    return owners.size > 1;
  });

  console.log(`\nTiming clusters found: ${clusters.length} total, ${crossOwnerClusters.length} cross-owner\n`);

  // Analyze cross-owner clusters for metadata similarity
  let suspiciousCount = 0;

  for (const cluster of crossOwnerClusters) {
    const owners = [...new Set(cluster.map(r => r.owner))];
    const timeSpan = cluster[cluster.length - 1].timestamp - cluster[0].timestamp;

    // Check pairwise name similarity across different owners
    let maxCrossSimilarity = 0;
    let similarPair: [AgentRegistration, AgentRegistration] | null = null;

    for (let i = 0; i < cluster.length; i++) {
      for (let j = i + 1; j < cluster.length; j++) {
        if (cluster[i].owner === cluster[j].owner) continue;
        const nameA = wordSet(cluster[i].name);
        const nameB = wordSet(cluster[j].name);
        if (nameA.size > 0 && nameB.size > 0) {
          const sim = jaccard(nameA, nameB);
          if (sim > maxCrossSimilarity) {
            maxCrossSimilarity = sim;
            similarPair = [cluster[i], cluster[j]];
          }
        }
      }
    }

    if (maxCrossSimilarity > 0.6) {
      suspiciousCount++;
      console.log(`TIMING_CLUSTER_SYBIL (similarity: ${(maxCrossSimilarity * 100).toFixed(0)}%)`);
      console.log(`  Window: ${timeSpan}s, ${cluster.length} agents, ${owners.length} owners`);
      if (similarPair) {
        console.log(`  #${similarPair[0].agentId} "${similarPair[0].name}" (${similarPair[0].owner.slice(0, 10)}...)`);
        console.log(`  #${similarPair[1].agentId} "${similarPair[1].name}" (${similarPair[1].owner.slice(0, 10)}...)`);
      }
      console.log();
    }
  }

  // Summary
  console.log('─'.repeat(60));
  console.log(`\nSummary:`);
  console.log(`  Agents analyzed: ${registrations.length}`);
  console.log(`  Timing clusters (2+ agents within 60s): ${clusters.length}`);
  console.log(`  Cross-owner clusters: ${crossOwnerClusters.length}`);
  console.log(`  Suspicious (similarity > 60%): ${suspiciousCount}`);

  if (suspiciousCount === 0) {
    console.log(`\n  No cross-owner Sybil patterns detected via timing analysis.`);
    console.log(`  This suggests multi-wallet attacks are not currently prevalent in the registry.`);
  }
}

main().catch(e => {
  console.error('Error:', e.message);
  process.exit(1);
});
