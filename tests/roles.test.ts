import { describe, expect, it } from 'vitest';
import { createRng } from '../src/engine/rng.js';
import { createNewgen } from '../src/engine/driver.js';
import { ratedRoles, roleRating, ROLES } from '../src/engine/roles.js';
import { ATTRIBUTE_KEYS, type Attributes } from '../src/engine/types.js';

const flat = (v: number): Attributes =>
  Object.fromEntries(ATTRIBUTE_KEYS.map((k) => [k, v])) as Attributes;

describe('ruoli del pilota', () => {
  it('i pesi di ogni ruolo sommano a uno', () => {
    for (const role of ROLES) {
      const total = Object.values(role.weights).reduce((s, w) => s + w, 0);
      expect(total, role.key).toBeCloseTo(1, 5);
    }
  });

  it('la scala va da zero a cinque e non esce mai', () => {
    for (const role of ROLES) {
      expect(roleRating(flat(1), role), role.key).toBe(0);
      expect(roleRating(flat(99), role), role.key).toBe(5);
      expect(roleRating(flat(45), role), role.key).toBe(0);
      // Mezzi punti, non decimali arbitrari.
      const mid = roleRating(flat(70), role);
      expect(mid * 2, role.key).toBe(Math.round(mid * 2));
    }
  });

  it('un attributo alto porta in cima il ruolo che lo usa', () => {
    const d = createNewgen(createRng(3), { potentialAnchor: 76 });
    for (const k of ATTRIBUTE_KEYS) d.attrs[k] = 50;
    d.attrs.wet = 95;
    d.caps = { ...d.attrs };
    expect(ratedRoles(d)[0]!.key).toBe('wet');
  });

  it('il potenziale non è mai sotto il voto attuale', () => {
    for (const seed of [1, 2, 3, 4, 5]) {
      const d = createNewgen(createRng(seed), { potentialAnchor: 76 });
      for (const role of ratedRoles(d)) {
        expect(role.potential, `${role.key} seed ${seed}`).toBeGreaterThanOrEqual(role.rating);
      }
    }
  });
});
