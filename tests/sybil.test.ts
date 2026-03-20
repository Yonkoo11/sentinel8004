import { describe, it, expect } from 'vitest';
import { scoreSybil, buildOwnerProfiles } from '../src/layers/sybil.js';
import type { AgentRecord } from '../src/types.js';

function makeAgent(id: number, owner: string, name: string, description: string): AgentRecord {
  return {
    agentId: id,
    owner,
    tokenURI: '',
    agentWallet: null,
    metadata: { name, description, services: [] },
    metadataFormat: 'raw-json',
    metadataError: null,
  };
}

describe('scoreSybil', () => {
  it('gives max score (25) for single-agent owner', () => {
    const agents = [makeAgent(1, '0xA', 'SoloAgent', 'A unique solo agent')];
    const profiles = buildOwnerProfiles(agents);
    const result = scoreSybil(agents[0], profiles);
    expect(result.score).toBe(25);
    expect(result.flags).toEqual([]);
  });

  it('gives 25 for <= 3 agents with distinct metadata', () => {
    const agents = [
      makeAgent(1, '0xA', 'PaymentBot', 'Handles payment processing and settlement on Celo blockchain with USDC'),
      makeAgent(2, '0xA', 'WeatherOracle', 'Fetches real-time weather data from OpenWeather API for smart contracts'),
      makeAgent(3, '0xA', 'NFTMinter', 'Creates and manages NFT collections with custom metadata on IPFS storage'),
    ];
    const profiles = buildOwnerProfiles(agents);
    const result = scoreSybil(agents[0], profiles);
    expect(result.score).toBe(25);
  });

  it('deducts for 4-10 agents from same owner', () => {
    const agents = Array.from({ length: 5 }, (_, i) =>
      makeAgent(i, '0xB', `Agent${i}`, `Unique description number ${i} with extra text`)
    );
    const profiles = buildOwnerProfiles(agents);
    const result = scoreSybil(agents[0], profiles);
    expect(result.score).toBeLessThanOrEqual(15);
    expect(result.flags.some(f => f.startsWith('OWNER_CONCENTRATION'))).toBe(true);
  });

  it('caps at 0 + MASS_REGISTRATION for 51+ agents', () => {
    const agents = Array.from({ length: 55 }, (_, i) =>
      makeAgent(i, '0xC', `bot-${i}`, 'Same description for all')
    );
    const profiles = buildOwnerProfiles(agents);
    const result = scoreSybil(agents[0], profiles);
    expect(result.score).toBe(0);
    expect(result.flags.some(f => f.startsWith('MASS_REGISTRATION'))).toBe(true);
  });

  it('flags METADATA_CLONE when Jaccard > 0.8', () => {
    const desc = 'This is a very detailed description about an AI agent that does things';
    const agents = [
      makeAgent(1, '0xD', 'Agent1', desc),
      makeAgent(2, '0xD', 'Agent2', desc),  // identical
    ];
    const profiles = buildOwnerProfiles(agents);
    const result = scoreSybil(agents[0], profiles);
    expect(result.flags).toContain('METADATA_CLONE');
  });

  it('does not flag METADATA_CLONE for distinct descriptions', () => {
    const agents = [
      makeAgent(1, '0xE', 'Agent1', 'This agent handles payment processing on Celo'),
      makeAgent(2, '0xE', 'Agent2', 'Completely different task about weather data analysis'),
    ];
    const profiles = buildOwnerProfiles(agents);
    const result = scoreSybil(agents[0], profiles);
    expect(result.flags).not.toContain('METADATA_CLONE');
  });

  it('detects AUTO_NAMING pattern', () => {
    const agents = [makeAgent(1, '0xF', 'subagent-12345', 'Some description')];
    const profiles = buildOwnerProfiles(agents);
    const result = scoreSybil(agents[0], profiles);
    expect(result.flags).toContain('AUTO_NAMING');
  });

  it('gives 25 for owner with no profile data', () => {
    const agent = makeAgent(1, '0xG', 'Orphan', 'No profile');
    const profiles = new Map(); // empty
    const result = scoreSybil(agent, profiles);
    expect(result.score).toBe(25);
  });
});
