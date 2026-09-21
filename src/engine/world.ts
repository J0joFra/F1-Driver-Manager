import type { MinigameKind, Seat, TrainingPlan, World } from './types.js';
import { createRng, hashSeed, type Rng } from './rng.js';
import { TEAM_SEEDS } from './data/teams.js';
import { TRACKS } from './data/tracks.js';
import { applyAging, createVeteran, overall, retirementChance } from './driver.js';
import { intakeNewgens, POTENTIAL_ANCHOR, runTransferMarket, settleFinances } from './market.js';
import { developCars, maybeReset, updatePrestige, updateTeamResources } from './regulations.js';
import { constructorStandings, driverStandings, rngFor, runWeekend, SEASON_WEEKS, seasonTotalsFor } from './season.js';
import {
  aiTrainingPlan, applyTraining, MINIGAME_AUTO, minigameMultiplier,
  pickMinigame, trainingLimits, validatePlan,
} from './training.js';

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

function buildSchedule(raceCount: number, rng: Rng): (string | null)[] {
  const schedule: (string | null)[] = new Array(SEASON_WEEKS).fill(null);
  const pool = rng.shuffle(TRACKS.map((t) => t.id));
  // Le gare non sono mai in settimane consecutive più di due volte di fila.
  const slots: number[] = [];
  for (let w = 1; w < SEASON_WEEKS - 1 && slots.length < raceCount; w++) {
    const recent = slots.slice(-2);
    if (recent.length === 2 && recent[1] === w - 1 && recent[0] === w - 2) continue;
    slots.push(w);
  }
  slots.slice(0, raceCount).forEach((w, i) => {
    schedule[w] = pool[i % pool.length]!;
  });
  return schedule;
}

export function createWorld(opts: CreateWorldOptions): World {
  const rng = createRng(hashSeed('world', opts.seed));
  const year = opts.year ?? 2031;

  const world: World = {
    seed: opts.seed,
    year,
    week: 0,
    round: 0,
    drivers: {},
    teams: {},
    schedule: buildSchedule(opts.races ?? 20, rng),
    regulations: { lastResetYear: year, nextResetYear: year + rng.int(4, 6) },
    seat: opts.seat ?? { mode: 'osservatore' },
    academy: [],
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
      colour: seed.colour,
      car: { ...seed.car },
      budget: seed.budget,
      prestige: seed.prestige,
      crew: { ...seed.crew },
      driverIds: [],
      futureFocus: 0,
    };
    world.constructorStandings[seed.id] = 0;
  }

  // Griglia iniziale: due piloti già formati per scuderia, di età varia.
  for (const team of Object.values(world.teams)) {
    for (let i = 0; i < 2; i++) {
      const anchor = POTENTIAL_ANCHOR + (team.prestige - 70) * 0.28;
      const d = createVeteran(rng, anchor, rng.int(22, 34), `d${year}i${team.id}${i}`);
      d.teamId = team.id;
      d.contractYears = rng.int(1, 3);
      d.salary = Math.round(team.budget * 0.06 * (overall(d.attrs) / 80));
      world.drivers[d.id] = d;
      world.standings[d.id] = 0;
      team.driverIds.push(d.id);
    }
  }

  intakeNewgens(world, rng, 6);
  return world;
}

export interface WeekOptions {
  /** piano di allenamento del giocatore; se assente lo sceglie l'IA */
  plan?: TrainingPlan;
  /** punteggio 0–1 nel minigioco; se assente vale l'allenamento automatico */
  minigameScore?: number;
}

export interface WeekReport {
  week: number;
  raceRun: string | null;
  minigame: MinigameKind | null;
  seasonOver: boolean;
}

/** Il pilota controllato dal giocatore, se la modalità è "pilota". */
export function playerDriver(world: World) {
  return world.seat.mode === 'pilota' ? world.drivers[world.seat.driverId] ?? null : null;
}

/**
 * Avanza di una settimana: allenamenti per tutti, poi l'eventuale weekend.
 * Restituisce cosa è successo, così l'interfaccia sa che schermata mostrare.
 */
export function advanceWeek(world: World, opts: WeekOptions = {}): WeekReport {
  const trackId = world.schedule[world.week] ?? null;
  const isRaceWeek = trackId !== null;
  const rng = rngFor(world, 'week');
  const player = playerDriver(world);

  let minigame: MinigameKind | null = null;

  for (const d of Object.values(world.drivers)) {
    if (d.retired) continue;
    const limits = trainingLimits(d, isRaceWeek);

    if (d === player && opts.plan) {
      const errs = validatePlan(opts.plan, limits);
      if (errs.length > 0) throw new Error(`Piano di allenamento non valido: ${errs.join('; ')}`);
      minigame = pickMinigame(opts.plan, world.lastMinigame);
      const mult = opts.minigameScore === undefined
        ? MINIGAME_AUTO
        : minigameMultiplier(opts.minigameScore);
      applyTraining(d, opts.plan, minigame ? mult : MINIGAME_AUTO);
    } else {
      applyTraining(d, aiTrainingPlan(d, limits, rng.next()), MINIGAME_AUTO);
    }
  }

  if (minigame) world.lastMinigame = minigame;
  if (trackId) runWeekend(world, trackId);

  world.week += 1;
  const seasonOver = world.week >= SEASON_WEEKS;
  return { week: world.week - 1, raceRun: trackId, minigame, seasonOver };
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
    applyAging(d);
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
  developCars(world, rng, standingOrder);

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
  world.schedule = buildSchedule(world.schedule.filter(Boolean).length, rng);

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
