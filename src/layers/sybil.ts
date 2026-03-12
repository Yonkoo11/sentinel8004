import type { AgentRecord, LayerScore } from '../types.js';
import { jaccard, wordSet } from '../utils.js';

interface OwnerProfile {
  agentCount: number;
  descriptions: string[];
}

// Pre-compute owner profiles from all agents
export function buildOwnerProfiles(agents: AgentRecord[]): Map<string, OwnerProfile> {
  const profiles = new Map<string, OwnerProfile>();

  for (const agent of agents) {
    const existing = profiles.get(agent.owner) || { agentCount: 0, descriptions: [] };
    existing.agentCount++;
    if (agent.metadata?.description) {
      existing.descriptions.push(agent.metadata.description);
    }
    profiles.set(agent.owner, existing);
  }

  return profiles;
}

export function scoreSybil(
  agent: AgentRecord,
  ownerProfiles: Map<string, OwnerProfile>
): LayerScore {
  const details: string[] = [];
  const flags: string[] = [];
  let score = 25; // Start at max, deduct for red flags

  const profile = ownerProfiles.get(agent.owner);
  if (!profile) {
    return { layer: 'sybil', score: 25, maxScore: 25, details: ['No profile data'], flags };
  }

  // Owner concentration scoring
  const count = profile.agentCount;
  if (count <= 3) {
    details.push(`Owner has ${count} agent(s) — normal`);
  } else if (count <= 10) {
    score = 15;
    details.push(`Owner has ${count} agents — moderate concentration`);
    flags.push(`OWNER_CONCENTRATION:${count}`);
  } else if (count <= 50) {
    score = 5;
    details.push(`Owner has ${count} agents — high concentration`);
    flags.push(`HIGH_CONCENTRATION:${count}`);
  } else {
    score = 0;
    details.push(`Owner has ${count} agents — mass registration`);
    flags.push(`MASS_REGISTRATION:${count}`);
  }

  // Metadata similarity check (only if owner has multiple agents)
  if (count > 1 && agent.metadata?.description && profile.descriptions.length > 1) {
    const agentWords = wordSet(agent.metadata.description);
    let maxSimilarity = 0;

    for (const otherDesc of profile.descriptions) {
      if (otherDesc === agent.metadata.description) continue; // Skip self
      const otherWords = wordSet(otherDesc);
      const similarity = jaccard(agentWords, otherWords);
      maxSimilarity = Math.max(maxSimilarity, similarity);
    }

    if (maxSimilarity > 0.8) {
      const deduction = Math.min(score, 10);
      score -= deduction;
      details.push(`-${deduction} High metadata similarity (${(maxSimilarity * 100).toFixed(0)}%) with sibling agent`);
      flags.push('METADATA_CLONE');
    } else if (maxSimilarity > 0.5) {
      const deduction = Math.min(score, 5);
      score -= deduction;
      details.push(`-${deduction} Moderate metadata similarity (${(maxSimilarity * 100).toFixed(0)}%)`);
    } else {
      details.push(`Metadata distinct from siblings (max ${(maxSimilarity * 100).toFixed(0)}% similarity)`);
    }
  }

  // Name pattern detection (common spam patterns)
  const name = agent.metadata?.name || '';
  if (/subagent-\d+/i.test(name) || /agent-\d{4,}/i.test(name) || /bot-\d{4,}/i.test(name)) {
    const deduction = Math.min(score, 10);
    score -= deduction;
    details.push(`-${deduction} Automated naming pattern: "${name}"`);
    flags.push('AUTO_NAMING');
  }

  score = Math.max(0, score);

  return { layer: 'sybil', score, maxScore: 25, details, flags };
}
