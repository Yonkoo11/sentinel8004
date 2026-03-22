import type { AgentRecord, LayerScore, TrustReport } from './types.js';
import { scoreRegistration } from './layers/registration.js';
import { scoreLiveness } from './layers/liveness.js';
import { scoreOnchain } from './layers/onchain.js';
import { scoreSybil, buildOwnerProfiles } from './layers/sybil.js';
import { scoreReputation } from './layers/reputation.js';

/**
 * Composite Trust Scorer v2
 *
 * Design principles:
 * 1. CIRCUIT BREAKERS: Certain critical flags cap the maximum score regardless
 *    of other signals. A mass registrar with perfect metadata is still spam.
 * 2. WEIGHTED LAYERS: Security-critical layers (Sybil) carry more weight than
 *    cosmetic layers (metadata completeness). The weights are:
 *    - L1 Registration: 20pts (cosmetic signal, easy to game)
 *    - L2 Liveness: 20pts (operational signal, moderate to game)
 *    - L3 On-Chain: 20pts (behavioral signal, expensive to game)
 *    - L4 Sybil: 25pts (security signal, hardest to game at scale)
 *    - L5 Reputation: 15pts (social signal, requires real community trust)
 *    Total possible: 100
 * 3. CONFIDENCE: Distinguishes between "scored with full data" and "scored
 *    with defaults." A 50 at high confidence means something different than
 *    50 at low confidence.
 * 4. NO NEUTRAL INFLATION: Missing data defaults to 0, not middle-of-range.
 *    Unknown is not positive. If we couldn't evaluate a layer, the agent
 *    doesn't get credit for it.
 */

// Circuit breakers: flags that cap the maximum final score
const CIRCUIT_BREAKERS: Record<string, { maxScore: number; reason: string }> = {
  MASS_REGISTRATION: {
    maxScore: 15,
    reason: 'Owner registered 50+ agents from single address',
  },
  ALL_ENDPOINTS_DEAD: {
    maxScore: 35,
    reason: 'All declared service endpoints are unreachable',
  },
  METADATA_CLONE: {
    maxScore: 25,
    reason: 'Metadata >80% identical to sibling agent from same owner',
  },
  NEGATIVE_REPUTATION: {
    maxScore: 30,
    reason: 'Net negative reputation from existing on-chain feedback',
  },
  NO_METADATA: {
    maxScore: 20,
    reason: 'No parseable metadata at all',
  },
  SYBIL_BOOSTED: {
    maxScore: 40,
    reason: 'L5 reputation inflated by sock puppet wallets with <5 total txs',
  },
};

// Weight multipliers: normalize each layer to its target weight
// L1: 25 raw → 20 weighted (0.8x), L2: 25→20 (0.8x), L3: 25→20 (0.8x),
// L4: 25→25 (1.0x), L5: 15→15 (1.0x)
const LAYER_WEIGHTS: Record<string, number> = {
  registration: 0.8,
  liveness: 0.8,
  onchain: 0.8,
  sybil: 1.0,
  reputation: 1.0,
};

export async function scoreAgent(
  agent: AgentRecord,
  ownerProfiles: Map<string, { agentCount: number; descriptions: string[] }>,
  options: { skipLiveness?: boolean; skipOnchain?: boolean; skipReputation?: boolean } = {}
): Promise<TrustReport> {
  const layers: LayerScore[] = [];
  const errors: string[] = [];
  let layersEvaluated = 0;
  const totalPossibleLayers = 5;

  if (agent.metadataError) {
    errors.push(agent.metadataError);
  }

  // Layer 1: Registration Quality (sync, fast)
  const l1 = scoreRegistration(agent);
  layers.push(l1);
  layersEvaluated++;

  // Track skipped layers explicitly so reports are transparent
  const skippedLayers: string[] = [];
  if (options.skipLiveness) skippedLayers.push('L2 Liveness (skipped by config)');
  if (options.skipOnchain) skippedLayers.push('L3 On-Chain (skipped by config)');
  if (options.skipReputation) skippedLayers.push('L5 Reputation (skipped by config)');

  // Layer 2: Endpoint Liveness (async, HTTP probes)
  if (!options.skipLiveness) {
    try {
      const l2 = await scoreLiveness(agent);
      layers.push(l2);
      layersEvaluated++;
    } catch (e) {
      errors.push(`L2 error: ${(e as Error).message}`);
      layers.push({ layer: 'liveness', score: 0, maxScore: 25, details: ['Error during probe'], flags: ['L2_ERROR'] });
    }
  }

  // Layer 3: On-Chain Behavior (async, Blockscout API)
  if (!options.skipOnchain) {
    try {
      const l3 = await scoreOnchain(agent.agentWallet);
      layers.push(l3);
      layersEvaluated++;
    } catch (e) {
      errors.push(`L3 error: ${(e as Error).message}`);
      layers.push({ layer: 'onchain', score: 0, maxScore: 25, details: ['Error during analysis'], flags: ['L3_ERROR'] });
    }
  }

  // Layer 4: Sybil/Spam Detection (sync, needs context)
  const l4 = scoreSybil(agent, ownerProfiles);
  layers.push(l4);
  layersEvaluated++;

  // Layer 5: Existing On-Chain Reputation (async, ReputationRegistry)
  if (!options.skipReputation) {
    try {
      const l5 = await scoreReputation(agent.agentId);
      layers.push(l5);
      layersEvaluated++;
    } catch (e) {
      errors.push(`L5 error: ${(e as Error).message}`);
      layers.push({ layer: 'reputation', score: 0, maxScore: 15, details: ['Error reading reputation'], flags: ['L5_ERROR'] });
    }
  }

  // Weighted composite: apply layer weights
  let rawScore = 0;
  for (const layer of layers) {
    const weight = LAYER_WEIGHTS[layer.layer] ?? 1.0;
    rawScore += layer.score * weight;
  }

  // Collect all flags across layers
  const allFlags = layers.flatMap(l => l.flags).map(f => f.split(':')[0]);

  // Apply circuit breakers: collect ALL triggered, use lowest cap
  const circuitBreakers: string[] = [];
  let scoreCap = 100;
  for (const flag of allFlags) {
    const breaker = CIRCUIT_BREAKERS[flag];
    if (breaker) {
      circuitBreakers.push(`${flag}: capped at ${breaker.maxScore} (${breaker.reason})`);
      if (breaker.maxScore < scoreCap) {
        scoreCap = breaker.maxScore;
      }
    }
  }

  const compositeScore = Math.round(Math.min(rawScore, scoreCap));

  // Confidence based on how many layers we actually evaluated with real data
  const confidence: TrustReport['confidence'] =
    layersEvaluated >= 4 ? 'high' :
    layersEvaluated >= 2 ? 'medium' : 'low';

  return {
    agentId: agent.agentId,
    owner: agent.owner,
    name: agent.metadata?.name || 'Unknown',
    compositeScore,
    confidence,
    layers,
    circuitBreakers,
    scannedAt: new Date().toISOString(),
    reportVersion: 'trust-v2',
    errors: [...skippedLayers, ...errors],
  };
}

export { buildOwnerProfiles };
