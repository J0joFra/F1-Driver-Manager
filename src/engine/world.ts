import type { MinigameKind, Seat, TrainingPlan, World } from './types.js';
import { createRng, hashSeed } from './rng.js';
import { TEAM_SEEDS } from './data/teams.js';
import { buildCalendar, raceCountOf, WEEK_RECOVERY, type SeasonWeek, type WeekKind } from './calendar.js';
import { commitDay, DAYS_IN_WEEK, RACE_DAY, type DayActivity, weekActivities } from './days.js';
import { applyAging, createVeteran, overall, retirementChance } from './driver.js';
import { intakeNewgens, POTENTIAL_ANCHOR, runTransferMarket, settleFinances } from './market.js';
import { initialCash, maybeReset, updatePrestige, updateTeamResources } from './regulations.js';
import { advanceProjects, aiProjectPlan } from './projects.js';
import { constructorStandings, driverStandings, rngFor, runWeekend, SEASON_WEEKS, seasonTotalsFor } from './season.js';
import {
  aiTrainingPlan, applyTraining, clampPlan, MINIGAME_AUTO, minigameMultiplier,
  pickMinigame, trainingLimits,
} from './training.js';
import { entourageEfficiency } from './staff.js';
import { isPlayerTeam, settleTeamSeason, teamCoaching } from './team.js';
import { POINTS_FOR_TITLE, spendPointsAsAi } from './skills.js';

/**
 * Il mondo si simula da solo.
 *
 * Il giocatore non "gioca il gioco": occupa uno slot e sovrascrive le decisioni
 * di un'IA che saprebbe comunque prenderle. È per questo che la Modalità
 * Scuderia non richiede un secondo motore — solo una seconda interfaccia.
 */

export interface CreateWorldOptions {
  seed: number;
  year?: number;
  seat?: Seat;
  /** gare in calendario (max 24: i circuiti si ripetono se sono di più) */
  races?: number;
}

export function createWorld(opts: CreateWorldOptions): World {
  const rng = createRng(hashSeed('world', opts.seed));
  const year = opts.year ?? 2031;

  const world: World = {
    seed: opts.seed,
    year,
    week: 0,
    dayOfWeek: 0,
    qualifyingPlan: null,
    round: 0,
    drivers: {},
    teams: {},
    schedule: buildCalendar(year, opts.races ?? 24, rng),
    regulations: { lastResetYear: year, nextResetYear: year + rng.int(4, 6) },
    seat: opts.seat ?? { mode: 'osservatore' },
    academy: [],
    talentAnchor: POTENTIAL_ANCHOR,
    standings: {},
    constructorStandings: {},
    results: [],
    champions: [],
    lastMinigame: null,
  };

  for (const seed of TEAM_SEEDS) {
    world.teams[seed.id] = {
      id: seed.id,
      name: seed.name,
      short: seed.short,
      colour: seed.colour,
      car: { ...seed.car },
      budget: seed.budget,
      prestige: seed.prestige,
      cash: initialCash(seed.prestige),
      crew: { ...seed.crew },
      driverIds: [],
      projects: [],
    };
    world.constructorStandings[seed.id] = 0;
  }

  // Griglia iniziale: due piloti già formati per scuderia, di età varia.
  const takenNames = new Set<string>();
  for (const team of Object.values(world.teams)) {
    for (let i = 0; i < 2; i++) {
      const anchor = POTENTIAL_ANCHOR + (team.prestige - 55) * 0.3;
      const d = createVeteran(rng, anchor, rng.int(22, 34), `d${year}i${team.id}${i}`, takenNames);
      takenNames.add(d.name);
      d.teamId = team.id;
      d.contractYears = rng.int(1, 3);
      d.salary = Math.round(team.budget * 0.06 * (overall(d.attrs) / 80));
      world.drivers[d.id] = d;
      world.standings[d.id] = 0;
      team.driverIds.push(d.id);
    }
  }

  intakeNewgens(world, rng, 6);

  /*
   * Qualche pilota già fatto, senza contratto.
   *
   * Senza questi, all'apertura del mondo tutti i sedili sono occupati e gli
   * unici liberi sono i ragazzi dell'academy: una scuderia che nasce non
   * avrebbe nessuna scelta da fare, solo giovani da prendere. Con loro la
   * prima decisione vera esiste — un ventenne da far crescere, o un
   * trentenne che porta punti subito e costa tutto il bilancio.
   */
  for (let i = 0; i < 5; i++) {
    const d = createVeteran(
      rng, POTENTIAL_ANCHOR + rng.normal() * 7, rng.int(26, 35),
      `d${year}f${i}`, takenNames,
    );
    takenNames.add(d.name);
    world.drivers[d.id] = d;
    world.academy.push(d.id);
  }

  return world;
}

export interface WeekOptions {
  /**
   * I programmi settimanali dei piloti della tua scuderia, per id.
   *
   * Uno per pilota, non uno solo: gestire due monoposto vuol dire anche
   * decidere che uno lavori al simulatore mentre l'altro sta in palestra, e
   * un piano unico per tutti toglierebbe metà della decisione.
   */
  plans?: Record<string, TrainingPlan>;
  /** punteggio 0–1 nel minigioco; se assente vale l'allenamento automatico */
  minigameScore?: number;
  /**
   * Non correre la gara: gli allenamenti vengono applicati e la settimana si
   * ferma prima del weekend, che l'interfaccia farà giocare dal vivo.
   * La settimana non avanza finché la gara non è registrata.
   */
  deferRace?: boolean;
}

export interface WeekReport {
  week: number;
  raceRun: string | null;
  /** gara da giocare: la settimana resta ferma finché non è registrata */
  pendingRace: string | null;
  minigame: MinigameKind | null;
  seasonOver: boolean;
}

/** Gli id dei piloti sotto contratto con la scuderia del giocatore. */
function myDriverIds(world: World): Set<string> {
  return new Set(world.seat.mode === 'scuderia'
    ? world.teams[world.seat.teamId]?.driverIds ?? []
    : []);
}

export interface DayReport {
  week: number;
  /** giorno della settimana appena concluso, 0 = lunedì */
  day: number;
  /** cosa è successo, per il resoconto dell'interfaccia */
  activities: DayActivity[];
  /** il lavoro della settimana è stato messo a bilancio oggi */
  trainingApplied: boolean;
  minigame: MinigameKind | null;
  raceRun: string | null;
  pendingRace: string | null;
  /** oggi era l'ultimo giorno della settimana */
  weekOver: boolean;
  seasonOver: boolean;
}

/**
 * Il lavoro della settimana: recupero e allenamenti, per tutti i piloti.
 *
 * Resta un conto settimanale anche se il tempo scorre a giorni. Spezzarlo in
 * sette pezzi cambierebbe i risultati — le curve di crescita sono tarate su
 * una settimana intera — e non aggiungerebbe niente: il giocatore decide il
 * piano una volta a settimana, non una volta al giorno.
 */
function commitWeekWork(world: World, week: SeasonWeek | undefined, opts: WeekOptions): MinigameKind | null {
  const kind: WeekKind = week?.kind ?? 'free';
  const capacity = week?.training ?? 0;
  const rng = rngFor(world, 'week');
  const mine = myDriverIds(world);
  let minigame: MinigameKind | null = null;

  for (const d of Object.values(world.drivers)) {
    if (d.retired) continue;
    // La pausa estiva è riposo forzato: le fabbriche chiudono davvero.
    if (WEEK_RECOVERY[kind] > 0) {
      d.fatigue = Math.max(0, d.fatigue - WEEK_RECOVERY[kind]);
    }
    const limits = trainingLimits(d, capacity);
    const team = d.teamId ? world.teams[d.teamId] : null;
    const plan = mine.has(d.id) ? opts.plans?.[d.id] : undefined;

    if (plan) {
      // Il piano sopravvive da una settimana all'altra, le capienze no: si
      // riporta dentro i limiti invece di rifiutarlo.
      const clamped = clampPlan(plan, limits);
      // Il minigioco è uno a settimana: se ne occupa il primo pilota che ne
      // ha diritto, perché è una cosa che il giocatore gioca a mano e due
      // alla settimana sarebbero un lavoro, non una scelta.
      const game: MinigameKind | null = minigame ?? pickMinigame(clamped, world.lastMinigame);
      const mult = opts.minigameScore === undefined
        ? MINIGAME_AUTO
        : minigameMultiplier(opts.minigameScore);
      applyTraining(
        d, clamped, minigame === null && game ? mult : MINIGAME_AUTO, capacity,
        team ? teamCoaching(team) : undefined,
      );
      if (minigame === null) minigame = game;
    } else {
      applyTraining(
        d, aiTrainingPlan(d, limits, rng.next()), MINIGAME_AUTO, capacity,
        team ? teamCoaching(team) : entourageEfficiency(30),
      );
    }
  }

  if (minigame) world.lastMinigame = minigame;
  return minigame;
}

/**
 * Una settimana di lavoro dei reparti, per tutta la griglia.
 *
 * Le scuderie gestite dal computer aprono i loro progetti da sole: senza,
 * la griglia resterebbe con la macchina del primo anno mentre il giocatore
 * sviluppa, e in tre stagioni vincerebbe tutto senza aver deciso niente.
 */
function commitWeekFactory(world: World): void {
  const order = constructorStandings(world).map((c) => c.teamId);
  const rng = rngFor(world, 'reparti');

  for (const team of Object.values(world.teams)) {
    if (isPlayerTeam(world, team.id)) continue;
    aiProjectPlan(world, team, rng);
  }

  advanceProjects(world, order, rng);
}

/** Sposta il cursore di un giorno, cambiando settimana quando serve. */
function advanceCursor(world: World): void {
  world.dayOfWeek += 1;
  if (world.dayOfWeek >= DAYS_IN_WEEK) {
    world.dayOfWeek = 0;
    world.week += 1;
  }
}

/**
 * Avanza di un giorno.
 *
 * È l'unità di tempo del gioco: il giocatore scorre il calendario un giorno
 * alla volta, come in Soccer Manager. Quasi tutti i giorni sposta solo il
 * cursore — il lavoro della settimana si mette a bilancio in un giorno solo
 * (`COMMIT_DAY`, l'ultimo di allenamento) e la gara si corre la domenica.
 */
export function advanceDay(world: World, opts: WeekOptions = {}): DayReport {
  const week = world.schedule[world.week];
  const trackId = week?.trackId ?? null;
  const day = world.dayOfWeek;
  // Il riassunto della giornata mostra il programma del primo pilota: è
  // quello che il calendario ha lo spazio per dire.
  const firstPlan = Object.values(opts.plans ?? {})[0] ?? null;
  const activities = week ? weekActivities(week, firstPlan)[day] ?? [] : [];

  const trainingApplied = day === commitDay(week?.training ?? 0);
  let minigame: MinigameKind | null = null;
  if (trainingApplied) {
    minigame = commitWeekWork(world, week, opts);
    commitWeekFactory(world);
  }

  const raceToday = trackId !== null && day === RACE_DAY;
  if (raceToday && opts.deferRace) {
    // Il giorno non avanza: lo farà `finishPendingRace`, quando l'esito
    // della gara sarà noto. Gli allenamenti sono già a bilancio da giovedì.
    return {
      week: world.week, day, activities, trainingApplied, minigame,
      raceRun: null, pendingRace: trackId, weekOver: false, seasonOver: false,
    };
  }

  if (raceToday) runWeekend(world, trackId);

  const weekBefore = world.week;
  advanceCursor(world);

  return {
    week: weekBefore,
    day,
    activities,
    trainingApplied,
    minigame,
    raceRun: raceToday ? trackId : null,
    pendingRace: null,
    weekOver: world.week !== weekBefore,
    seasonOver: world.week >= SEASON_WEEKS,
  };
}

/**
 * Avanza fino alla fine della settimana.
 *
 * Non è più l'unità di tempo del gioco ma resta l'unità di simulazione: il
 * simulatore da riga di comando e i test corrono stagioni intere e non hanno
 * motivo di passare per i giorni. È costruita sopra `advanceDay`, così i due
 * percorsi non possono divergere.
 */
export function advanceWeek(world: World, opts: WeekOptions = {}): WeekReport {
  let minigame: MinigameKind | null = null;
  let raceRun: string | null = null;

  for (;;) {
    const report = advanceDay(world, opts);
    if (report.minigame) minigame = report.minigame;
    if (report.raceRun) raceRun = report.raceRun;
    if (report.pendingRace) {
      return {
        week: report.week, raceRun: null, pendingRace: report.pendingRace,
        minigame, seasonOver: false,
      };
    }
    if (report.weekOver) {
      return {
        week: report.week, raceRun, pendingRace: null, minigame,
        seasonOver: report.seasonOver,
      };
    }
  }
}

/** Chiude un weekend lasciato in sospeso da `deferRace`. */
export function finishPendingRace(world: World, commit: () => void): WeekReport {
  const trackId = world.schedule[world.week]?.trackId ?? null;
  commit();
  const weekBefore = world.week;
  advanceCursor(world);
  return {
    week: weekBefore,
    raceRun: trackId,
    pendingRace: null,
    minigame: null,
    seasonOver: world.week >= SEASON_WEEKS,
  };
}

export interface SeasonSummary {
  year: number;
  championId: string;
  championTeamId: string;
  retired: string[];
  newgens: number;
  regulationReset: boolean;
}

/**
 * Chiude la stagione: albo d'oro, archivio storico, invecchiamento, ritiri,
 * nuova leva, mercato, sviluppo e — quando tocca — azzeramento regolamentare.
 */
export function endSeason(world: World): SeasonSummary {
  const rng = rngFor(world, 'endSeason');
  const standings = driverStandings(world);
  const champion = standings[0];
  const championDriver = champion ? world.drivers[champion.driverId] : undefined;
  const championTeamId = championDriver?.teamId ?? '';

  if (championDriver) {
    championDriver.career.titles += 1;
    // Un titolo insegna quanto mezzo ramo dell'albero.
    championDriver.skillPoints += POINTS_FOR_TITLE;
    if (!myDriverIds(world).has(championDriver.id)) spendPointsAsAi(championDriver);
    world.champions.push({ year: world.year, driverId: championDriver.id, teamId: championTeamId });
  }

  const posById = new Map(standings.map((s) => [s.driverId, s.position]));
  for (const d of Object.values(world.drivers)) {
    if (d.retired) continue;
    const totals = seasonTotalsFor(world, d, posById.get(d.id) ?? 0);
    if (totals.starts > 0) {
      d.history.push(totals);
      settleFinances(d, totals.points, totals.podiums, totals.wins);
    }
  }

  const retired: string[] = [];
  for (const d of Object.values(world.drivers)) {
    if (d.retired) continue;
    applyAging(d, rng);
    if (rng.chance(retirementChance(d))) {
      d.retired = true;
      if (d.teamId) {
        const team = world.teams[d.teamId];
        if (team) team.driverIds = team.driverIds.filter((id) => id !== d.id);
      }
      d.teamId = null;
      retired.push(d.id);
    }
  }

  const standingOrder = constructorStandings(world).map((c) => c.teamId);
  updatePrestige(world, standingOrder);
  updateTeamResources(world, standingOrder);

  const newgens = Math.max(3, retired.length + rng.int(0, 2));
  intakeNewgens(world, rng, newgens);
  runTransferMarket(world, rng);
  for (const team of Object.values(world.teams)) settleTeamSeason(world, team, standingOrder);

  world.year += 1;
  const regulationReset = maybeReset(world, rng);

  world.week = 0;
  world.round = 0;
  world.results = [];
  world.standings = {};
  world.constructorStandings = {};
  world.lastMinigame = null;
  for (const t of Object.values(world.teams)) world.constructorStandings[t.id] = 0;
  for (const d of Object.values(world.drivers)) if (!d.retired) world.standings[d.id] = 0;
  world.schedule = buildCalendar(world.year, raceCountOf(world.schedule), rng);

  return {
    year: world.year - 1,
    championId: championDriver?.id ?? '',
    championTeamId,
    retired,
    newgens,
    regulationReset,
  };
}

/** Corre una stagione intera senza input del giocatore. */
export function simulateSeason(world: World): SeasonSummary {
  while (world.week < SEASON_WEEKS) advanceWeek(world);
  return endSeason(world);
}
