/**
 * Casualità deterministica.
 *
 * Tutto il motore attinge da qui: nessun `Math.random()` deve comparire in
 * `src/engine`. Un mondo con lo stesso seed produce sempre la stessa storia,
 * quindi un bug è riproducibile e un bilanciamento è misurabile.
 */

export interface Rng {
  /** float in [0, 1) */
  next(): number;
  /** intero in [min, max] inclusi */
  int(min: number, max: number): number;
  /** float in [min, max) */
  range(min: number, max: number): number;
  /** distribuzione ~normale (Irwin–Hall a 3 campioni), media 0, dev ≈ 1 */
  normal(): number;
  /** un elemento a caso da una lista non vuota */
  pick<T>(items: readonly T[]): T;
  /** true con probabilità p */
  chance(p: number): boolean;
  /** mescola una copia della lista */
  shuffle<T>(items: readonly T[]): T[];
  /** genera un sotto-generatore indipendente, etichettato */
  fork(label: string): Rng;
  readonly seed: number;
}

/** Hash stringa → intero a 32 bit (FNV-1a). Serve a derivare sotto-seed stabili. */
export function hashSeed(label: string, base = 0x811c9dc5): number {
  let h = base >>> 0;
  for (let i = 0; i < label.length; i++) {
    h ^= label.charCodeAt(i);
    h = Math.imul(h, 0x01000193) >>> 0;
  }
  return h >>> 0;
}

export function createRng(seed: number): Rng {
  let a = seed >>> 0;

  const next = (): number => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };

  const rng: Rng = {
    seed,
    next,
    int: (min, max) => min + Math.floor(next() * (max - min + 1)),
    range: (min, max) => min + next() * (max - min),
    normal: () => (next() + next() + next() - 1.5) * 2,
    chance: (p) => next() < p,
    pick<T>(items: readonly T[]): T {
      if (items.length === 0) throw new Error('pick() su una lista vuota');
      return items[Math.floor(next() * items.length)]!;
    },
    shuffle<T>(items: readonly T[]): T[] {
      const out = items.slice();
      for (let i = out.length - 1; i > 0; i--) {
        const j = Math.floor(next() * (i + 1));
        [out[i], out[j]] = [out[j]!, out[i]!];
      }
      return out;
    },
    fork: (label) => createRng(hashSeed(label, seed)),
  };

  return rng;
}

/** Limita un valore fra min e max. */
export function clamp(v: number, min: number, max: number): number {
  return v < min ? min : v > max ? max : v;
}
