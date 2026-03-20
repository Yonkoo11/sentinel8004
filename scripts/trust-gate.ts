/**
 * trust-gate.ts - On-chain consumer demo for Sentinel8004 trust scores.
 *
 * Queries the ReputationRegistry contract directly to read trust scores,
 * demonstrating how any agent or dApp can consume Sentinel's attestations.
 *
 * Usage: npx tsx scripts/trust-gate.ts <agentId>
 */

import { createPublicClient, http } from 'viem';
import { celo } from 'viem/chains';
import {
  REPUTATION_REGISTRY_ADDRESS,
  REPUTATION_REGISTRY_ABI,
  CELO_RPC_URL,
} from '../src/config.js';

const SENTINEL_WRITER = '0xf9946775891a24462cD4ec885d0D4E2675C84355' as const;

const client = createPublicClient({
  chain: celo,
  transport: http(CELO_RPC_URL),
});

function decide(score: number): { label: string; color: string } {
  if (score >= 50) return { label: 'SAFE to interact', color: '\x1b[32m' };
  if (score >= 30) return { label: 'PROCEED WITH CAUTION', color: '\x1b[33m' };
  return { label: 'DO NOT INTERACT', color: '\x1b[31m' };
}

async function checkAgentTrust(agentId: number) {
  const reset = '\x1b[0m';
  const bold = '\x1b[1m';
  const dim = '\x1b[2m';

  console.log(`\n${bold}--- Sentinel8004 Trust Gate (On-Chain) ---${reset}\n`);
  console.log(`  Querying ReputationRegistry for agent #${agentId}...`);

  // Check if Sentinel has written feedback for this agent
  const clients = await client.readContract({
    address: REPUTATION_REGISTRY_ADDRESS,
    abi: REPUTATION_REGISTRY_ABI,
    functionName: 'getClients',
    args: [BigInt(agentId)],
  }) as string[];

  const hasSentinelFeedback = clients.some(
    c => c.toLowerCase() === SENTINEL_WRITER.toLowerCase()
  );

  if (!hasSentinelFeedback) {
    console.log(`\n  ${dim}No Sentinel8004 feedback found for agent #${agentId}.${reset}`);
    console.log(`  ${dim}Total feedback clients: ${clients.length}${reset}\n`);
    return;
  }

  // Read the latest Sentinel feedback
  const lastIndex = await client.readContract({
    address: REPUTATION_REGISTRY_ADDRESS,
    abi: REPUTATION_REGISTRY_ABI,
    functionName: 'getLastIndex',
    args: [BigInt(agentId), SENTINEL_WRITER],
  }) as bigint;

  const [value, valueDecimals, tag1, tag2] = await client.readContract({
    address: REPUTATION_REGISTRY_ADDRESS,
    abi: REPUTATION_REGISTRY_ABI,
    functionName: 'readFeedback',
    args: [BigInt(agentId), SENTINEL_WRITER, lastIndex],
  }) as [bigint, number, string, string, boolean];

  const score = Number(value);
  const { label, color } = decide(score);

  console.log(`  Agent:      #${agentId}`);
  console.log(`  Score:      ${score}/100`);
  console.log(`  Tag:        ${tag1}/${tag2}`);
  console.log(`  Clients:    ${clients.length} total feedback providers`);
  console.log(`  Source:     ReputationRegistry (on-chain)`);
  console.log(`\n  ${color}${bold}Decision: ${label}${reset}\n`);
}

// --- main ---
const agentId = Number(process.argv[2]);
if (!agentId || isNaN(agentId)) {
  console.error('Usage: npx tsx scripts/trust-gate.ts <agentId>');
  process.exit(1);
}

checkAgentTrust(agentId).catch(e => {
  console.error('Error:', e.message);
  process.exit(1);
});
