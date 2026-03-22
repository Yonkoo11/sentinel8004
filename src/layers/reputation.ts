import type { LayerScore } from '../types.js';
import { publicClient } from '../chain.js';
import {
  REPUTATION_REGISTRY_ADDRESS,
  REPUTATION_REGISTRY_ABI,
  SENTINEL_WRITER_ADDRESS,
  BLOCKSCOUT_API_URL,
} from '../config.js';
import { fetchWithTimeout } from '../utils.js';

/**
 * Layer 5: Existing On-Chain Reputation (0-15 bonus)
 *
 * Reads existing feedback from the ReputationRegistry to see if other
 * independent clients have already evaluated this agent.
 *
 * ANTI-SYBIL MEASURES (post architecture audit, March 2026):
 * 1. Exclude Sentinel's own address (prevents self-referential loop on rescan)
 * 2. Exclude providers with <5 total transactions (sock puppet filter)
 * 3. Exclude providers whose scores are all >90 (uniformity filter)
 * 4. Flag agents whose non-Sentinel providers are mostly filtered out
 */
export async function scoreReputation(agentId: number): Promise<LayerScore> {
  const details: string[] = [];
  const flags: string[] = [];
  let score = 0;

  try {
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

    // Step 1: Exclude Sentinel's own address
    const externalClients = clients.filter(
      c => c.toLowerCase() !== SENTINEL_WRITER_ADDRESS.toLowerCase()
    );

    if (externalClients.length === 0) {
      details.push(`${clients.length} client(s) found, all are Sentinel — skipping L5`);
      return { layer: 'reputation', score: 0, maxScore: 15, details, flags };
    }

    details.push(`${clients.length} client(s) found, ${externalClients.length} external`);

    // Step 2: Filter clients by on-chain history (sock puppet detection)
    const clientsToCheck = externalClients.slice(0, 20);
    const qualified: `0x${string}`[] = [];
    let filteredCount = 0;

    for (const client of clientsToCheck) {
      const txCount = await getAddressTxCount(client);
      if (txCount < 5) {
        details.push(`Client ${client.slice(0, 8)}...: filtered (${txCount} txs, min 5)`);
        filteredCount++;
        continue;
      }
      qualified.push(client);
    }

    if (qualified.length === 0) {
      if (filteredCount > 0) {
        details.push(`All ${filteredCount} external client(s) filtered as low-activity (likely sock puppets)`);
        flags.push('SYBIL_BOOSTED');
      }
      return { layer: 'reputation', score: 0, maxScore: 15, details, flags };
    }

    // Step 3: Read feedback from qualified clients
    let positiveCount = 0;
    let negativeCount = 0;
    const scores: number[] = [];

    for (const client of qualified) {
      try {
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
          details.push(`Client ${client.slice(0, 8)}...: revoked`);
          continue;
        }

        const numValue = Number(value);
        scores.push(numValue);

        if (value > 0n) {
          positiveCount++;
          details.push(`Client ${client.slice(0, 8)}...: positive ${numValue} (tag: ${tag1 || 'none'})`);
        } else if (value < 0n) {
          negativeCount++;
          details.push(`Client ${client.slice(0, 8)}...: negative ${numValue} (tag: ${tag1 || 'none'})`);
        } else {
          details.push(`Client ${client.slice(0, 8)}...: neutral`);
        }
      } catch {
        details.push(`Client ${client.slice(0, 8)}...: read error`);
      }
    }

    // Step 4: Uniformity check — if all scores are >90, likely coordinated
    if (scores.length >= 3) {
      const allHigh = scores.every(s => s > 90);
      if (allHigh) {
        details.push(`Uniformity filter: all ${scores.length} scores >90 — likely coordinated`);
        flags.push('SYBIL_BOOSTED');
        return { layer: 'reputation', score: 0, maxScore: 15, details, flags };
      }
    }

    // Step 5: Score based on filtered feedback
    if (positiveCount >= 3) {
      score = 15;
      details.push(`+15 Strong positive reputation (${positiveCount} qualified positive clients)`);
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

    // Note filtered-out providers for transparency
    if (filteredCount > 0) {
      details.push(`${filteredCount} additional client(s) filtered as low-activity`);
      if (filteredCount > qualified.length * 3) {
        flags.push('SYBIL_BOOSTED');
      }
    }

  } catch (e) {
    details.push(`ReputationRegistry read error: ${(e as Error).message}`);
    return { layer: 'reputation', score: 0, maxScore: 15, details, flags };
  }

  return { layer: 'reputation', score, maxScore: 15, details, flags };
}

// In-memory cache for tx counts across agents in the same scan run.
// Sock puppet wallets appear across multiple agents' client lists.
const txCountCache = new Map<string, number>();

/**
 * Get total transaction count for an address via Blockscout.
 * Low tx count (<5) is a strong sock puppet indicator.
 * Results cached for the duration of the scan.
 */
async function getAddressTxCount(address: string): Promise<number> {
  const key = address.toLowerCase();
  const cached = txCountCache.get(key);
  if (cached !== undefined) return cached;

  try {
    const url = `${BLOCKSCOUT_API_URL}?module=account&action=txlist&address=${address}&page=1&offset=5`;
    const res = await fetchWithTimeout(url, 8000);
    if (!res.ok) return 999; // fail open — don't filter on API errors
    const data = (await res.json()) as { result?: unknown[] };
    const count = Array.isArray(data.result) ? data.result.length : 999;
    txCountCache.set(key, count);
    return count;
  } catch {
    return 999; // fail open
  }
}
