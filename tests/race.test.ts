import { describe, expect, it } from 'vitest';
import { createRng } from '../src/engine/rng.js';
import { launchDelta, simulateRace, simulateQualifying, type RaceEntry } from '../src/engine/race.js';
import { strategiesFor } from '../src/engine/strategy.js';
import { getTrack, TRACKS } from '../src/engine/data/tracks.js';
import { breaksCompoundRule } from '../src/engine/rules.js';

function entry(id: string, carPace: number, skill: number, grid: number): RaceEntry {
  return {
    driverId: id, teamId: `t-${id}`, carPace, reliability: 92,
    speed: skill, consistency: skill, tyres: skill, starts: skill,
    wet: skill, composure: skill, technical: skill, pitCrew: 80, grid,
  };
}

function field(): RaceEntry[] {
  return Array.from({ length: 20 }, (_, i) =>
    entry(`d${i}`, 96 - i * 1.2, 90 - i * 1.1, i + 1));
}

describe('simulazione di gara', () => {
  const track = getTrack('lario');

  it('al via la bravura pesa più del caso', () => {
    // Il difetto che questa prova chiude: lo spunto valeva ±0,22s di abilità
    // contro un rumore di deviazione 0,55s, cioè il caso pesava due volte e
    // mezzo il pilota. Con la griglia a 0,28s per posizione erano due file
    // regalate ai dadi, e la qualifica non contava niente.
    const sample = (starts: number) => {
      const rng = createRng(5);
      const xs = Array.from({ length: 4000 }, () => launchDelta(starts, false, rng));
      const mean = xs.reduce((a, b) => a + b, 0) / xs.length;
      const sd = Math.sqrt(xs.reduce((a, b) => a + (b - mean) ** 2, 0) / xs.length);
      return { mean, sd };
    };
    const best = sample(95);
    const worst = sample(55);
    // Il migliore guadagna, il peggiore perde.
    expect(best.mean).toBeLessThan(0);
    expect(worst.mean).toBeGreaterThan(0);
    // E il divario fra i due vale più di due deviazioni del rumore: il
    // sorteggio può togliere una posizione, non tre.
    expect(worst.mean - best.mean).toBeGreaterThan(2 * best.sd);
  });

  it('le strategie sono ordinate, dentro la gara e con stint sensati', () => {
    // Su tutti i tracciati, non su uno: le lunghezze degli stint si ricavano
    // dai giri e dal degrado, e sono le piste lunghe e abrasive quelle dove il
    // conto si rompe.
    for (const t of Object.values(TRACKS)) {
      for (const s of strategiesFor(t)) {
        expect(s.fit).toHaveLength(s.stops.length);
        expect(s.stops.length).toBeGreaterThanOrEqual(1);
        let prev = 0;
        for (const lap of s.stops) {
          expect(lap).toBeGreaterThan(prev);
          expect(lap).toBeLessThan(t.laps);
          expect(lap - prev).toBeGreaterThanOrEqual(3);
          prev = lap;
        }
        // Anche l'ultimo stint dura qualcosa: una sosta all'ultimo giro non è
        // una strategia, è un errore di calcolo.
        expect(t.laps - prev).toBeGreaterThanOrEqual(3);
        // E nessuna può portare alla penalità delle due mescole: scoprire
        // venticinque secondi al traguardo non è una regola, è un agguato.
        expect(breaksCompoundRule([s.start, ...s.fit], false)).toBe(false);
      }
    }
  });

  it('restituisce un risultato per ogni iscritto, con posizioni uniche', () => {
    const { results } = simulateRace(track, field(), createRng(1));
    expect(results).toHaveLength(20);
    expect(new Set(results.map((r) => r.position)).size).toBe(20);
  });

  it('è deterministica a parità di seed', () => {
    const a = simulateRace(track, field(), createRng(555));
    const b = simulateRace(track, field(), createRng(555));
    expect(a.results.map((r) => r.driverId)).toEqual(b.results.map((r) => r.driverId));
  });

  it('assegna i punti secondo la scala ufficiale', () => {
    const { results } = simulateRace(track, field(), createRng(3));
    const winner = results.find((r) => r.position === 1)!;
    expect(winner.points).toBeGreaterThanOrEqual(25);
    expect(results.filter((r) => r.position > 10 && !r.fastestLap).every((r) => r.points === 0)).toBe(true);
  });

  it('la macchina migliore vince più spesso, ma non sempre', () => {
    let topCarWins = 0;
    const runs = 120;
    for (let i = 0; i < runs; i++) {
      const { results } = simulateRace(track, field(), createRng(i * 31 + 7));
      if (results.find((r) => r.position === 1)!.driverId === 'd0') topCarWins++;
    }
    expect(topCarWins / runs).toBeGreaterThan(0.25);
    expect(topCarWins / runs).toBeLessThan(0.9);
  });

  it('i ritiri restano in una forbice plausibile', () => {
    let dnf = 0, starts = 0;
    for (let i = 0; i < 60; i++) {
      const { results } = simulateRace(track, field(), createRng(i * 17 + 1));
      dnf += results.filter((r) => r.dnf).length;
      starts += results.length;
    }
    const rate = dnf / starts;
    expect(rate).toBeGreaterThan(0.01);
    expect(rate).toBeLessThan(0.25);
  });

  it('la qualifica elimina a manche, e la griglia segue le manche', () => {
    const field = Array.from({ length: 20 }, (_, i) => entry(`d${i}`, 90 - i * 0.8, 88 - i, i + 1));
    const grid = simulateQualifying(track, field, createRng(4));
    expect(grid).toHaveLength(20);
    expect(grid.map((q) => q.position)).toEqual(field.map((_, i) => i + 1));

    // Chi esce in Q1 parte dalla sedicesima fila in giù, anche se in Q1 ha
    // girato più forte di chi poi è arrivato in Q3: conta passare il taglio.
    const q1Out = grid.slice(15);
    const q2Out = grid.slice(10, 15);
    const q3 = grid.slice(0, 10);
    expect(q1Out).toHaveLength(5);
    expect(q2Out).toHaveLength(5);
    // Dentro ogni manche l'ordine è quello dei tempi.
    for (const block of [q3, q2Out, q1Out]) {
      for (let i = 1; i < block.length; i++) {
        expect(block[i]!.lapTime).toBeGreaterThanOrEqual(block[i - 1]!.lapTime);
      }
    }
  });

  it('la pista si gomma: in Q3 si gira più forte che in Q1', () => {
    // Su venti piloti identici la differenza fra il primo e il sedicesimo
    // non può che venire dall'evoluzione della pista.
    const field = Array.from({ length: 20 }, (_, i) => entry(`d${i}`, 85, 85, i + 1));
    const grid = simulateQualifying(track, field, createRng(11));
    const mediaQ3 = grid.slice(0, 10).reduce((s, q) => s + q.lapTime, 0) / 10;
    const mediaQ1 = grid.slice(15).reduce((s, q) => s + q.lapTime, 0) / 5;
    expect(mediaQ3).toBeLessThan(mediaQ1);
  });
});
