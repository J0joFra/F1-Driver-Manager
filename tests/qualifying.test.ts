import { describe, expect, it } from 'vitest';
import { createRng } from '../src/engine/rng.js';
import { getTrack } from '../src/engine/data/tracks.js';
import { simulateQualifying, type RaceEntry } from '../src/engine/race.js';
import {
  COMPOUNDS, DEFAULT_PLAN, OUT_LAPS, TIMINGS, aiQualifyingPlan, qualifyingOutcome,
  type QualifyingPlan,
} from '../src/engine/qualifying.js';

const track = getTrack('lario');
const entry = (over: Partial<RaceEntry> = {}): RaceEntry => ({
  driverId: 'me', teamId: 't', carPace: 82, reliability: 92,
  speed: 80, consistency: 80, tyres: 80, starts: 80, wet: 75,
  composure: 80, technical: 80, pitCrew: 80, grid: 1, ...over,
});

/** Media su molte estrazioni: una scelta si giudica sul valore atteso. */
function expected(plan: QualifyingPlan, e = entry(), runs = 4000): number {
  let sum = 0;
  for (let i = 0; i < runs; i++) sum += qualifyingOutcome(plan, e, track, createRng(i)).delta;
  return sum / runs;
}

describe('qualifica', () => {
  it('le tre decisioni hanno tutte più di una risposta', () => {
    expect(TIMINGS.length).toBeGreaterThan(1);
    expect(COMPOUNDS.length).toBeGreaterThan(1);
    expect(OUT_LAPS.length).toBeGreaterThan(1);
    for (const c of [...TIMINGS, ...COMPOUNDS, ...OUT_LAPS]) {
      expect(c.label.length, c.value).toBeGreaterThan(0);
      expect(c.effect.length, c.value).toBeGreaterThan(10);
    }
  });

  it('ogni scelta rischiosa conviene, in media', () => {
    // Se rischiare avesse valore atteso negativo non sarebbe una scelta ma un
    // errore — e l'IA con la macchina lenta, che è quella che deve rischiare,
    // ci rimetterebbe sempre, allargando il divario da sola.
    const base = expected(DEFAULT_PLAN);
    expect(expected({ ...DEFAULT_PLAN, timing: 'tardi' }), 'uscire tardi').toBeLessThan(base);
    expect(expected({ ...DEFAULT_PLAN, timing: 'presto' }), 'uscire presto').toBeGreaterThan(base);
    expect(expected({ ...DEFAULT_PLAN, outLap: 'spinto' }), 'lancio spinto').toBeLessThan(base);
    expect(expected({ ...DEFAULT_PLAN, compound: 'M' }), 'medium').toBeGreaterThan(base);
  });

  it('il rischio lo paga chi non ha la testa per gestirlo', () => {
    const freddo = qualifyingOutcome({ ...DEFAULT_PLAN, timing: 'tardi' }, entry({ composure: 95 }), track, createRng(1));
    const caldo = qualifyingOutcome({ ...DEFAULT_PLAN, timing: 'tardi' }, entry({ composure: 40 }), track, createRng(1));
    expect(freddo.risk).toBeLessThan(caldo.risk);
  });

  it('spingere nel lancio si paga in gara', () => {
    const spinto = qualifyingOutcome({ ...DEFAULT_PLAN, outLap: 'spinto' }, entry(), track, createRng(2));
    const scarico = qualifyingOutcome({ ...DEFAULT_PLAN, outLap: 'scarico' }, entry(), track, createRng(2));
    expect(spinto.startWear).toBeGreaterThan(scarico.startWear + 5);
  });

  it('la sensibilità tecnica serve proprio a scaldare le gomme', () => {
    const bravo = qualifyingOutcome({ ...DEFAULT_PLAN, outLap: 'spinto' }, entry({ technical: 95 }), track, createRng(3));
    const scarso = qualifyingOutcome({ ...DEFAULT_PLAN, outLap: 'spinto' }, entry({ technical: 45 }), track, createRng(3));
    expect(bravo.delta).toBeLessThan(scarso.delta);
  });

  it('il piano del giocatore entra in qualifica e sposta la griglia', () => {
    const field = Array.from({ length: 16 }, (_, i) =>
      entry({ driverId: `d${i}`, carPace: 84, speed: 82, composure: 82, technical: 82 }));
    const conservativo = new Map([['d0', { timing: 'presto', compound: 'M', outLap: 'scarico' } as QualifyingPlan]]);
    const aggressivo = new Map([['d0', { timing: 'tardi', compound: 'S', outLap: 'spinto' } as QualifyingPlan]]);
    const a = simulateQualifying(track, field, createRng(9), false, conservativo)
      .find((q) => q.driverId === 'd0')!;
    const b = simulateQualifying(track, field, createRng(9), false, aggressivo)
      .find((q) => q.driverId === 'd0')!;
    expect(b.lapTime).toBeLessThan(a.lapTime);
    expect(b.note).toBeTruthy();
  });

  it("l'IA rischia quando ha la macchina lenta", () => {
    let lentiTardi = 0, velociTardi = 0;
    for (let i = 0; i < 200; i++) {
      if (aiQualifyingPlan(entry({ carPace: 64 }), createRng(i)).timing === 'tardi') lentiTardi++;
      if (aiQualifyingPlan(entry({ carPace: 92 }), createRng(i)).timing === 'tardi') velociTardi++;
    }
    expect(lentiTardi).toBeGreaterThan(velociTardi);
  });
});
