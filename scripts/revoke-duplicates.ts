import { publicClient, getWalletClient, getAccount } from '../src/chain.js';
import { REPUTATION_REGISTRY_ADDRESS, REPUTATION_REGISTRY_ABI, SENTINEL_WRITER_ADDRESS } from '../src/config.js';

/**
 * Revoke duplicate feedback entries created by the accidental re-write.
 * Agents 1-5 and 7-12 have lastIndex=2 (two entries) when they should have 1.
 * Agent 6 failed on nonce so it only has lastIndex=1.
 */
async function main() {
  const dryRun = process.argv.includes('--dry-run');
  const walletClient = dryRun ? null : getWalletClient();
  const account = dryRun ? null : getAccount();

  // Agents that were accidentally re-written
  const candidates = [1, 2, 3, 4, 5, 7, 8, 9, 10, 11, 12];

  for (const agentId of candidates) {
    const lastIndex = await publicClient.readContract({
      address: REPUTATION_REGISTRY_ADDRESS,
      abi: REPUTATION_REGISTRY_ABI,
      functionName: 'getLastIndex',
      args: [BigInt(agentId), SENTINEL_WRITER_ADDRESS],
    }) as bigint;

    if (lastIndex <= 1n) {
      console.log(`Agent #${agentId}: lastIndex=${lastIndex}, no duplicate`);
      continue;
    }

    console.log(`Agent #${agentId}: lastIndex=${lastIndex}, revoking duplicate (index ${lastIndex})`);

    if (dryRun) {
      console.log(`  DRY RUN: would revoke index ${lastIndex}`);
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
      console.log(`  Revoked: ${txHash}`);
    } catch (e) {
      console.error(`  Failed: ${(e as Error).message.slice(0, 100)}`);
    }
  }
}

main();
