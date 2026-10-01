import { describe, expect, it } from 'vitest';
import { createRng } from '../src/engine/rng.js';
import { getTrack } from '../src/engine/data/tracks.js';
import { simulateRace, type RaceEntry } from '../src/engine/race.js';
import { simulateQualifying } from '../src/engine/qualifying.js';
import { TRACKS } from '../src/engine/data/tracks.js';
import { MAX_RACE_LAPS, breaksCompoundRule, raceLaps } from '../src/engine/rules.js';
import {
  COMPOUNDS, DEFAULT_PLAN, OUT_LAPS, SOFT_SETS, TIMINGS, affordable, aiQualifyingPlan,
  beginQualifying, currentSegment, cutAt, isOver, qualifyingGrid, qualifyingOutcome,
  runSegment, segmentsFor, type QualifyingPlan,
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

describe('la sessione a tre manche', () => {
  const field = (n = 18) => Array.from({ length: n }, (_, i) =>
    entry({ driverId: `d${i}`, carPace: 92 - i * 0.9, speed: 90 - i * 0.7 }));

  it('elimina a ogni manche e arriva a una griglia completa', () => {
    const s = beginQualifying(track, field(), createRng(3));
    const sizes: number[] = [];
    while (!isOver(s)) { sizes.push(s.alive.length); runSegment(s); }
    expect(sizes).toHaveLength(3);
    expect(sizes[1]).toBeLessThan(sizes[0]!);
    expect(sizes[2]).toBeLessThan(sizes[1]!);

    const grid = qualifyingGrid(s);
    expect(grid).toHaveLength(18);
    expect(new Set(grid.map((q) => q.position)).size).toBe(18);
    expect(grid.every((q) => q.lapTime > 0)).toBe(true);
  });

  it('chi esce prima parte dietro a chi esce dopo', () => {
    const s = beginQualifying(track, field(), createRng(4));
    runSegment(s);
    // Chi è uscito in Q1 sta in fondo alla coda, e in fondo deve restare.
    const q1Out = [...s.tail];
    while (!isOver(s)) runSegment(s);
    const grid = qualifyingGrid(s);
    const posOf = (id: string) => grid.find((q) => q.driverId === id)!.position;
    const worstSurvivor = Math.max(...s.alive.map(posOf));
    for (const id of q1Out) expect(posOf(id)).toBeGreaterThan(worstSurvivor);
  });

  it('il taglio si dimensiona sul gruppo che c’è davvero', () => {
    // Era scritto a mano — quindici e dieci superstiti — e con diciotto
    // iscritti la manche più dura sarebbe stata la seconda.
    for (const n of [12, 18, 20, 22]) {
      const segs = segmentsFor(n);
      const outQ1 = n - segs[0]!.survivors;
      const outQ2 = segs[0]!.survivors - segs[1]!.survivors;
      expect(outQ1).toBeGreaterThan(0);
      expect(Math.abs(outQ1 - outQ2)).toBeLessThanOrEqual(1);
    }
  });

  it('i treni di morbida finiscono, e quando finiscono si rimonta un usato', () => {
    const s = beginQualifying(track, field(), createRng(5));
    const sempreSoft = new Map(
      s.alive.map((id) => [id, { ...DEFAULT_PLAN, compound: 'S' } as QualifyingPlan]),
    );
    const id = s.alive[0]!;
    runSegment(s, sempreSoft);
    expect(s.state[id]!.softNew).toBe(SOFT_SETS - 1);
    runSegment(s, sempreSoft);
    expect(s.state[id]!.softNew).toBe(0);
    // In Q3 la morbida nuova non c'è più: si va su quella già usata, non su
    // una gomma che non esiste.
    expect(affordable('S', s.state[id]!)).toBe('Su');
    runSegment(s, sempreSoft);
    expect(s.state[id]!.compound).toBe('Su');
  });

  it('la linea del taglio cade dove la schermata la disegna', () => {
    const s = beginQualifying(track, field(), createRng(6));
    const atteso = currentSegment(s)!.survivors;
    expect(cutAt(s)).toBe(atteso);
    runSegment(s);
    expect(s.alive).toHaveLength(atteso);
  });

  it('la pista si gomma: in Q3 si gira più forte che in Q1', () => {
    // A parità di tutto il resto — stesso gruppo, stesso seme — il tempo che
    // vince Q3 deve battere quello che vinceva Q1 di più di quanto spieghi
    // l'aver tolto gli otto più lenti.
    const s = beginQualifying(track, field(), createRng(8));
    runSegment(s);
    const poleQ1 = s.state[s.alive[0]!]!.lap!;
    runSegment(s);
    runSegment(s);
    const grid = qualifyingGrid(s);
    expect(grid[0]!.lapTime).toBeLessThan(poleQ1);
  });

  it('si va in gara sul treno del sabato, non su gomma nuova', () => {
    const s = beginQualifying(track, field(), createRng(7));
    const prudente = new Map(s.alive.map((id) =>
      [id, { timing: 'meta', compound: 'M', outLap: 'scarico' } as QualifyingPlan]));
    const spinto = new Map(s.alive.map((id) =>
      [id, { timing: 'meta', compound: 'S', outLap: 'spinto' } as QualifyingPlan]));
    runSegment(s, prudente);
    const dolce = s.state[s.alive[0]!]!.startWear;
    const t = beginQualifying(track, field(), createRng(7));
    runSegment(t, spinto);
    expect(t.state[t.alive[0]!]!.startWear).toBeGreaterThan(dolce);
  });
});

describe('regolamento', () => {
  it('la distanza di gara è la più corta che superi i 305 km', () => {
    expect(raceLaps(5.79)).toBe(53);   // Monza: 53 giri, come nella realtà
    expect(raceLaps(7.00)).toBe(44);   // Spa: 44
    expect(raceLaps(5.86)).toBe(53);   // Silverstone: 52 nella realtà, 53 qui
    for (const t of TRACKS) {
      const km = t.lengthKm * t.laps;
      // Sempre oltre i 305, tranne dove il tetto ai giri lo impedisce.
      if (t.laps < MAX_RACE_LAPS) expect(km, t.id).toBeGreaterThanOrEqual(305);
      expect(km, t.id).toBeLessThan(312);
    }
  });

  it('il tetto ai giri è la ragione per cui Monaco è più corta', () => {
    // Non c'è un caso speciale per Monaco: c'è una regola sola, e su un
    // tracciato da 3.3 km produce 78 giri e 260 km.
    const monaco = TRACKS.find((t) => t.id === 'vallmar')!;
    expect(monaco.laps).toBe(MAX_RACE_LAPS);
    expect(monaco.lengthKm * monaco.laps).toBeLessThan(280);
  });

  it('due mescole diverse, su asciutto', () => {
    expect(breaksCompoundRule(['M'], false)).toBe(true);
    expect(breaksCompoundRule(['M', 'M'], false)).toBe(true);
    expect(breaksCompoundRule(['M', 'H'], false)).toBe(false);
    expect(breaksCompoundRule(['S', 'M', 'H'], false)).toBe(false);
    // Sul bagnato la regola non vale: si monta quello che serve.
    expect(breaksCompoundRule(['I'], true)).toBe(false);
  });

  it('una gara simulata rispetta sempre la regola delle due mescole', () => {
    const field = Array.from({ length: 16 }, (_, i) => entry({ driverId: `d${i}`, grid: i + 1 }));
    for (const seed of [1, 2, 3, 4, 5]) {
      const out = simulateRace(track, field, createRng(seed), { wet: false });
      // L'IA pianifica sempre almeno una sosta: nessuno deve prendersi i 25″.
      for (const r of out.results.filter((x) => !x.dnf)) {
        expect(r.penalised, `seed ${seed} · ${r.driverId}`).toBeFalsy();
      }
    }
  });
});
