import { describe, expect, it } from 'vitest';
import { createWorld, endSeason, advanceWeek } from '../src/engine/world.js';
import { SEASON_WEEKS, driverStandings } from '../src/engine/season.js';
import { overall, potentialOverall } from '../src/engine/driver.js';
import type { World } from '../src/engine/types.js';
import { TEAM_SEEDS } from '../src/engine/data/teams.js';

const SEATS = TEAM_SEEDS.length * 2;

function runSeasons(world: World, n: number) {
  const summaries = [];
  for (let i = 0; i < n; i++) {
    while (world.week < SEASON_WEEKS) advanceWeek(world);
    summaries.push(endSeason(world));
  }
  return summaries;
}

function activeDrivers(world: World) {
  return Object.values(world.drivers).filter((d) => !d.retired && d.teamId);
}

describe('creazione del mondo', () => {
  it('riempie ogni sedile e ogni scuderia', () => {
    const w = createWorld({ seed: 1 });
    expect(Object.keys(w.teams)).toHaveLength(TEAM_SEEDS.length);
    for (const t of Object.values(w.teams)) expect(t.driverIds).toHaveLength(2);
    expect(activeDrivers(w)).toHaveLength(SEATS);
  });

  it('è riproducibile dal seed', () => {
    const a = createWorld({ seed: 4242 });
    const b = createWorld({ seed: 4242 });
    runSeasons(a, 3);
    runSeasons(b, 3);
    expect(a.champions).toEqual(b.champions);
  });

  it('il calendario non mette mai tre gare di fila', () => {
    const w = createWorld({ seed: 77 });
    let streak = 0;
    for (const slot of w.schedule) {
      streak = slot ? streak + 1 : 0;
      expect(streak).toBeLessThanOrEqual(2);
    }
  });
});

function meanPotential(world: World): number {
  const a = activeDrivers(world);
  return a.reduce((s, d) => s + potentialOverall(d), 0) / a.length;
}

describe('quaranta stagioni: il mondo si regge da solo', () => {
  const world = createWorld({ seed: 20260921 });
  // Le prime stagioni sono un transitorio; l'inflazione da misurare è quella
  // che resta dopo, perché è quella che svaluterebbe i record più vecchi.
  const firstTen = runSeasons(world, 10);
  const summaries = [...firstTen, ...runSeasons(world, 30)];

  it('ogni stagione assegna un titolo', () => {
    expect(summaries).toHaveLength(40);
    expect(world.champions).toHaveLength(40);
    expect(summaries.every((s) => s.championId !== '')).toBe(true);
  });

  it('la griglia resta piena: la rigenerazione funziona', () => {
    expect(activeDrivers(world)).toHaveLength(SEATS);
    for (const t of Object.values(world.teams)) expect(t.driverIds).toHaveLength(2);
  });

  it('nessun attributo sfonda il proprio tetto', () => {
    for (const d of Object.values(world.drivers)) {
      for (const k of Object.keys(d.attrs) as (keyof typeof d.attrs)[]) {
        expect(d.attrs[k]).toBeLessThanOrEqual(d.caps[k] + 1e-6);
      }
    }
  });

  it('la griglia resta giovane: i vecchi si ritirano', () => {
    const ages = activeDrivers(world).map((d) => d.age);
    const mean = ages.reduce((s, a) => s + a, 0) / ages.length;
    expect(mean).toBeGreaterThan(20);
    expect(mean).toBeLessThan(38);
    expect(Math.max(...ages)).toBeLessThanOrEqual(41);
  });

  it('il titolo cambia mano: la gerarchia non si congela', () => {
    const champions = new Set(world.champions.map((c) => c.driverId));
    const teams = new Set(world.champions.map((c) => c.teamId));
    expect(champions.size).toBeGreaterThan(4);
    expect(teams.size).toBeGreaterThan(1);
  });

  it('i regolamenti si azzerano periodicamente', () => {
    expect(summaries.filter((s) => s.regulationReset).length).toBeGreaterThanOrEqual(5);
  });

  it('lo storico resta compatto: solo aggregati', () => {
    const veteran = Object.values(world.drivers)
      .filter((d) => d.history.length > 0)
      .sort((a, b) => b.history.length - a.history.length)[0]!;
    expect(veteran.history.length).toBeLessThanOrEqual(25);
    const bytes = JSON.stringify(world).length;
    expect(bytes).toBeLessThan(4_000_000);
  });
});

describe('una stagione settimana per settimana', () => {
  it('corre tutte le gare in calendario e le classifiche tornano', () => {
    const w = createWorld({ seed: 5, races: 20 });
    let races = 0;
    while (w.week < SEASON_WEEKS) if (advanceWeek(w).raceRun) races++;
    expect(races).toBe(20);
    expect(w.results).toHaveLength(20);
    const table = driverStandings(w);
    const totalPoints = table.reduce((s, r) => s + r.points, 0);
    const racePoints = w.results.reduce(
      (s, wk) => s + wk.race.reduce((x, r) => x + r.points, 0), 0);
    expect(totalPoints).toBe(racePoints);
    expect(table[0]!.points).toBeGreaterThan(0);
  });

  it('i giovani crescono nel corso di una stagione', () => {
    const w = createWorld({ seed: 8 });
    const young = Object.values(w.drivers)
      .filter((d) => d.teamId && d.age <= 24 && potentialOverall(d) - overall(d.attrs) > 6)
      .sort((a, b) => a.age - b.age)[0];
    if (!young) return;
    const before = overall(young.attrs);
    while (w.week < SEASON_WEEKS) advanceWeek(w);
    expect(overall(young.attrs)).toBeGreaterThan(before);
  });
});

/**
 * Le proprietà che contano — che il mondo non si congeli e non si gonfi — sono
 * statistiche: un singolo seed può sempre produrre un'era di dominio, che è una
 * storia, non un difetto. Si misurano su più mondi.
 */
describe('proprietà del mondo su più semi', () => {
  const SEEDS = [1, 7, 42, 999, 20260921, 12345];

  const runs = SEEDS.map((seed) => {
    const w = createWorld({ seed });
    runSeasons(w, 10);
    const settled = meanPotential(w);
    runSeasons(w, 30);
    const byTeam = new Map<string, number>();
    for (const c of w.champions) byTeam.set(c.teamId, (byTeam.get(c.teamId) ?? 0) + 1);
    return {
      seed,
      drift: Math.abs(meanPotential(w) - settled),
      share: Math.max(...byTeam.values()) / w.champions.length,
      championTeams: byTeam.size,
      championDrivers: new Set(w.champions.map((c) => c.driverId)).size,
    };
  });

  it('nessun mondo si congela su una sola scuderia', () => {
    // Regressione: la prima simulazione a 40 stagioni dava 29 titoli su 40 a
    // una sola scuderia. Handicap di sviluppo inverso alla classifica, budget
    // cap comune, prestigio legato ai risultati e mobilità del mercato
    // esistono per impedirlo.
    const meanShare = runs.reduce((s, r) => s + r.share, 0) / runs.length;
    expect(meanShare).toBeLessThan(0.5);
    for (const r of runs) {
      expect(r.share, `seed ${r.seed}`).toBeLessThan(0.7);
      expect(r.championTeams, `seed ${r.seed}`).toBeGreaterThanOrEqual(3);
      expect(r.championDrivers, `seed ${r.seed}`).toBeGreaterThan(6);
    }
  });

  it('gli attributi non si gonfiano nel tempo (anti-inflazione)', () => {
    const sorted = runs.map((r) => r.drift).sort((a, b) => a - b);
    const median = sorted[Math.floor(sorted.length / 2)]!;
    expect(median).toBeLessThan(3);
    for (const r of runs) expect(r.drift, `seed ${r.seed}`).toBeLessThan(8);
  });
});
