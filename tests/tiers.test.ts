import { describe, expect, it } from 'vitest';
import { createRng } from '../src/engine/rng.js';
import { createWorld } from '../src/engine/world.js';
import { CAR_KEYS } from '../src/engine/types.js';
import { carPace } from '../src/engine/regulations.js';
import {
  BAND_DECAY, DEV_BAND, TIER_CAR, TIERS, clampToTier, decayBand, moveToTier,
  reshuffleTiers, reviewTiers, tierCar, tierProgress,
} from '../src/engine/tiers.js';
import {
  PHASE_COUNT, closePhase, phaseBonusFor, phaseJustClosed, phaseOf, roomFor, spendCredit,
} from '../src/engine/phases.js';
import { TEAM_SEEDS } from '../src/engine/data/teams.js';

describe('le fasce', () => {
  it('dentro una fascia le monoposto sono la stessa monoposto', () => {
    const w = createWorld({ seed: 4 });
    for (const tier of TIERS) {
      const inTier = Object.values(w.teams).filter((t) => t.tier === tier);
      for (const t of inTier) expect(t.car).toEqual(inTier[0]!.car);
    }
  });

  it('le fasce sono ordinate e larghe circa sei decimi in tutto', () => {
    const pace = TIERS.map((t) => carPace(TIER_CAR[t]));
    for (let i = 1; i < pace.length; i++) expect(pace[i]!).toBeLessThan(pace[i - 1]!);
    // Il prodotto che conta: lo scarto fra la prima e l'ultima fascia, per
    // quanto vale un punto sul giro, deve restare una griglia in cui si corre.
    expect(pace[0]! - pace.at(-1)!).toBeGreaterThan(8);
    expect(pace[0]! - pace.at(-1)!).toBeLessThan(13);
  });

  it('lo sviluppo non porta fuori dalla banda', () => {
    const car = tierCar('C');
    for (const k of CAR_KEYS) car[k] += 50;
    const clamped = clampToTier(car, 'C');
    for (const k of CAR_KEYS) expect(clamped[k]).toBe(TIER_CAR.C[k] + DEV_BAND);
  });

  it('la promozione è un sorpasso, non una soglia', () => {
    // Due squadre a banda piena nella stessa fascia non promuovono entrambe:
    // le quote non cambiano mai, quindi per salire bisogna togliere il posto a
    // qualcuno.
    const w = createWorld({ seed: 9 });
    const teams = Object.values(w.teams);
    for (const t of teams) {
      for (const k of CAR_KEYS) t.car[k] = TIER_CAR[t.tier][k] + DEV_BAND;
    }
    const moves = reviewTiers(teams);
    // Tutti a banda piena: nessuno ha fatto meglio di nessuno.
    expect(moves).toHaveLength(0);

    // Adesso una di fascia C si stacca e il più debole della B scivola.
    const challenger = teams.find((t) => t.tier === 'C')!;
    const incumbent = teams.find((t) => t.tier === 'B')!;
    for (const k of CAR_KEYS) incumbent.car[k] = TIER_CAR.B[k] - DEV_BAND;
    const swap = reviewTiers(teams);
    expect(swap.some((m) => m.teamId === challenger.id && m.to === 'B')).toBe(true);
    expect(swap.some((m) => m.teamId === incumbent.id && m.to === 'C')).toBe(true);
  });

  it('le quote restano quelle, promozioni e azzeramenti compresi', () => {
    const w = createWorld({ seed: 11 });
    const teams = Object.values(w.teams);
    const before = count(teams.map((t) => t.tier));

    for (const move of reviewTiers(teams)) moveToTier(w.teams[move.teamId]!, move.to);
    expect(count(teams.map((t) => t.tier))).toEqual(before);

    const rng = createRng(3);
    for (const move of reshuffleTiers(teams, () => rng.normal())) {
      w.teams[move.teamId]!.tier = move.to;
    }
    expect(count(teams.map((t) => t.tier))).toEqual(before);
  });

  it('salire di fascia non regala passo: cambia solo in che banda lavori', () => {
    const w = createWorld({ seed: 12 });
    const team = Object.values(w.teams).find((t) => t.tier === 'C')!;
    for (const k of CAR_KEYS) team.car[k] = TIER_CAR.C[k] + DEV_BAND;
    const before = carPace(team.car);
    moveToTier(team, 'B');
    const after = carPace(team.car);
    expect(after).toBeGreaterThan(before);
    expect(after - before).toBeLessThan(1);
  });

  it('la banda si riassorbe a fine stagione', () => {
    // Senza, si riempiva una volta e restava piena per sempre: dalla seconda
    // stagione tutte le scuderie stavano a banda 1,00 e la scala si bloccava.
    const w = createWorld({ seed: 13 });
    const team = Object.values(w.teams)[0]!;
    for (const k of CAR_KEYS) team.car[k] = TIER_CAR[team.tier][k] + DEV_BAND;
    expect(tierProgress(team)).toBeCloseTo(1, 5);
    decayBand(team);
    expect(tierProgress(team)).toBeCloseTo(BAND_DECAY, 5);
  });

  it('undici scuderie al via, e ogni fascia ne ha almeno due', () => {
    const w = createWorld({ seed: 14 });
    expect(TEAM_SEEDS).toHaveLength(10);
    const per = count(Object.values(w.teams).map((t) => t.tier));
    for (const tier of TIERS) expect(per[tier] ?? 0).toBeGreaterThanOrEqual(2);
  });
});

function count(tiers: string[]): Record<string, number> {
  const out: Record<string, number> = {};
  for (const t of tiers) out[t] = (out[t] ?? 0) + 1;
  return out;
}

describe('le tre fasi di campionato', () => {
  it('divide il calendario in tre blocchi e chiude i primi due', () => {
    const races = 24;
    expect(phaseOf(0, races)).toBe(0);
    expect(phaseOf(8, races)).toBe(1);
    expect(phaseOf(16, races)).toBe(2);
    expect(phaseOf(23, races)).toBe(PHASE_COUNT - 1);

    expect(phaseJustClosed(8, races)).toBe(0);
    expect(phaseJustClosed(16, races)).toBe(1);
    // L'ultima non paga: un bonus consegnato a dicembre sarebbe un bonus per
    // la macchina dell'anno dopo.
    expect(phaseJustClosed(24, races)).toBeNull();
    expect(phaseJustClosed(7, races)).toBeNull();
  });

  it('il bonus premia i risultati ma resta un riconoscimento', () => {
    expect(phaseBonusFor(200)).toBeGreaterThan(phaseBonusFor(0));
    // Fra chi domina e chi non segna non ci può essere un ordine di grandezza,
    // o il campionato si congela: il bonus spinge nella direzione opposta
    // all'handicap che tiene aperta la rimonta.
    expect(phaseBonusFor(400) / phaseBonusFor(0)).toBeLessThan(2.6);
  });

  it('accredita tutti e azzera i contatori della fase', () => {
    const w = createWorld({ seed: 15 });
    const teams = Object.values(w.teams);
    teams[0]!.phasePoints = 180;
    const credited = closePhase(w);
    expect(credited[teams[0]!.id]!).toBeGreaterThan(credited[teams[1]!.id]!);
    for (const t of teams) {
      expect(t.phasePoints).toBe(0);
      expect(t.devCredit).toBeGreaterThan(0);
    }
  });

  it('il credito versato su un reparto pieno non si perde: non si può versare', () => {
    const w = createWorld({ seed: 16 });
    const team = Object.values(w.teams)[0]!;
    team.devCredit = 1;
    for (const k of CAR_KEYS) team.car[k] = TIER_CAR[team.tier][k] + DEV_BAND;
    expect(roomFor(team, 'aero')).toBe(0);
    expect(spendCredit(team, 'aero', 1)).toBe(0);
    expect(team.devCredit).toBe(1);
  });

  it('il credito speso entra nella macchina e scala dal bonus', () => {
    const w = createWorld({ seed: 17 });
    const team = Object.values(w.teams)[0]!;
    team.devCredit = 0.5;
    const before = team.car.aero;
    expect(spendCredit(team, 'aero', 0.3)).toBeCloseTo(0.3, 5);
    expect(team.car.aero).toBeCloseTo(before + 0.3, 5);
    expect(team.devCredit).toBeCloseTo(0.2, 5);
  });
});
