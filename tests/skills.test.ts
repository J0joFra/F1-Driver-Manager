import { describe, expect, it } from 'vitest';
import { createRng } from '../src/engine/rng.js';
import { createNewgen } from '../src/engine/driver.js';
import {
  BRANCHES, GRID_COLS, NO_EFFECTS, SKILL_TREE, TOTAL_COST, effectiveCap,
  pointsForRace, prerequisitesOf, skillEffects, spendPointsAsAi, unlockRefusal,
  unlockSkill,
} from '../src/engine/skills.js';

const driver = (seed = 1) => createNewgen(createRng(seed), { potentialAnchor: 76 });

/** Sblocca un nodo e tutto quello che gli serve, in ordine. */
function unlockChain(d: ReturnType<typeof driver>, id: string): void {
  const node = SKILL_TREE.find((n) => n.id === id)!;
  for (const before of prerequisitesOf(node)) unlockChain(d, before.id);
  unlockSkill(d, id);
}

describe('albero delle abilità', () => {
  it("ogni area ha una sola radice e un grafo che ci arriva tutto", () => {
    for (const branch of BRANCHES) {
      const nodes = SKILL_TREE.filter((n) => n.branch === branch.key);
      const roots = nodes.filter((n) => n.requires.length === 0);
      expect(roots, `radici di ${branch.key}`).toHaveLength(1);

      // Ogni nodo deve essere raggiungibile dalla radice: un nodo scollegato
      // sarebbe un punto speso che non si può mai spendere.
      const reached = new Set([roots[0]!.id]);
      for (let pass = 0; pass < nodes.length; pass++) {
        for (const n of nodes) {
          if (n.requires.length > 0 && n.requires.every((id) => reached.has(id))) reached.add(n.id);
        }
      }
      expect(reached.size, `raggiungibili in ${branch.key}`).toBe(nodes.length);

      // I collegamenti restano dentro l'area, o il grafo non si disegnerebbe.
      for (const n of nodes) {
        for (const from of prerequisitesOf(n)) {
          expect(from.branch, `${n.id} ← ${from.id}`).toBe(branch.key);
          // Un filo va sempre verso il basso: il grafo non ha anelli.
          expect(from.row, `${n.id} ← ${from.id}`).toBeLessThan(n.row);
        }
      }
    }
    expect(new Set(SKILL_TREE.map((n) => n.id)).size).toBe(SKILL_TREE.length);
  });

  it('i nodi stanno dentro la griglia che li disegna', () => {
    for (const n of SKILL_TREE) {
      expect(n.col, n.id).toBeGreaterThanOrEqual(0);
      expect(n.col, n.id).toBeLessThan(GRID_COLS);
      expect(n.row, n.id).toBeGreaterThanOrEqual(0);
      expect(n.row, n.id).toBeLessThan(4);
    }
  });

  it("l'albero tocca sia la guida sia il mestiere fuori dall'abitacolo", () => {
    const all = SKILL_TREE.map((n) => n.bonus);
    // Guida.
    expect(all.some((b) => b.tyreWear)).toBe(true);
    expect(all.some((b) => b.overtake)).toBe(true);
    expect(all.some((b) => b.wet)).toBe(true);
    // Persona.
    expect(all.some((b) => b.reputation)).toBe(true);
    expect(all.some((b) => b.sponsors)).toBe(true);
    expect(all.some((b) => b.salary)).toBe(true);
    expect(all.some((b) => b.development)).toBe(true);
  });

  it('un nodo in fondo chiede davvero tutti e due i rami', () => {
    const d = driver();
    d.skillPoints = 99;
    const fork = SKILL_TREE.find((n) => n.requires.length === 2)!;
    expect(unlockRefusal(d, fork)).toBe('mancano i nodi richiesti');

    // Con un solo ramo percorso ancora non basta: è la forma che rende la
    // scelta costosa.
    const [first, second] = prerequisitesOf(fork);
    unlockChain(d, first!.id);
    expect(unlockRefusal(d, fork)).toBe('mancano i nodi richiesti');
    unlockChain(d, second!.id);
    expect(unlockRefusal(d, fork)).toBeNull();
    expect(unlockSkill(d, fork.id)).toBe(true);
  });

  it('senza punti non si sblocca niente', () => {
    const d = driver();
    d.skillPoints = 0;
    const first = SKILL_TREE.find((n) => n.requires.length === 0)!;
    expect(unlockRefusal(d, first)).toBe('punti insufficienti');
    expect(unlockSkill(d, first.id)).toBe(false);
  });

  it('i punti si spendono davvero, e una sola volta', () => {
    const d = driver();
    d.skillPoints = 5;
    const first = SKILL_TREE.find((n) => n.requires.length === 0)!;
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
    for (const id of ['car3', 'car4']) unlockChain(d, id);
    const e = skillEffects(d);
    // 0.95 × 0.95 × 0.93: due miglioramenti indipendenti non si sommano.
    expect(e.tyreWear).toBeCloseTo(0.95 * 0.95 * 0.93, 6);
    expect(e.caps.tyres).toBe(1 + 2 + 3);
    expect(effectiveCap(d, 'tyres')).toBe(Math.min(99, d.caps.tyres + 6));
  });

  it('il tetto effettivo non supera 99 nemmeno con tutto sbloccato', () => {
    const d = driver();
    d.skillPoints = 99;
    for (const n of SKILL_TREE) unlockChain(d, n.id);
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
    // Una carriera lunga arriva a completare l'albero, ma solo quella.
    expect(TOTAL_COST / season).toBeGreaterThan(10);
    expect(TOTAL_COST / season).toBeLessThan(20);
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
      for (const before of prerequisitesOf(SKILL_TREE.find((n) => n.id === id)!)) {
        expect(d.perks, id).toContain(before.id);
      }
    }
  });

  it("l'IA con molti punti completa l'albero senza sforare", () => {
    const d = driver(9);
    d.skillPoints = TOTAL_COST;
    spendPointsAsAi(d);
    expect(d.perks).toHaveLength(SKILL_TREE.length);
    expect(d.skillPoints).toBe(0);
  });
});
