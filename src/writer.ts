import pLimit from 'p-limit';
import { keccak256, toBytes } from 'viem';
import { publicClient, getWalletClient, getAccount } from './chain.js';
import { REPUTATION_REGISTRY_ADDRESS, REPUTATION_REGISTRY_ABI } from './config.js';
import { pinJSON } from './ipfs.js';
import type { TrustReport } from './types.js';

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
  } = {}
): Promise<WriteResult[]> {
  const results: WriteResult[] = [];
  const { dryRun = false, skipPinning = false, ownAgentId } = options;

  let walletClient: ReturnType<typeof getWalletClient> | null = null;
  let account: ReturnType<typeof getAccount> | null = null;

  if (!dryRun) {
    walletClient = getWalletClient();
    account = getAccount();
    console.log(`Writer address: ${account.address}`);
  }

  // Check which agents we've already scored (batch with concurrency)
  const alreadyScoredSet = new Set<number>();
  if (!dryRun && account) {
    console.log('Checking existing feedback...');
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

  for (let i = 0; i < reports.length; i++) {
    const report = reports[i];
    const progress = `[${i + 1}/${reports.length}]`;

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

    // Pin report to IPFS
    let ipfsCID: string | null = null;
    if (!skipPinning) {
      try {
        ipfsCID = await pinJSON(report, `sentinel8004-report-${report.agentId}`);
        console.log(`${progress} #${report.agentId} pinned: ${ipfsCID}`);
      } catch (e) {
        console.error(`${progress} #${report.agentId} pin failed: ${(e as Error).message}`);
        // Continue without pinning
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
      const reportJSON = JSON.stringify(report);
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
