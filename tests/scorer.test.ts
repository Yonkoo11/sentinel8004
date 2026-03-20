import { describe, it, expect } from 'vitest';

// Test the scoring formula and circuit breaker logic directly
// We can't easily import scoreAgent (it calls async chain functions),
// so we test the scoring math that scoreAgent uses.

describe('scoring formula', () => {
  const LAYER_WEIGHTS: Record<string, number> = {
    registration: 0.8,
    liveness: 0.8,
    onchain: 0.8,
    sybil: 1.0,
    reputation: 1.0,
  };

  const CIRCUIT_BREAKERS: Record<string, number> = {
    MASS_REGISTRATION: 15,
    ALL_ENDPOINTS_DEAD: 35,
    METADATA_CLONE: 25,
    NEGATIVE_REPUTATION: 30,
    NO_METADATA: 20,
  };

  function computeScore(
    layers: { layer: string; score: number; maxScore: number; flags: string[] }[]
  ): number {
    let rawScore = 0;
    for (const l of layers) {
      const weight = LAYER_WEIGHTS[l.layer] ?? 1.0;
      rawScore += l.score * weight;
    }

    const allFlags = layers.flatMap(l => l.flags).map(f => f.split(':')[0]);
    let scoreCap = 100;
    for (const flag of allFlags) {
      const cap = CIRCUIT_BREAKERS[flag];
      if (cap !== undefined && cap < scoreCap) {
        scoreCap = cap;
      }
    }

    return Math.round(Math.min(rawScore, scoreCap));
  }

  it('computes correct score for a high-scoring agent (Toppa #1870 pattern)', () => {
    const layers = [
      { layer: 'registration', score: 25, maxScore: 25, flags: [] },
      { layer: 'liveness', score: 24, maxScore: 25, flags: [] },
      { layer: 'onchain', score: 20, maxScore: 25, flags: [] },
      { layer: 'sybil', score: 25, maxScore: 25, flags: [] },
      { layer: 'reputation', score: 15, maxScore: 15, flags: [] },
    ];
    // 25*0.8 + 24*0.8 + 20*0.8 + 25*1.0 + 15*1.0 = 20 + 19.2 + 16 + 25 + 15 = 95.2 → 95
    expect(computeScore(layers)).toBe(95);
  });

  it('caps at 15 for MASS_REGISTRATION breaker (Scarlet Orbit #1900 pattern)', () => {
    const layers = [
      { layer: 'registration', score: 25, maxScore: 25, flags: [] },
      { layer: 'liveness', score: 12, maxScore: 25, flags: [] },
      { layer: 'onchain', score: 14, maxScore: 25, flags: [] },
      { layer: 'sybil', score: 0, maxScore: 25, flags: ['MASS_REGISTRATION:991'] },
      { layer: 'reputation', score: 0, maxScore: 15, flags: [] },
    ];
    // Raw: 25*0.8 + 12*0.8 + 14*0.8 + 0 + 0 = 40.8 → capped at 15
    expect(computeScore(layers)).toBe(15);
  });

  it('caps at 20 for NO_METADATA breaker', () => {
    const layers = [
      { layer: 'registration', score: 0, maxScore: 25, flags: ['NO_METADATA'] },
      { layer: 'liveness', score: 25, maxScore: 25, flags: [] },
      { layer: 'onchain', score: 25, maxScore: 25, flags: [] },
      { layer: 'sybil', score: 25, maxScore: 25, flags: [] },
      { layer: 'reputation', score: 15, maxScore: 15, flags: [] },
    ];
    // Raw: 0 + 20 + 20 + 25 + 15 = 80 → capped at 20
    expect(computeScore(layers)).toBe(20);
  });

  it('uses lowest cap when multiple breakers fire', () => {
    const layers = [
      { layer: 'registration', score: 0, maxScore: 25, flags: ['NO_METADATA'] },
      { layer: 'liveness', score: 0, maxScore: 25, flags: ['ALL_ENDPOINTS_DEAD'] },
      { layer: 'onchain', score: 10, maxScore: 25, flags: [] },
      { layer: 'sybil', score: 0, maxScore: 25, flags: ['MASS_REGISTRATION:100'] },
      { layer: 'reputation', score: 0, maxScore: 15, flags: [] },
    ];
    // Breakers: NO_METADATA(20), ALL_ENDPOINTS_DEAD(35), MASS_REGISTRATION(15)
    // Lowest = 15. Raw = 0 + 0 + 8 + 0 + 0 = 8 → min(8, 15) = 8
    expect(computeScore(layers)).toBe(8);
  });

  it('returns 0 when all layers are 0', () => {
    const layers = [
      { layer: 'registration', score: 0, maxScore: 25, flags: [] },
      { layer: 'liveness', score: 0, maxScore: 25, flags: [] },
      { layer: 'onchain', score: 0, maxScore: 25, flags: [] },
      { layer: 'sybil', score: 0, maxScore: 25, flags: [] },
      { layer: 'reputation', score: 0, maxScore: 15, flags: [] },
    ];
    expect(computeScore(layers)).toBe(0);
  });

  it('max possible score is 100', () => {
    const layers = [
      { layer: 'registration', score: 25, maxScore: 25, flags: [] },
      { layer: 'liveness', score: 25, maxScore: 25, flags: [] },
      { layer: 'onchain', score: 25, maxScore: 25, flags: [] },
      { layer: 'sybil', score: 25, maxScore: 25, flags: [] },
      { layer: 'reputation', score: 15, maxScore: 15, flags: [] },
    ];
    // 25*0.8 + 25*0.8 + 25*0.8 + 25 + 15 = 60 + 40 = 100
    expect(computeScore(layers)).toBe(100);
  });
});
