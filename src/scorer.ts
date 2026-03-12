import type { AgentRecord, LayerScore, TrustReport } from './types.js';
import { scoreRegistration } from './layers/registration.js';
import { scoreLiveness } from './layers/liveness.js';
import { scoreOnchain } from './layers/onchain.js';
import { scoreSybil, buildOwnerProfiles } from './layers/sybil.js';

export async function scoreAgent(
  agent: AgentRecord,
  ownerProfiles: Map<string, { agentCount: number; descriptions: string[] }>,
  options: { skipLiveness?: boolean; skipOnchain?: boolean } = {}
): Promise<TrustReport> {
  const layers: LayerScore[] = [];
  const errors: string[] = [];

  if (agent.metadataError) {
    errors.push(agent.metadataError);
  }

  // Layer 1: Registration Quality (sync, fast)
  const l1 = scoreRegistration(agent);
  layers.push(l1);

  // Layer 2: Endpoint Liveness (async, HTTP probes)
  if (!options.skipLiveness) {
    try {
      const l2 = await scoreLiveness(agent);
      layers.push(l2);
    } catch (e) {
      errors.push(`L2 error: ${(e as Error).message}`);
      layers.push({ layer: 'liveness', score: 5, maxScore: 25, details: ['Error during probe'], flags: ['L2_ERROR'] });
    }
  }

  // Layer 3: On-Chain Behavior (async, Blockscout API)
  if (!options.skipOnchain) {
    try {
      const l3 = await scoreOnchain(agent.agentWallet);
      layers.push(l3);
    } catch (e) {
      errors.push(`L3 error: ${(e as Error).message}`);
      layers.push({ layer: 'onchain', score: 12, maxScore: 25, details: ['Error during analysis'], flags: ['L3_ERROR'] });
    }
  }

  // Layer 4: Sybil/Spam Detection (sync, needs context)
  const l4 = scoreSybil(agent, ownerProfiles);
  layers.push(l4);

  // Composite score
  const compositeScore = layers.reduce((sum, l) => sum + l.score, 0);

  return {
    agentId: agent.agentId,
    owner: agent.owner,
    name: agent.metadata?.name || 'Unknown',
    compositeScore,
    layers,
    scannedAt: new Date().toISOString(),
    reportVersion: 'trust-v1',
    errors,
  };
}

export { buildOwnerProfiles };
