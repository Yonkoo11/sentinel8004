import pLimit from 'p-limit';
import { keccak256, toBytes } from 'viem';
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { publicClient, getWalletClient, getAccount } from './chain.js';
import { REPUTATION_REGISTRY_ADDRESS, REPUTATION_REGISTRY_ABI, SENTINEL_WRITER_ADDRESS } from './config.js';
import { pinJSON } from './ipfs.js';
import { canonicalJSON } from './utils.js';
import type { TrustReport } from './types.js';

const CHECKPOINT_PATH = 'data/write-checkpoint.json';

interface WriteCheckpoint {
  lastAgentId: number;
  txHash: string | null;
  timestamp: string;
  totalWritten: number;
}

function loadCheckpoint(): WriteCheckpoint | null {
  try {
    return JSON.parse(readFileSync(CHECKPOINT_PATH, 'utf-8'));
  } catch {
    return null;
  }
}

function saveCheckpoint(cp: WriteCheckpoint): void {
  mkdirSync('data', { recursive: true });
  writeFileSync(CHECKPOINT_PATH, JSON.stringify(cp, null, 2));
}

interface WriteResult {
  agentId: number;
  txHash: string | null;
  ipfsCID: string | null;
  error: string | null;
  skipped: boolean;
  skipReason?: string;
}

export async function writeFeedback(
  reports: TrustReport[],
  options: {
    dryRun?: boolean;
    skipPinning?: boolean;
    ownAgentId?: number;
    resume?: boolean;
  } = {}
): Promise<WriteResult[]> {
  const results: WriteResult[] = [];
  const { dryRun = false, skipPinning = false, ownAgentId, resume = false } = options;

  // Checkpoint-based resume: skip agents at or below the checkpoint
  let skipBelow = 0;
  if (resume) {
    const cp = loadCheckpoint();
    if (cp) {
      skipBelow = cp.lastAgentId;
      console.log(`Resuming from checkpoint: lastAgentId=${cp.lastAgentId}, totalWritten=${cp.totalWritten} (${cp.timestamp})`);
    } else {
      console.log('No checkpoint found, starting from beginning');
    }
  }
  console.log(`Checkpoint path: ${CHECKPOINT_PATH}`);

  let walletClient: ReturnType<typeof getWalletClient> | null = null;
  let account: ReturnType<typeof getAccount> | null = null;

  if (!dryRun) {
    walletClient = getWalletClient();
    account = getAccount();
    console.log(`Writer address: ${account.address}`);
  }

  // Pre-filter using write-results.json (avoids thousands of RPC calls)
  const alreadyScoredSet = new Set<number>();
  try {
    const writeResults = JSON.parse(readFileSync('data/write-results.json', 'utf-8')) as WriteResult[];
    for (const wr of writeResults) {
      if (wr.txHash && !wr.error) alreadyScoredSet.add(wr.agentId);
    }
    if (alreadyScoredSet.size > 0) {
      console.log(`Pre-filtered ${alreadyScoredSet.size} already-written agents from write-results.json`);
    }
  } catch {
    // No write-results.json, fall back to on-chain check for all agents
    if (!dryRun && account) {
      console.log('No write-results.json, checking on-chain (this may be slow)...');
      const limit = pLimit(20);
      const checks = reports.map(report =>
        limit(async () => {
          try {
            const clients = await publicClient.readContract({
              address: REPUTATION_REGISTRY_ADDRESS,
              abi: REPUTATION_REGISTRY_ABI,
              functionName: 'getClients',
              args: [BigInt(report.agentId)],
            });
            if ((clients as string[]).includes(account!.address)) {
              alreadyScoredSet.add(report.agentId);
            }
          } catch {
            // getClients may fail for agents with no feedback yet
          }
        })
      );
      await Promise.all(checks);
      if (alreadyScoredSet.size > 0) {
        console.log(`Skipping ${alreadyScoredSet.size} already-scored agents`);
      }
    }
  }

  for (let i = 0; i < reports.length; i++) {
    const report = reports[i];
    const progress = `[${i + 1}/${reports.length}]`;

    // Skip agents below checkpoint (resume mode)
    if (resume && report.agentId <= skipBelow) {
      results.push({
        agentId: report.agentId,
        txHash: null,
        ipfsCID: null,
        error: null,
        skipped: true,
        skipReason: 'checkpoint-skip',
      });
      continue;
    }

    // Skip self-feedback (contract blocks it)
    if (ownAgentId && report.agentId === ownAgentId) {
      console.log(`${progress} #${report.agentId} SKIP (self)`);
      results.push({
        agentId: report.agentId,
        txHash: null,
        ipfsCID: null,
        error: null,
        skipped: true,
        skipReason: 'self-feedback',
      });
      continue;
    }

    // Skip already-scored
    if (alreadyScoredSet.has(report.agentId)) {
      console.log(`${progress} #${report.agentId} SKIP (already scored)`);
      results.push({
        agentId: report.agentId,
        txHash: null,
        ipfsCID: null,
        error: null,
        skipped: true,
        skipReason: 'already-scored',
      });
      continue;
    }

    // Pin report to IPFS (required for verifiable attestations)
    let ipfsCID: string | null = null;
    if (!skipPinning) {
      try {
        ipfsCID = await pinJSON(report, `sentinel8004-report-${report.agentId}`);
        console.log(`${progress} #${report.agentId} pinned: ${ipfsCID}`);
      } catch (e) {
        console.error(`${progress} #${report.agentId} pin failed: ${(e as Error).message}`);
        // IPFS failure = skip this agent. Never write on-chain without a verifiable report.
        results.push({
          agentId: report.agentId,
          txHash: null,
          ipfsCID: null,
          error: `IPFS pin failed: ${(e as Error).message}`,
          skipped: false,
        });
        continue;
      }
    }

    if (dryRun) {
      console.log(`${progress} #${report.agentId} DRY RUN: score=${report.compositeScore}, cid=${ipfsCID || 'none'}`);
      results.push({
        agentId: report.agentId,
        txHash: null,
        ipfsCID,
        error: null,
        skipped: false,
      });
      continue;
    }

    // Write to chain
    try {
      const reportJSON = canonicalJSON(report);
      const feedbackHash = keccak256(toBytes(reportJSON));
      const feedbackURI = ipfsCID ? `ipfs://${ipfsCID}` : '';

      const { request } = await publicClient.simulateContract({
        account: account!,
        address: REPUTATION_REGISTRY_ADDRESS,
        abi: REPUTATION_REGISTRY_ABI,
        functionName: 'giveFeedback',
        args: [
          BigInt(report.agentId),
          BigInt(report.compositeScore), // int128 value
          0, // valueDecimals
          'sentinel8004', // tag1
          'trust-v2', // tag2
          '', // endpoint
          feedbackURI, // feedbackURI
          feedbackHash, // feedbackHash
        ],
      });

      const txHash = await walletClient!.writeContract(request);
      console.log(`${progress} #${report.agentId} tx: ${txHash}`);

      // Wait for receipt
      const receipt = await publicClient.waitForTransactionReceipt({ hash: txHash });
      if (receipt.status === 'reverted') {
        console.error(`${progress} #${report.agentId} REVERTED`);
        results.push({
          agentId: report.agentId,
          txHash,
          ipfsCID,
          error: 'Transaction reverted',
          skipped: false,
        });
      } else {
        results.push({
          agentId: report.agentId,
          txHash,
          ipfsCID,
          error: null,
          skipped: false,
        });
        // Save checkpoint after each successful write
        saveCheckpoint({
          lastAgentId: report.agentId,
          txHash,
          timestamp: new Date().toISOString(),
          totalWritten: results.filter(r => r.txHash && !r.error).length,
        });
      }
    } catch (e) {
      const msg = (e as Error).message;
      console.error(`${progress} #${report.agentId} FAILED: ${msg.slice(0, 100)}`);
      results.push({
        agentId: report.agentId,
        txHash: null,
        ipfsCID,
        error: msg,
        skipped: false,
      });
    }
  }

  return results;
}

/**
 * Revoke all existing Sentinel feedback for the given agent IDs.
 * Must be called before rescore to prevent stale data accumulation.
 * See architecture-audit.md §Rescore Decision.
 */
export async function revokeAllFeedback(
  agentIds: number[],
  options: { dryRun?: boolean } = {}
): Promise<{ revoked: number; errors: number }> {
  const { dryRun = false } = options;
  let revoked = 0;
  let errors = 0;

  const walletClient = dryRun ? null : getWalletClient();
  const account = dryRun ? null : getAccount();

  const limit = pLimit(20);

  // First, find all agents where Sentinel has existing feedback
  const agentsWithFeedback: { agentId: number; lastIndex: bigint }[] = [];

  console.log(`Checking ${agentIds.length} agents for existing Sentinel feedback...`);
  const checks = agentIds.map(agentId =>
    limit(async () => {
      try {
        const lastIndex = await publicClient.readContract({
          address: REPUTATION_REGISTRY_ADDRESS,
          abi: REPUTATION_REGISTRY_ABI,
          functionName: 'getLastIndex',
          args: [BigInt(agentId), SENTINEL_WRITER_ADDRESS],
        }) as bigint;
        if (lastIndex > 0n) {
          agentsWithFeedback.push({ agentId, lastIndex });
        }
      } catch {
        // No feedback for this agent
      }
    })
  );
  await Promise.all(checks);

  console.log(`Found ${agentsWithFeedback.length} agents with existing Sentinel feedback`);

  // Revoke each one
  for (const { agentId, lastIndex } of agentsWithFeedback) {
    if (dryRun) {
      console.log(`DRY RUN: would revoke agent #${agentId} index ${lastIndex}`);
      revoked++;
      continue;
    }

    try {
      const { request } = await publicClient.simulateContract({
        account: account!,
        address: REPUTATION_REGISTRY_ADDRESS,
        abi: REPUTATION_REGISTRY_ABI,
        functionName: 'revokeFeedback',
        args: [BigInt(agentId), lastIndex],
      });

      const txHash = await walletClient!.writeContract(request);
      await publicClient.waitForTransactionReceipt({ hash: txHash });
      console.log(`Revoked #${agentId} index ${lastIndex}: ${txHash}`);
      revoked++;
    } catch (e) {
      console.error(`Revoke #${agentId} failed: ${(e as Error).message.slice(0, 80)}`);
      errors++;
    }
  }

  return { revoked, errors };
}
