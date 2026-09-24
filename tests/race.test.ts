import { describe, expect, it } from 'vitest';
import { createRng } from '../src/engine/rng.js';
import { simulateRace, simulateQualifying, type RaceEntry } from '../src/engine/race.js';
import { getTrack } from '../src/engine/data/tracks.js';

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

  it('la qualifica ordina per tempo crescente', () => {
    const q = simulateQualifying(track, field(), createRng(9));
    const times = q.map((x) => x.lapTime);
    expect([...times].sort((a, b) => a - b)).toEqual(times);
    expect(q[0]!.position).toBe(1);
  });
});
