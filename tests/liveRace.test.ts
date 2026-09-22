import { describe, expect, it } from 'vitest';
import { createRng } from '../src/engine/rng.js';
import { getTrack } from '../src/engine/data/tracks.js';
import type { RaceEntry } from '../src/engine/race.js';
import { POINTS, simulateRace } from '../src/engine/race.js';
import {
  armPit, carOf, createLiveRace, fastForward, gapBetween, liveResults,
  order, setMode, startAttack, stepRace,
} from '../src/engine/liveRace.js';

function field(): RaceEntry[] {
  return Array.from({ length: 16 }, (_, i) => ({
    driverId: `d${i}`, teamId: `t${i >> 1}`,
    carPace: 95 - i * 1.4, reliability: 92,
    speed: 90 - i, consistency: 88 - i * 0.8, tyres: 85 - i * 0.6,
    starts: 80, wet: 75, composure: 82, pitCrew: 80, grid: i + 1,
  }));
}

const track = getTrack('lario');

describe('gara live', () => {
  it('parte con tutti in pista e nessuno arrivato', () => {
    const race = createLiveRace(track, field(), createRng(1));
    expect(race.cars).toHaveLength(16);
    expect(order(race)).toHaveLength(16);
    expect(race.finished).toBe(false);
    expect(race.lap).toBe(1);
  });

  it('avanza nel tempo e fa progredire le vetture', () => {
    const race = createLiveRace(track, field(), createRng(2));
    const before = race.cars[0]!.progress;
    for (let i = 0; i < 40; i++) stepRace(race, 0.25);
    expect(race.t).toBeCloseTo(10, 5);
    expect(race.cars[0]!.progress).toBeGreaterThan(before);
  });

  it('è deterministica a parità di seed e di passo', () => {
    const run = () => {
      const r = createLiveRace(track, field(), createRng(77));
      fastForward(r, 4);
      return liveResults(r).map((x) => `${x.driverId}:${x.position}`);
    };
    expect(run()).toEqual(run());
  });

  it('arriva in fondo e produce un risultato completo', () => {
    const race = createLiveRace(track, field(), createRng(3));
    fastForward(race);
    expect(race.finished).toBe(true);
    const results = liveResults(race);
    expect(results).toHaveLength(16);
    expect(new Set(results.map((r) => r.position)).size).toBe(16);
    const winner = results.find((r) => r.position === 1)!;
    expect(winner.dnf).toBe(false);
    expect(winner.points).toBeGreaterThanOrEqual(25);
    expect(results.filter((r) => r.position > 10 && !r.fastestLap).every((r) => r.points === 0)).toBe(true);
  });

  it('i distacchi crescono andando indietro nella classifica', () => {
    const race = createLiveRace(track, field(), createRng(4));
    for (let i = 0; i < 600; i++) stepRace(race, 1);
    const rows = order(race);
    const leader = rows[0]!;
    let previous = -Infinity;
    for (const c of rows) {
      const g = gapBetween(race, leader, c);
      expect(g).toBeGreaterThanOrEqual(previous - 1e-6);
      previous = g;
    }
  });

  it('la sosta ai box costa tempo e azzera il degrado', () => {
    const race = createLiveRace(track, field(), createRng(5));
    const me = carOf(race, 'd0')!;
    for (let i = 0; i < 400; i++) stepRace(race, 1);
    const wornDown = me.tyre.wear;
    expect(wornDown).toBeGreaterThan(0);
    armPit(me, 'H');
    const progressBefore = me.progress;
    for (let i = 0; i < 200; i++) stepRace(race, 1);
    expect(me.stops).toBe(1);
    expect(me.tyre.compound).toBe('H');
    expect(me.tyre.wear).toBeLessThan(wornDown);
    expect(me.progress - progressBefore).toBeLessThan(200 / track.baseLap);
  });

  it('la modalità motore cambia il passo e il degrado', () => {
    const build = (mode: 'conserve' | 'push') => {
      const race = createLiveRace(track, field(), createRng(9));
      const car = carOf(race, 'd5')!;
      setMode(car, mode);
      for (let i = 0; i < 300; i++) stepRace(race, 1);
      return car;
    };
    const push = build('push');
    const conserve = build('conserve');
    expect(push.progress).toBeGreaterThan(conserve.progress);
    expect(push.tyre.wear).toBeGreaterThan(conserve.tyre.wear);
  });

  it("l'attacco aumenta le probabilità di sorpasso", () => {
    const passes = (attack: boolean) => {
      let total = 0;
      for (let seed = 0; seed < 25; seed++) {
        const race = createLiveRace(track, field(), createRng(seed * 13 + 1));
        const car = carOf(race, 'd7')!;
        for (let i = 0; i < 120; i++) {
          if (attack && race.t >= car.attackUntil) startAttack(race, car);
          stepRace(race, 0.5);
        }
        total += 8 - order(race).findIndex((c) => c === car);
      }
      return total;
    };
    expect(passes(true)).toBeGreaterThan(passes(false));
  });

  it('il contatore dei giri non torna mai indietro', () => {
    // Regressione: quando il leader andava ai box passava in testa chi non
    // aveva ancora tagliato la linea, e il giro mostrato scendeva anche di tre.
    for (let seed = 0; seed < 12; seed++) {
      const race = createLiveRace(track, field(), createRng(seed * 17 + 5));
      let previous = race.lap;
      for (let i = 0; i < 4000 && !race.finished; i++) {
        stepRace(race, 1);
        expect(race.lap, `seed ${seed}`).toBeGreaterThanOrEqual(previous);
        previous = race.lap;
      }
    }
  });

  it('la classifica è un ordine totale anche a metà gara', () => {
    const race = createLiveRace(track, field(), createRng(31));
    for (let i = 0; i < 1500; i++) stepRace(race, 1);
    const rows = order(race);
    expect(new Set(rows.map((c) => c.entry.driverId)).size).toBe(rows.length);
  });

  it('i distacchi finali crescono con la posizione', () => {
    // Regressione: si misuravano sul progress, che dopo l'arrivo si congela
    // dove capita, e il secondo classificato risultava a zero mentre il sesto
    // era più vicino del quinto.
    for (let seed = 0; seed < 10; seed++) {
      const race = createLiveRace(track, field(), createRng(seed * 23 + 4));
      fastForward(race);
      const finishers = liveResults(race).filter((r) => !r.dnf);
      let previous = -1;
      for (const r of finishers) {
        expect(r.gap, `seed ${seed} · P${r.position}`).not.toBeNull();
        expect(r.gap!, `seed ${seed} · P${r.position}`).toBeGreaterThanOrEqual(previous - 1e-6);
        previous = r.gap!;
      }
    }
  });

  it('produce esiti nella stessa forma della gara simulata', () => {
    const entries = field();
    const fast = simulateRace(track, entries, createRng(21));
    const race = createLiveRace(track, entries, createRng(21));
    fastForward(race);
    const live = liveResults(race);
    expect(live).toHaveLength(fast.results.length);
    const fastPoints = fast.results.reduce((s, r) => s + r.points, 0);
    const livePoints = live.reduce((s, r) => s + r.points, 0);
    // Stessa scala di punti: cambia la cadenza della simulazione, non le
    // regole. Il monte può differire di un punto perché il giro veloce lo
    // assegna solo se chi lo firma chiude nei primi dieci, e a cadenze diverse
    // può essere un pilota diverso.
    expect(Math.abs(livePoints - fastPoints)).toBeLessThanOrEqual(1);
    expect(livePoints).toBeGreaterThanOrEqual(POINTS.reduce((s, p) => s + p, 0));
  });
});
