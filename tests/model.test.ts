import { describe, expect, it } from 'vitest';
import { ageGrowthCurve, diminishing, logistic, marginalDifficulty, HEADROOM_SCALE } from '../src/engine/curves.js';
import { freshTyre, temperaturePenalty, tyreLapPenalty, updateTemperature } from '../src/engine/tyres.js';
import { overtakeChance, ATTACK_RANGE } from '../src/engine/overtaking.js';
import { driverErrorChance, mechanicalFailureChance, safetyCarChancePerLap } from '../src/engine/incidents.js';
import { overtrainingPenalty, fatiguePenalty, moraleFactor } from '../src/engine/progression.js';
import { getTrack } from '../src/engine/data/tracks.js';

const track = getTrack('lario');
const street = getTrack('marabec');

describe('curve', () => {
  it('la curva di età non ha salti nel punto di picco', () => {
    // Regressione sulla formulazione di partenza: saliva a 1.5 e ripartiva da
    // 1.0, perdendo un terzo della crescita nel giorno del compleanno.
    for (const peak of [25, 26, 30, 33]) {
      const before = ageGrowthCurve(peak - 0.01, peak);
      const at = ageGrowthCurve(peak, peak);
      const after = ageGrowthCurve(peak + 0.01, peak);
      expect(Math.abs(before - at), `picco ${peak}`).toBeLessThan(0.01);
      expect(Math.abs(after - at), `picco ${peak}`).toBeLessThan(0.01);
    }
  });

  it('la curva di età sale fino al picco e poi scende', () => {
    expect(ageGrowthCurve(18, 26)).toBeGreaterThan(ageGrowthCurve(24, 26));
    expect(ageGrowthCurve(26, 26)).toBeGreaterThan(ageGrowthCurve(30, 26));
    expect(ageGrowthCurve(36, 26)).toBeLessThan(0.2);
  });

  it('la difficoltà marginale si misura in punti, non in frazioni del tetto', () => {
    // L'argomento è il margine che resta **in punti**: trenta o più valgono
    // pieno ritmo, e da lì in giù la crescita rallenta fino a fermarsi.
    expect(marginalDifficulty(HEADROOM_SCALE)).toBeCloseTo(1);
    expect(marginalDifficulty(HEADROOM_SCALE * 2)).toBeCloseTo(1);
    expect(marginalDifficulty(15)).toBeLessThan(0.4);
    expect(marginalDifficulty(3)).toBeLessThan(0.03);
    expect(marginalDifficulty(0)).toBe(0);
  });

  it('a parità di punti mancanti la crescita non dipende dal tetto', () => {
    // Il difetto che questa misura sostituisce: normalizzando sul tetto, un
    // pilota a dieci punti da 90 cresceva meno di uno a dieci punti da 40.
    expect(marginalDifficulty(10)).toBe(marginalDifficulty(10));
    expect(marginalDifficulty(12)).toBeGreaterThan(marginalDifficulty(10));
  });

  it('la logistica resta fra zero e uno', () => {
    // A punteggi estremi la sigmoide satura per limiti del virgola mobile:
    // quello che deve valere è che una probabilità non esca mai dall'intervallo.
    for (const x of [-50, -3, 0, 3, 50]) {
      expect(logistic(x)).toBeGreaterThanOrEqual(0);
      expect(logistic(x)).toBeLessThanOrEqual(1);
    }
    expect(logistic(0)).toBeCloseTo(0.5);
    expect(logistic(-3)).toBeLessThan(0.06);
    expect(logistic(3)).toBeGreaterThan(0.94);
  });

  it('i rendimenti decrescenti non sono lineari', () => {
    const one = diminishing(1.2) - 1;
    const three = diminishing(1.6) - 1;
    expect(three).toBeGreaterThan(one);
    expect(three).toBeLessThan(one * 3);
  });
});

describe('gomme', () => {
  it('il degrado ha tre fasi, con un crollo alla fine', () => {
    const at = (wear: number) => tyreLapPenalty({ ...freshTyre('M'), wear }, 70, track);
    const early = at(30) - at(10);
    const middle = at(60) - at(40);
    const cliff = at(90) - at(70);
    expect(early).toBeLessThan(middle);
    expect(middle).toBeLessThan(cliff);
    expect(cliff).toBeGreaterThan(2);
  });

  it('un pilota dolce sulle gomme paga meno', () => {
    const worn = { ...freshTyre('M'), wear: 75 };
    expect(tyreLapPenalty(worn, 90, track)).toBeLessThan(tyreLapPenalty(worn, 40, track));
  });

  it('fuori finestra termica si perde tempo, dentro no', () => {
    expect(temperaturePenalty(70)).toBe(0);
    expect(temperaturePenalty(45)).toBeGreaterThan(0);
    expect(temperaturePenalty(95)).toBeGreaterThan(0);
  });

  it('la temperatura converge verso la finestra e non esplode', () => {
    let tyre = freshTyre('M');
    for (let i = 0; i < 40; i++) {
      tyre = { ...tyre, temperature: updateTemperature(tyre, 1, 40, 1) };
    }
    expect(tyre.temperature).toBeGreaterThan(55);
    expect(tyre.temperature).toBeLessThan(90);
  });
});

describe('sorpassi', () => {
  const base = {
    gap: 0.2, attackSkill: 150, defenceSkill: 150,
    paceDelta: 0.3, tyreAdvantage: 0, drs: true, attacking: false,
  };

  it('nemmeno nel caso migliore il sorpasso è certo', () => {
    const best = overtakeChance(getTrack('saldanha'), {
      gap: 0, attackSkill: 200, defenceSkill: 0, paceDelta: 3,
      tyreAdvantage: 100, drs: true, attacking: true,
    });
    expect(best).toBeLessThan(0.999);
    expect(best).toBeGreaterThan(0.9);
  });

  it('la probabilità resta sempre fra zero e uno', () => {
    for (const paceDelta of [-5, 0, 5]) {
      for (const gap of [0, 0.4, 0.79]) {
        const p = overtakeChance(track, { ...base, gap, paceDelta });
        expect(p).toBeGreaterThanOrEqual(0);
        expect(p).toBeLessThanOrEqual(1);
      }
    }
  });

  it('oltre la portata non si tenta', () => {
    expect(overtakeChance(track, { ...base, gap: ATTACK_RANGE + 0.01 })).toBe(0);
  });

  it('più vicino, più veloce e più bravo aumentano le probabilità', () => {
    const far = overtakeChance(track, { ...base, gap: 0.7 });
    const close = overtakeChance(track, { ...base, gap: 0.1 });
    expect(close).toBeGreaterThan(far);
    expect(overtakeChance(track, { ...base, paceDelta: 1 }))
      .toBeGreaterThan(overtakeChance(track, { ...base, paceDelta: 0 }));
    expect(overtakeChance(track, { ...base, attackSkill: 190 }))
      .toBeGreaterThan(overtakeChance(track, { ...base, attackSkill: 110 }));
    expect(overtakeChance(track, { ...base, attacking: true }))
      .toBeGreaterThan(overtakeChance(track, base));
  });

  it('su un cittadino si passa molto meno', () => {
    expect(overtakeChance(street, base)).toBeLessThan(overtakeChance(track, base) * 0.7);
  });
});

describe('incidenti', () => {
  const base = {
    consistency: 80, fatigue: 0, tyreWear: 20, wetness: 0,
    wetSkill: 75, underPressure: false, reliability: 90,
  };

  it('costanza bassa, stanchezza, gomme finite e pioggia alzano il rischio', () => {
    const normal = driverErrorChance(base);
    expect(driverErrorChance({ ...base, consistency: 40 })).toBeGreaterThan(normal);
    expect(driverErrorChance({ ...base, fatigue: 90 })).toBeGreaterThan(normal);
    expect(driverErrorChance({ ...base, tyreWear: 95 })).toBeGreaterThan(normal);
    expect(driverErrorChance({ ...base, wetness: 1 })).toBeGreaterThan(normal);
    expect(driverErrorChance({ ...base, underPressure: true })).toBeGreaterThan(normal);
  });

  it('sul bagnato chi ci sa stare rischia meno', () => {
    const wet = { ...base, wetness: 1 };
    expect(driverErrorChance({ ...wet, wetSkill: 95 })).toBeLessThan(
      driverErrorChance({ ...wet, wetSkill: 35 }),
    );
  });

  it('non esplode a valori estremi', () => {
    expect(driverErrorChance({ ...base, consistency: 0 })).toBeLessThan(0.05);
    expect(mechanicalFailureChance(0)).toBeLessThan(0.02);
    expect(Number.isFinite(driverErrorChance({ ...base, consistency: 0 }))).toBe(true);
  });

  it('la safety car per giro riproduce la probabilità per gara', () => {
    const perLap = safetyCarChancePerLap(track, 0);
    const perRace = 1 - Math.pow(1 - perLap, track.laps);
    expect(perRace).toBeCloseTo(track.safetyCar, 2);
  });
});

describe('carico di allenamento', () => {
  it('oltre la soglia allenare di più rende di meno', () => {
    expect(overtrainingPenalty(0.5)).toBe(1);
    expect(overtrainingPenalty(0.85)).toBe(1);
    expect(overtrainingPenalty(1)).toBeLessThan(1);
    expect(overtrainingPenalty(1)).toBeGreaterThan(0.3);
  });

  it('stanchezza e morale muovono la crescita nella direzione giusta', () => {
    expect(fatiguePenalty(0)).toBe(1);
    expect(fatiguePenalty(100)).toBeCloseTo(0.4);
    expect(moraleFactor(0)).toBeLessThan(moraleFactor(100));
  });
});
