import { describe, it, expect } from 'vitest';
import { canonicalJSON } from '../src/utils.js';

describe('canonicalJSON', () => {
  it('sorts top-level keys alphabetically', () => {
    const a = canonicalJSON({ z: 1, a: 2, m: 3 });
    const b = canonicalJSON({ a: 2, m: 3, z: 1 });
    expect(a).toBe(b);
    expect(JSON.parse(a)).toEqual({ a: 2, m: 3, z: 1 });
  });

  it('sorts nested object keys recursively', () => {
    const a = canonicalJSON({ outer: { z: 1, a: 2 }, b: 3 });
    const b = canonicalJSON({ b: 3, outer: { a: 2, z: 1 } });
    expect(a).toBe(b);
  });

  it('preserves array order (does not sort arrays)', () => {
    const result = canonicalJSON({ items: [3, 1, 2] });
    expect(JSON.parse(result).items).toEqual([3, 1, 2]);
  });

  it('handles null values', () => {
    const result = canonicalJSON({ a: null, b: 1 });
    expect(JSON.parse(result)).toEqual({ a: null, b: 1 });
  });

  it('handles empty objects', () => {
    expect(canonicalJSON({})).toBe('{}');
  });

  it('handles nested arrays of objects', () => {
    const a = canonicalJSON({ layers: [{ z: 1, a: 2 }, { y: 3, b: 4 }] });
    const b = canonicalJSON({ layers: [{ a: 2, z: 1 }, { b: 4, y: 3 }] });
    expect(a).toBe(b);
  });

  it('produces identical output for same TrustReport with different key order', () => {
    const report1 = {
      agentId: 1870,
      compositeScore: 95,
      owner: '0xabc',
      layers: [{ layer: 'sybil', score: 25, maxScore: 25 }],
    };
    const report2 = {
      layers: [{ maxScore: 25, layer: 'sybil', score: 25 }],
      owner: '0xabc',
      agentId: 1870,
      compositeScore: 95,
    };
    expect(canonicalJSON(report1)).toBe(canonicalJSON(report2));
  });
});
