import { describe, expect, it } from 'vitest';
import { createWorld, endSeason, advanceWeek } from '../src/engine/world.js';
import {
  askingSalary, playerTeam, signDriver, signingRefusal, startTeam, START_CASH,
} from '../src/engine/team.js';
import { advanceProjects, cancelProject, PROJECT_SIZES, startProject } from '../src/engine/projects.js';
import { marketValue } from '../src/engine/market.js';
import { carPace } from '../src/engine/regulations.js';
import { createRng } from '../src/engine/rng.js';
import { SEASON_WEEKS, driverStandings } from '../src/engine/season.js';
import { overall, potentialOverall } from '../src/engine/driver.js';
import type { World } from '../src/engine/types.js';
import { TEAM_SEEDS } from '../src/engine/data/teams.js';
import { getTrack } from '../src/engine/data/tracks.js';
import { weekendDays } from '../src/engine/calendar.js';

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

  it('non esistono due piloti in griglia con lo stesso nome', () => {
    const w = createWorld({ seed: 3 });
    runSeasons(w, 12);
    const names = activeDrivers(w).map((d) => d.name);
    expect(new Set(names).size).toBe(names.length);
  });

  // Le triple header esistono davvero e sono ormai normali; quattro gare di
  // fila no, perché non lascerebbero modo di recuperare.
  it('il calendario non mette mai quattro gare di fila', () => {
    for (const seed of [5, 77, 404, 2024]) {
      const w = createWorld({ seed });
      let streak = 0;
      for (const week of w.schedule) {
        streak = week.kind === 'race' ? streak + 1 : 0;
        expect(streak, `seed ${seed}`).toBeLessThanOrEqual(3);
      }
    }
  });

  it('la stagione apre a marzo, chiude a dicembre e si ferma ad agosto', () => {
    for (const seed of [1, 42, 999]) {
      for (const year of [2031, 2032, 2033, 2036]) {
        const w = createWorld({ seed, year });
        const races = w.schedule.filter((x) => x.kind === 'race');
        const sunday = (week: (typeof races)[number]) => weekendDays(year, week).race;

        const opener = sunday(races[0]!);
        expect(opener.getUTCMonth(), `apertura seed ${seed} ${year}`).toBe(2); // marzo
        expect(opener.getUTCDate()).toBeGreaterThanOrEqual(8);
        expect(opener.getUTCDate()).toBeLessThanOrEqual(14);

        const finale = sunday(races[races.length - 1]!);
        expect(finale.getUTCMonth(), `finale seed ${seed} ${year}`).toBe(11); // dicembre
        expect(finale.getUTCDate()).toBeLessThanOrEqual(7);

        // Ad agosto le fabbriche chiudono: tre settimane senza gare.
        const breakWeeks = w.schedule.filter((x) => x.kind === 'summerBreak');
        expect(breakWeeks).toHaveLength(3);
        for (const week of breakWeeks) {
          expect(sunday(week).getUTCMonth(), `pausa seed ${seed} ${year}`).toBe(7); // agosto
        }
      }
    }
  });

  it('il giro del mondo non torna indietro fra continenti lontani', () => {
    for (const seed of [2, 31, 500, 7777]) {
      const w = createWorld({ seed });
      const regions = w.schedule
        .filter((x) => x.trackId)
        .map((x) => getTrack(x.trackId!).region);

      // Ogni regione compare in un solo blocco contiguo per metà stagione:
      // se l'Europa ricomparisse a novembre sarebbe un calendario assurdo.
      const runs: string[] = [];
      for (const r of regions) if (runs[runs.length - 1] !== r) runs.push(r);
      for (const region of new Set(regions)) {
        const appearances = runs.filter((r) => r === region).length;
        expect(appearances, `${region}, seed ${seed}`).toBeLessThanOrEqual(2);
      }

      // Si apre lontano e si chiude in Medio Oriente, come il campionato vero.
      expect(regions[0], `apertura seed ${seed}`).toBe('oceania');
      expect(regions[regions.length - 1], `finale seed ${seed}`).toBe('middleEast');
    }
  });

  it('nessun circuito corre due volte nella stessa stagione', () => {
    for (const seed of [3, 88, 1234]) {
      const ids = createWorld({ seed }).schedule.filter((x) => x.trackId).map((x) => x.trackId);
      expect(new Set(ids).size, `seed ${seed}`).toBe(ids.length);
    }
  });

  it('il calendario ha test, gare, pausa estiva e fine stagione', () => {
    const w = createWorld({ seed: 3 });
    const kinds = new Set(w.schedule.map((x) => x.kind));
    expect(kinds.has('testing')).toBe(true);
    expect(kinds.has('race')).toBe(true);
    expect(kinds.has('summerBreak')).toBe(true);
    expect(kinds.has('postseason')).toBe(true);
    // Nella pausa non si corre mai.
    expect(w.schedule.filter((x) => x.kind === 'summerBreak' && x.trackId)).toHaveLength(0);
  });

  it('i round sono numerati in ordine e senza buchi', () => {
    const w = createWorld({ seed: 8 });
    const rounds = w.schedule.filter((x) => x.round !== null).map((x) => x.round);
    expect(rounds).toEqual(rounds.map((_, i) => i + 1));
  });

  it('le date salgono di sette giorni a settimana', () => {
    const w = createWorld({ seed: 4 });
    for (let i = 1; i < w.schedule.length; i++) {
      expect(w.schedule[i]!.startDay - w.schedule[i - 1]!.startDay).toBe(7);
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
  // Dodici mondi, non sei: con pochi campioni la mediana oscilla abbastanza da
  // far fallire il test a ogni modifica che sposta la sequenza casuale, senza
  // che il modello sia cambiato.
  const SEEDS = [1, 7, 42, 999, 20260921, 12345, 31337, 8888, 5, 77, 404, 2024];

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
    // La media è la garanzia; il limite per singolo mondo è largo di
    // proposito. Su dodici mondi la quota sta fra il 23% e il 57% tranne uno
    // al 78%: è una dinastia, come Ferrari a inizio anni duemila, e togliere
    // la varianza per farla sparire toglierebbe anche le storie.
    const meanShare = runs.reduce((s, r) => s + r.share, 0) / runs.length;
    expect(meanShare).toBeLessThan(0.5);
    for (const r of runs) {
      expect(r.share, `seed ${r.seed}`).toBeLessThan(0.82);
      expect(r.championTeams, `seed ${r.seed}`).toBeGreaterThanOrEqual(3);
      expect(r.championDrivers, `seed ${r.seed}`).toBeGreaterThan(6);
    }
  });

  it('gli attributi non si gonfiano nel tempo (anti-inflazione)', () => {
    const sorted = runs.map((r) => r.drift).sort((a, b) => a - b);
    const median = sorted[Math.floor(sorted.length / 2)]!;
    expect(median).toBeLessThan(3.5);
    for (const r of runs) expect(r.drift, `seed ${r.seed}`).toBeLessThan(7);
  });
});

/**
 * La scuderia del giocatore. I sedili non si riempiono da soli: è lui a
 * ingaggiare, e questo non deve lasciare buchi nel resto della griglia.
 */
describe('la scuderia del giocatore', () => {
  function founded(seed: number) {
    return startTeam({ seed, name: 'Prova', short: 'PRV', colour: '#C8102E', budget: 'indipendente' });
  }

  it('entra in griglia come nona, ultima e senza piloti', () => {
    const w = founded(31);
    const team = playerTeam(w)!;
    expect(Object.keys(w.teams)).toHaveLength(9);
    expect(team.driverIds).toHaveLength(0);
    expect(team.cash).toBe(START_CASH.indipendente);
    // Più lenta di tutte: è il punto di partenza di tutto il resto.
    const others = Object.values(w.teams).filter((t) => t.id !== team.id);
    for (const t of others) expect(carPace(t.car)).toBeGreaterThan(carPace(team.car));
  });

  it('i suoi sedili restano vuoti, quelli delle altre no', () => {
    const w = founded(32);
    runSeasons(w, 2);
    const team = playerTeam(w)!;
    expect(team.driverIds).toHaveLength(0);
    for (const t of Object.values(w.teams)) {
      if (t.id === team.id) continue;
      expect(t.driverIds, t.name).toHaveLength(2);
    }
  });

  it('un pilota firma se lo paghi quanto chiede, e non prima', () => {
    const w = founded(33);
    const team = playerTeam(w)!;
    const free = Object.values(w.drivers)
      .filter((d) => !d.retired && !d.teamId)
      .sort((a, b) => marketValue(b) - marketValue(a));
    const target = free.find((d) => signingRefusal(w, d, team, {
      years: 2, salary: askingSalary(w, d, team), role: 'prima',
    }) === null)!;
    expect(target).toBeDefined();

    const ask = askingSalary(w, target, team);
    // Un euro sotto la richiesta è un no, non una trattativa.
    expect(signDriver(w, target.id, { years: 2, salary: ask - 1, role: 'seconda' })).not.toBeNull();
    expect(target.teamId).toBeNull();

    expect(signDriver(w, target.id, { years: 2, salary: ask, role: 'seconda' })).toBeNull();
    expect(target.teamId).toBe(team.id);
    expect(team.driverIds).toContain(target.id);
  });

  it('i più forti non firmano per una squadra nuova, a nessuna cifra', () => {
    const w = founded(34);
    const team = playerTeam(w)!;
    // Il migliore della griglia, messo sul mercato per l'occasione: è il caso
    // che la regola deve coprire, e a mondo appena creato non capita da solo.
    const best = Object.values(w.drivers)
      .filter((d) => !d.retired)
      .sort((a, b) => marketValue(b) - marketValue(a))[0]!;
    const old = w.teams[best.teamId!]!;
    old.driverIds = old.driverIds.filter((id) => id !== best.id);
    best.teamId = null;
    const refusal = signingRefusal(w, best, team, {
      years: 2, salary: 30_000_000, role: 'prima',
    });
    expect(refusal).toBe('Non guiderebbe per voi a nessuna cifra');
  });
});

/**
 * Lo sviluppo a progetti: è il cuore del gestionale, e le tre cose che lo
 * rendono una decisione sono il reparto occupato, le settimane e la cassa.
 */
describe('i progetti di reparto', () => {
  function founded(seed: number) {
    return startTeam({ seed, name: 'Prova', short: 'PRV', colour: '#C8102E', budget: 'costruttore' });
  }

  it('un reparto lavora a un progetto solo', () => {
    const w = founded(41);
    const team = playerTeam(w)!;
    expect(startProject(team, 'aero', 'medio', w.year, 0)).toBe(true);
    expect(startProject(team, 'aero', 'piccolo', w.year, 0)).toBe(false);
    expect(startProject(team, 'engine', 'piccolo', w.year, 0)).toBe(true);
    expect(team.projects).toHaveLength(2);
  });

  it('si paga a settimana, e alla consegna la macchina cambia', () => {
    const w = founded(42);
    const team = playerTeam(w)!;
    const before = team.car.aero;
    const cash = team.cash;
    startProject(team, 'aero', 'piccolo', w.year, 0);

    const spec = PROJECT_SIZES.piccolo;
    for (let i = 0; i < spec.weeks; i++) {
      advanceProjects(w, [], createRng(i));
    }
    expect(team.projects).toHaveLength(0);
    expect(team.car.aero).not.toBe(before);
    expect(team.cash).toBeCloseTo(cash - spec.cost, 0);
  });

  it('senza fondi il lavoro si ferma, non si perde', () => {
    const w = founded(43);
    const team = playerTeam(w)!;
    startProject(team, 'chassis', 'grande', w.year, 0);
    const left = team.projects[0]!.weeksLeft;
    team.cash = 0;

    advanceProjects(w, [], createRng(1));
    // Il progetto c'è ancora ed è fermo dov'era: la cassa è un freno, non
    // una penale.
    expect(team.projects).toHaveLength(1);
    expect(team.projects[0]!.weeksLeft).toBe(left);
    expect(team.cash).toBe(0);
  });

  it('annullare non restituisce quello che è già stato speso', () => {
    const w = founded(44);
    const team = playerTeam(w)!;
    startProject(team, 'engine', 'medio', w.year, 0);
    advanceProjects(w, [], createRng(2));
    const cash = team.cash;
    expect(cancelProject(team, team.projects[0]!.id)).toBe(true);
    expect(team.projects).toHaveLength(0);
    expect(team.cash).toBe(cash);
  });
});

describe('la crescita è raccontabile', () => {
  it('ogni stagione archiviata porta con sé l’overall di allora', () => {
    const world = createWorld({ seed: 55 });
    runSeasons(world, 3);

    const archived = Object.values(world.drivers).flatMap((d) => d.history);
    expect(archived.length).toBeGreaterThan(20);
    for (const season of archived) expect(season.overall).toBeGreaterThan(0);

    // Il senso della registrazione: per i giovani la curva deve salire,
    // altrimenti nel profilo non c'è niente da mostrare.
    const grown = Object.values(world.drivers).filter(
      (d) => d.history.length >= 3 && d.history.at(-1)!.overall > d.history[0]!.overall,
    );
    expect(grown.length).toBeGreaterThan(3);
  });

  it('il confronto di stagione riparte dopo l’invecchiamento, non prima', () => {
    const world = createWorld({ seed: 56 });
    // Il più giovane in griglia: è quello che cresce abbastanza da rendere
    // visibile la differenza fra prima e dopo.
    const id = Object.values(world.drivers)
      .filter((d) => d.teamId)
      .sort((a, b) => a.age - b.age)[0]!.id;
    while (world.week < SEASON_WEEKS) advanceWeek(world);
    const me = world.drivers[id]!;
    // Durante la stagione il riferimento resta quello di marzo: è quello che
    // rende visibile il guadagno dell'anno.
    expect(overall(me.attrs)).toBeGreaterThan(overall(me.seasonStartAttrs));
    endSeason(world);
    // A stagione chiusa il riferimento si sposta su dove il pilota è adesso,
    // invecchiamento incluso: il nuovo anno parte da zero, non da un
    // guadagno che è solo il recupero del calo.
    expect(overall(me.seasonStartAttrs)).toBeCloseTo(overall(me.attrs), 5);
  });
});
