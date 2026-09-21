import { describe, expect, it } from 'vitest';
import { createRng, hashSeed } from '../src/engine/rng.js';

describe('rng deterministico', () => {
  it('produce la stessa sequenza a parità di seed', () => {
    const a = createRng(1234);
    const b = createRng(1234);
    const seqA = Array.from({ length: 50 }, () => a.next());
    const seqB = Array.from({ length: 50 }, () => b.next());
    expect(seqA).toEqual(seqB);
  });

  it('produce sequenze diverse con seed diversi', () => {
    expect(createRng(1).next()).not.toBe(createRng(2).next());
  });

  it('resta dentro i limiti richiesti', () => {
    const r = createRng(7);
    for (let i = 0; i < 2000; i++) {
      const v = r.next();
      expect(v).toBeGreaterThanOrEqual(0);
      expect(v).toBeLessThan(1);
      const n = r.int(3, 9);
      expect(n).toBeGreaterThanOrEqual(3);
      expect(n).toBeLessThanOrEqual(9);
    }
  });

  it('i fork sono indipendenti ma riproducibili', () => {
    const base = createRng(99);
    expect(base.fork('gara').next()).toBe(createRng(99).fork('gara').next());
    expect(base.fork('gara').next()).not.toBe(base.fork('mercato').next());
  });

  it('hashSeed è stabile', () => {
    expect(hashSeed('lario', 42)).toBe(hashSeed('lario', 42));
  });
});
