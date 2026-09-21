import { describe, expect, it } from 'vitest';
import { createRng } from '../src/engine/rng.js';
import { createNewgen, overall } from '../src/engine/driver.js';
import { createStaffMember, staffGrowthMultiplier, MAX_GROWTH_MULTIPLIER } from '../src/engine/staff.js';
import {
  applyTraining, emptyPlan, MINIGAME_AUTO, minigameMultiplier, pickMinigame,
  trainingLimits, validatePlan, MAX_PER_CATEGORY,
} from '../src/engine/training.js';

const plan = (sim: number, fit: number, eng: number, med: number) =>
  ({ simulator: sim, fitness: fit, engineering: eng, media: med });

describe('allenamento settimanale', () => {
  it('impone il tetto per categoria e quello totale', () => {
    const d = createNewgen(createRng(1), { potentialAnchor: 76 });
    const limits = trainingLimits(d, false);
    expect(limits.total).toBe(10);
    expect(limits.perCategory.simulator).toBe(MAX_PER_CATEGORY);
    expect(validatePlan(plan(4, 3, 2, 1), limits)).toEqual([]);
    expect(validatePlan(plan(5, 0, 0, 0), limits).length).toBeGreaterThan(0);
    expect(validatePlan(plan(4, 4, 4, 4), limits).length).toBeGreaterThan(0);
  });

  it('la settimana di gara concede meno sessioni', () => {
    const d = createNewgen(createRng(2), { potentialAnchor: 76 });
    expect(trainingLimits(d, true).total).toBe(6);
  });

  it('lo staff alza i tetti, non i punteggi', () => {
    const d = createNewgen(createRng(3), { potentialAnchor: 76 });
    d.staff.push(createStaffMember(createRng(4), 'coach', 80));
    d.staff.push(createStaffMember(createRng(5), 'trainer', 70));
    const limits = trainingLimits(d, false);
    expect(limits.perCategory.simulator).toBe(MAX_PER_CATEGORY + 1);
    expect(limits.total).toBe(12);
  });

  it('il minigioco dipende dalla categoria più investita e non si ripete', () => {
    expect(pickMinigame(plan(4, 2, 1, 0), null)).toBe('thermal');
    expect(pickMinigame(plan(4, 2, 1, 0), 'thermal')).toBe('reaction');
    expect(pickMinigame(plan(0, 0, 0, 4), null)).toBeNull();
  });

  it('il moltiplicatore resta nella banda 0.85–1.30', () => {
    expect(minigameMultiplier(0)).toBeCloseTo(0.85);
    expect(minigameMultiplier(1)).toBeCloseTo(1.30);
    expect(minigameMultiplier(-5)).toBeCloseTo(0.85);
    expect(minigameMultiplier(9)).toBeCloseTo(1.30);
  });
});

describe('lo staff compra tempo, non talento', () => {
  it('nessun allenamento supera mai il tetto dell attributo', () => {
    const d = createNewgen(createRng(11), { potentialAnchor: 90 });
    d.staff.push(createStaffMember(createRng(12), 'coach', 99));
    d.staff.push(createStaffMember(createRng(13), 'trainer', 99));
    d.staff.push(createStaffMember(createRng(14), 'physio', 99));
    for (let w = 0; w < 400; w++) applyTraining(d, plan(4, 4, 4, 0), 1.30);
    for (const k of Object.keys(d.attrs) as (keyof typeof d.attrs)[]) {
      expect(d.attrs[k]).toBeLessThanOrEqual(d.caps[k] + 1e-9);
    }
    expect(overall(d.attrs)).toBeLessThanOrEqual(overall(d.caps) + 1e-9);
  });

  it('il moltiplicatore dello staff è limitato a 1.40', () => {
    const d = createNewgen(createRng(15), { potentialAnchor: 76 });
    expect(staffGrowthMultiplier(d)).toBe(1);
    for (const role of ['coach', 'trainer', 'physio'] as const) {
      d.staff.push(createStaffMember(createRng(16), role, 100));
    }
    // I professionisti non superano mai qualità 96: il tetto teorico resta irraggiungibile.
    expect(staffGrowthMultiplier(d)).toBeGreaterThan(1.35);
    expect(staffGrowthMultiplier(d)).toBeLessThan(MAX_GROWTH_MULTIPLIER);
  });

  it('con lo staff si arriva al proprio tetto prima, non più in alto', () => {
    const mk = () => createNewgen(createRng(21), { potentialAnchor: 85, ageMin: 19, ageMax: 19 });
    const solo = mk();
    const assistito = mk();
    for (const role of ['coach', 'trainer', 'physio'] as const) {
      assistito.staff.push(createStaffMember(createRng(22), role, 90));
    }
    for (let w = 0; w < 36 * 5; w++) {
      applyTraining(solo, plan(4, 3, 3, 0), MINIGAME_AUTO);
      applyTraining(assistito, plan(4, 3, 3, 0), MINIGAME_AUTO);
    }
    expect(overall(assistito.attrs)).toBeGreaterThan(overall(solo.attrs));
    expect(overall(assistito.caps)).toBeCloseTo(overall(solo.caps), 6);
  });

  it('un piano vuoto non fa crescere nulla', () => {
    const d = createNewgen(createRng(31), { potentialAnchor: 76 });
    const before = overall(d.attrs);
    applyTraining(d, emptyPlan(), MINIGAME_AUTO);
    expect(overall(d.attrs)).toBeCloseTo(before, 10);
  });
});
