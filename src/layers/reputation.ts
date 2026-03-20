import type { LayerScore } from '../types.js';
import { publicClient } from '../chain.js';
import {
  REPUTATION_REGISTRY_ADDRESS,
  REPUTATION_REGISTRY_ABI,
} from '../config.js';

/**
 * Layer 5: Existing On-Chain Reputation (0-15 bonus)
 *
 * Reads existing feedback from the ReputationRegistry to see if other
 * clients have already evaluated this agent. This is the only layer
 * that incorporates external trust signals rather than our own checks.
 *
 * Why this matters: If independent clients have already given positive
 * feedback on-chain, that's a stronger signal than any metadata check.
 * If an agent has clients but all feedback is negative, that's a red flag.
 */
export async function scoreReputation(agentId: number): Promise<LayerScore> {
  const details: string[] = [];
  const flags: string[] = [];
  let score = 0;

  try {
    // Get all feedback clients for this agent
    const clients = await publicClient.readContract({
      address: REPUTATION_REGISTRY_ADDRESS,
      abi: REPUTATION_REGISTRY_ABI,
      functionName: 'getClients',
      args: [BigInt(agentId)],
    }) as `0x${string}`[];

    if (clients.length === 0) {
      details.push('No existing feedback from any client');
      return { layer: 'reputation', score: 0, maxScore: 15, details, flags };
    }

    details.push(`${clients.length} feedback client(s) found`);

    // Read feedback from each client (up to 10 to avoid rate limits)
    const clientsToCheck = clients.slice(0, 10);
    let positiveCount = 0;
    let negativeCount = 0;
    let totalValue = 0n;

    for (const client of clientsToCheck) {
      try {
        // Get the most recent feedback index for this client
        const lastIndex = await publicClient.readContract({
          address: REPUTATION_REGISTRY_ADDRESS,
          abi: REPUTATION_REGISTRY_ABI,
          functionName: 'getLastIndex',
          args: [BigInt(agentId), client],
        }) as bigint;

        if (lastIndex === 0n) {
          details.push(`Client ${client.slice(0, 8)}...: no feedback entries`);
          continue;
        }

        const feedback = await publicClient.readContract({
          address: REPUTATION_REGISTRY_ADDRESS,
          abi: REPUTATION_REGISTRY_ABI,
          functionName: 'readFeedback',
          args: [BigInt(agentId), client, lastIndex],
        }) as [bigint, number, string, string, boolean];

        const [value, , tag1, , isRevoked] = feedback;

        if (isRevoked) {
          details.push(`Client ${client.slice(0, 8)}... revoked feedback`);
          continue;
        }

        if (value > 0n) {
          positiveCount++;
          totalValue += value;
          details.push(`Client ${client.slice(0, 8)}...: positive (tag: ${tag1 || 'none'})`);
        } else if (value < 0n) {
          negativeCount++;
          totalValue += value;
          details.push(`Client ${client.slice(0, 8)}...: negative (tag: ${tag1 || 'none'})`);
        } else {
          details.push(`Client ${client.slice(0, 8)}...: neutral`);
        }
      } catch {
        // Individual feedback read failures are non-fatal
        details.push(`Client ${client.slice(0, 8)}...: read error`);
      }
    }

    // Score based on feedback distribution
    // Having multiple independent positive signals is strong evidence
    if (positiveCount >= 3) {
      score = 15;
      details.push(`+15 Strong positive reputation (${positiveCount} positive clients)`);
    } else if (positiveCount >= 1 && negativeCount === 0) {
      score = 10;
      details.push(`+10 Positive reputation (${positiveCount} positive, 0 negative)`);
    } else if (positiveCount > negativeCount) {
      score = 5;
      details.push(`+5 Mixed but net positive (${positiveCount}+ / ${negativeCount}-)`);
    } else if (negativeCount > 0) {
      score = 0;
      details.push(`+0 Net negative reputation (${positiveCount}+ / ${negativeCount}-)`);
      flags.push('NEGATIVE_REPUTATION');
    }

    // Flag if only self-related feedback (same owner patterns)
    if (clients.length === 1) {
      details.push('Note: Only 1 feedback client (limited signal)');
    }

  } catch (e) {
    details.push(`ReputationRegistry read error: ${(e as Error).message}`);
    return { layer: 'reputation', score: 0, maxScore: 15, details, flags };
  }

  return { layer: 'reputation', score, maxScore: 15, details, flags };
}
