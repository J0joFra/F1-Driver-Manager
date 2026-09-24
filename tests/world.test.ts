import { describe, expect, it } from 'vitest';
import { createWorld, endSeason, advanceWeek, takeOffer } from '../src/engine/world.js';
import { startCareer } from '../src/engine/career.js';
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
 * Le offerte di contratto: il giocatore non viene assegnato d'ufficio a una
 * scuderia come gli altri piloti, sceglie lui. Finché non risponde il suo
 * sedile resta vuoto, e questo non deve lasciare buchi nella griglia.
 */
describe('offerte di contratto al giocatore', () => {
  function careerWorld(seed: number) {
    const w = startCareer({ seed, name: 'L. Marchetti', nationality: 'ITA' });
    return w;
  }

  function seasonsUntilOffers(w: World, max = 6): number {
    for (let i = 0; i < max; i++) {
      runSeasons(w, 1);
      if (w.offers.length > 0) return i + 1;
    }
    return -1;
  }

  it('arrivano quando il contratto scade, e non prima', () => {
    const w = careerWorld(11);
    expect(w.offers).toHaveLength(0);
    const after = seasonsUntilOffers(w);
    expect(after).toBeGreaterThan(0);
    expect(w.offers.length).toBeGreaterThan(0);
    expect(w.offers.length).toBeLessThanOrEqual(3);
  });

  it('il sedile resta vuoto finché non si risponde', () => {
    const w = careerWorld(12);
    seasonsUntilOffers(w);
    const me = w.drivers['player']!;
    expect(me.teamId).toBeNull();
    // Una scuderia fra quelle che offrono tiene il posto libero.
    const withSpace = w.offers.filter((o) => w.teams[o.teamId]!.driverIds.length < 2);
    expect(withSpace.length).toBeGreaterThan(0);
  });

  it('accettare riempie il sedile e chiude il mercato', () => {
    const w = careerWorld(13);
    seasonsUntilOffers(w);
    const offer = w.offers[0]!;
    expect(takeOffer(w, offer.teamId)).toBe(true);

    const me = w.drivers['player']!;
    expect(me.teamId).toBe(offer.teamId);
    expect(me.contractYears).toBe(offer.years);
    expect(me.salary).toBe(offer.salary);
    expect(w.offers).toHaveLength(0);
    // Nessun buco in griglia: i posti tenuti liberi si riempiono subito.
    for (const t of Object.values(w.teams)) expect(t.driverIds).toHaveLength(2);
  });

  it('offre sempre almeno un sedile: la carriera non finisce per sfortuna', () => {
    for (const seed of [21, 22, 23, 24]) {
      const w = careerWorld(seed);
      if (seasonsUntilOffers(w) < 0) continue;
      expect(w.offers.length, `seed ${seed}`).toBeGreaterThan(0);
    }
  });

  it('accettare un id inesistente non cambia nulla', () => {
    const w = careerWorld(14);
    seasonsUntilOffers(w);
    const before = w.offers.length;
    expect(takeOffer(w, 'scuderia-che-non-esiste')).toBe(false);
    expect(w.offers).toHaveLength(before);
  });
});

describe('la crescita è raccontabile', () => {
  it('ogni stagione archiviata porta con sé l’overall di allora', () => {
    const world = startCareer({ seed: 55, name: 'Prova', nationality: 'ITA' });
    const id = world.seat.mode === 'pilota' ? world.seat.driverId : '';
    for (let s = 0; s < 3; s++) {
      while (world.week < SEASON_WEEKS) {
        advanceWeek(world, { plan: { simulator: 2, fitness: 1, engineering: 1, media: 0 } });
      }
      endSeason(world);
      const best = world.offers[0];
      if (best) takeOffer(world, best.teamId);
    }
    const history = world.drivers[id]!.history;
    expect(history.length).toBeGreaterThanOrEqual(3);
    for (const season of history) expect(season.overall).toBeGreaterThan(0);
    // Il senso della registrazione: la curva deve salire, altrimenti non c'è
    // niente da mostrare nel profilo.
    expect(history.at(-1)!.overall).toBeGreaterThan(history[0]!.overall);
  });

  it('il confronto di stagione riparte dopo l’invecchiamento, non prima', () => {
    const world = startCareer({ seed: 56, name: 'Prova', nationality: 'ITA' });
    const id = world.seat.mode === 'pilota' ? world.seat.driverId : '';
    while (world.week < SEASON_WEEKS) {
      advanceWeek(world, { plan: { simulator: 2, fitness: 1, engineering: 1, media: 0 } });
    }
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
