import { describe, expect, it } from 'vitest';
import { createRng } from '../src/engine/rng.js';
import { createNewgen } from '../src/engine/driver.js';
import {
  BRANCHES, NO_EFFECTS, SKILL_TREE, effectiveCap, pointsForRace, prerequisiteOf,
  skillEffects, spendPointsAsAi, unlockRefusal, unlockSkill,
} from '../src/engine/skills.js';

const driver = (seed = 1) => createNewgen(createRng(seed), { potentialAnchor: 76 });

describe('albero delle abilità', () => {
  it('ogni ramo ha tre livelli in fila, senza buchi', () => {
    for (const branch of BRANCHES) {
      const tiers = SKILL_TREE.filter((n) => n.branch === branch.key)
        .map((n) => n.tier).sort((a, b) => a - b);
      expect(tiers, branch.key).toEqual([0, 1, 2]);
    }
    expect(SKILL_TREE).toHaveLength(BRANCHES.length * 3);
    expect(new Set(SKILL_TREE.map((n) => n.id)).size).toBe(SKILL_TREE.length);
  });

  it('non si salta un livello', () => {
    const d = driver();
    d.skillPoints = 99;
    const top = SKILL_TREE.find((n) => n.tier === 2)!;
    expect(unlockRefusal(d, top)).toBe('manca il nodo precedente');
    expect(unlockSkill(d, top.id)).toBe(false);
    expect(d.perks).toEqual([]);

    // Sbloccando in ordine si arriva in cima.
    const chain = SKILL_TREE.filter((n) => n.branch === top.branch).sort((a, b) => a.tier - b.tier);
    for (const n of chain) expect(unlockSkill(d, n.id), n.id).toBe(true);
    expect(d.perks).toHaveLength(3);
  });

  it('senza punti non si sblocca niente', () => {
    const d = driver();
    d.skillPoints = 0;
    const first = SKILL_TREE.find((n) => n.tier === 0)!;
    expect(unlockRefusal(d, first)).toBe('punti insufficienti');
    expect(unlockSkill(d, first.id)).toBe(false);
  });

  it('i punti si spendono davvero, e una sola volta', () => {
    const d = driver();
    d.skillPoints = 5;
    const first = SKILL_TREE.find((n) => n.tier === 0)!;
    expect(unlockSkill(d, first.id)).toBe(true);
    expect(d.skillPoints).toBe(5 - first.cost);
    // Ricomprarla non toglie altri punti.
    expect(unlockSkill(d, first.id)).toBe(false);
    expect(d.skillPoints).toBe(5 - first.cost);
  });

  it('un albero vuoto non cambia niente', () => {
    const d = driver();
    expect(skillEffects(d)).toEqual(NO_EFFECTS);
    for (const k of ['speed', 'tyres'] as const) {
      expect(effectiveCap(d, k)).toBe(d.caps[k]);
    }
  });

  it('i moltiplicatori si compongono, i bonus si sommano', () => {
    const d = driver();
    d.skillPoints = 99;
    for (const n of SKILL_TREE.filter((x) => x.branch === 'tyres').sort((a, b) => a.tier - b.tier)) {
      unlockSkill(d, n.id);
    }
    const e = skillEffects(d);
    // 0.95 × 0.94 × 0.92: due miglioramenti indipendenti non si sommano.
    expect(e.tyreWear).toBeCloseTo(0.95 * 0.94 * 0.92, 6);
    expect(e.caps.tyres).toBe(5);
    expect(effectiveCap(d, 'tyres')).toBe(Math.min(99, d.caps.tyres + 5));
  });

  it('il tetto effettivo non supera 99 nemmeno con tutto sbloccato', () => {
    const d = driver();
    d.skillPoints = 99;
    for (const n of [...SKILL_TREE].sort((a, b) => a.tier - b.tier)) unlockSkill(d, n.id);
    expect(d.perks).toHaveLength(SKILL_TREE.length);
    for (const k of Object.keys(d.caps) as (keyof typeof d.caps)[]) {
      d.caps[k] = 98;
      expect(effectiveCap(d, k), k).toBeLessThanOrEqual(99);
    }
  });

  it('i punti li dà il mestiere, non il palmarès', () => {
    // Legarli ai risultati innescava un ciclo: chi vince sblocca di più e
    // vince ancora. Una stagione da 24 gare vale quattro punti per tutti.
    const season = Array.from({ length: 24 }, (_, i) => pointsForRace(i + 1))
      .reduce((s, p) => s + p, 0);
    expect(season).toBe(4);
  });

  it("l'IA spende quello che ha e si ferma quando non basta", () => {
    const d = driver(4);
    d.skillPoints = 3;
    spendPointsAsAi(d);
    expect(d.perks.length).toBeGreaterThan(0);
    expect(d.skillPoints).toBeLessThan(3);
    // Non va mai in negativo e rispetta le precedenze.
    expect(d.skillPoints).toBeGreaterThanOrEqual(0);
    for (const id of d.perks) {
      const before = prerequisiteOf(SKILL_TREE.find((n) => n.id === id)!);
      if (before) expect(d.perks, id).toContain(before.id);
    }
  });

  it("l'IA con molti punti completa l'albero senza sforare", () => {
    const d = driver(9);
    const total = SKILL_TREE.reduce((s, n) => s + n.cost, 0);
    d.skillPoints = total;
    spendPointsAsAi(d);
    expect(d.perks).toHaveLength(SKILL_TREE.length);
    expect(d.skillPoints).toBe(0);
  });
});
