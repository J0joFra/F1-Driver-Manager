import type { Driver, QualifyingResult, RaceResult, SeasonTotals, Track, WeekendResult, World } from './types.js';
import { clamp, createRng, hashSeed, type Rng } from './rng.js';
import { getTrack } from './data/tracks.js';
import { carPaceOn } from './layout.js';
import { simulateQualifying, simulateRace, type RaceEntry } from './race.js';
import { RACE_FATIGUE } from './progression.js';
import { pointsForRace, skillEffects, spendPointsAsAi } from './skills.js';

// La lunghezza della stagione la decide il calendario: qui si riespone perché
// mezzo motore la usa come limite del ciclo settimanale.
export { SEASON_WEEKS } from './calendar.js';

/** Generatore derivato dal salvataggio: stesso mondo, stessa storia. */
export function rngFor(world: World, label: string): Rng {
  return createRng(hashSeed(`${label}:${world.year}:${world.week}:${world.round}`, world.seed));
}

/**
 * Gli ingressi della gara, **per questo tracciato**.
 *
 * Il passo della monoposto non è un numero che la macchina si porta dietro:
 * dipende da dove si corre. Una scuderia che ha sviluppato la potenza va
 * forte dove ci sono rettilinei e fatica fra i muretti, ed è da qui che
 * quella storia entra nel campionato.
 */
export function buildEntries(world: World, track: Track): RaceEntry[] {
  const entries: RaceEntry[] = [];
  for (const team of Object.values(world.teams)) {
    for (const driverId of team.driverIds) {
      const d = world.drivers[driverId];
      if (!d || d.retired) continue;
      const formShift = (d.form - 50) * 0.06;
      // Le abilità sbloccate entrano in gara qui: il modello lavora sugli
      // ingressi, non sui piloti, e così non deve sapere che esistono.
      const skills = skillEffects(d);
      entries.push({
        driverId: d.id,
        teamId: team.id,
        carPace: carPaceOn(team.car, track.layout),
        reliability: team.car.reliability,
        speed: clamp(d.attrs.speed + formShift, 1, 99),
        consistency: clamp(d.attrs.consistency + formShift, 1, 99),
        tyres: d.attrs.tyres,
        starts: clamp(d.attrs.starts + skills.start, 1, 99),
        wet: clamp(d.attrs.wet + skills.wet, 1, 99),
        composure: clamp(d.attrs.composure + (d.morale - 50) * 0.08, 1, 99),
        technical: d.attrs.technical,
        pitCrew: team.crew.pitCrew,
        grid: 0,
        overtakeMod: skills.overtake,
        tyreWearMod: skills.tyreWear,
      });
    }
  }
  return entries;
}

export interface PreparedWeekend {
  trackId: string;
  track: Track;
  entries: RaceEntry[];
  qualifying: QualifyingResult[];
  wet: boolean;
  /** generatore da passare alla gara, derivato dal salvataggio */
  raceRng: Rng;
}

/**
 * Prepara il weekend fino alla griglia di partenza, senza correre la gara.
 *
 * Serve a dare all'interfaccia il punto in cui fermarsi: la gara può essere
 * giocata dal vivo oppure simulata, e in entrambi i casi parte da qui.
 */
export function prepareWeekend(world: World, trackId: string): PreparedWeekend {
  const track = getTrack(trackId);
  const rng = rngFor(world, `weekend:${trackId}`);
  const entries = buildEntries(world, track);

  const wet = rng.chance(track.rain);
  // Le tre decisioni del giocatore entrano da qui; per tutti gli altri le
  // sceglie l'IA dentro `simulateQualifying`.
  const playerId = world.seat.mode === 'pilota' ? world.seat.driverId : null;
  const plans = playerId && world.qualifyingPlan
    ? new Map([[playerId, world.qualifyingPlan]])
    : undefined;
  const qualifying = simulateQualifying(track, entries, rng, wet && rng.chance(0.5), plans);
  const gridById = new Map(qualifying.map((q) => [q.driverId, q.position]));
  for (const e of entries) e.grid = gridById.get(e.driverId) ?? entries.length;

  return { trackId, track, entries, qualifying, wet, raceRng: rng.fork(`race:${trackId}`) };
}

/** Registra l'esito nel mondo: punti, classifiche, carriere, reputazione, forma. */
export function commitWeekend(
  world: World,
  prepared: PreparedWeekend,
  results: RaceResult[],
  safetyCars: number,
): WeekendResult {
  const { entries, qualifying, trackId } = prepared;
  const playerId = world.seat.mode === 'pilota' ? world.seat.driverId : null;
  const gridById = new Map(qualifying.map((q) => [q.driverId, q.position]));

  // Posizione attesa in base alla sola monoposto: serve a giudicare il pilota.
  const byCar = [...entries].sort((a, b) => b.carPace - a.carPace);
  const expected = new Map(byCar.map((e, i) => [e.driverId, i + 1]));

  for (const r of results) {
    const d = world.drivers[r.driverId];
    if (!d) continue;
    world.standings[d.id] = (world.standings[d.id] ?? 0) + r.points;
    if (d.teamId) {
      world.constructorStandings[d.teamId] = (world.constructorStandings[d.teamId] ?? 0) + r.points;
    }

    d.career.starts += 1;
    d.career.points += r.points;
    // Correre stanca più che allenarsi: due ore al limite, con il collo e il
    // fiato di un weekend intero dietro.
    d.fatigue = clamp(d.fatigue + RACE_FATIGUE, 0, 100);

    // Correre insegna, vincere insegna di più. Il giocatore i punti li
    // spende a mano; gli altri se li giocano da soli, o la griglia
    // resterebbe indietro rispetto a chi è al volante di una persona.
    d.skillPoints += pointsForRace(d.career.starts);
    if (d.id !== playerId) spendPointsAsAi(d);
    if (!r.dnf) {
      if (r.position === 1) d.career.wins += 1;
      if (r.position <= 3) d.career.podiums += 1;
      if (r.position < d.career.bestFinish) d.career.bestFinish = r.position;
    }
    if ((gridById.get(d.id) ?? 99) === 1) d.career.poles += 1;

    // La reputazione misura quanto hai fatto meglio della tua macchina.
    const exp = expected.get(d.id) ?? r.position;
    let rep = clamp((exp - r.position) * 0.55, -4, 5);
    if (!r.dnf && r.position === 1) rep += 3;
    else if (!r.dnf && r.position <= 3) rep += 1.5;
    if (r.dnf) rep -= 0.4;
    // Chi sa stare davanti a una telecamera costruisce fama più in fretta,
    // e la fama è quello che le scuderie comprano.
    d.reputation = clamp(d.reputation + rep * skillEffects(d).reputation, 0, 100);

    const swing = clamp((exp - r.position) * 1.6, -12, 12);
    d.form = clamp(d.form * 0.82 + 50 * 0.18 + swing, 5, 95);
    d.morale = clamp(d.morale * 0.88 + 55 * 0.12 + swing * 0.7, 5, 95);
  }

  const result: WeekendResult = {
    trackId,
    round: world.round,
    qualifying,
    race: results,
    wet: prepared.wet,
    safetyCars,
  };
  world.results.push(result);
  world.round += 1;
  // Le decisioni valgono per un weekend solo: il prossimo si ridecide.
  world.qualifyingPlan = null;
  return result;
}

/** Weekend completo simulato: prepara, corre e registra. */
export function runWeekend(world: World, trackId: string): WeekendResult {
  const prepared = prepareWeekend(world, trackId);
  const outcome = simulateRace(prepared.track, prepared.entries, prepared.raceRng, { wet: prepared.wet });
  return commitWeekend(world, prepared, outcome.results, outcome.safetyCars);
}

export interface StandingRow {
  driverId: string;
  points: number;
  position: number;
}

export function driverStandings(world: World): StandingRow[] {
  return Object.entries(world.standings)
    .sort((a, b) => b[1] - a[1])
    .map(([driverId, points], i) => ({ driverId, points, position: i + 1 }));
}

export function constructorStandings(world: World): { teamId: string; points: number }[] {
  return Object.entries(world.constructorStandings)
    .sort((a, b) => b[1] - a[1])
    .map(([teamId, points]) => ({ teamId, points }));
}

/** Aggregati della stagione per un pilota: ~200 byte, conservati per sempre. */
export function seasonTotalsFor(world: World, d: Driver, championshipPos: number): SeasonTotals {
  let points = 0, wins = 0, podiums = 0, poles = 0, dnf = 0, starts = 0, bestFinish = 99;
  for (const w of world.results) {
    const r = w.race.find((x) => x.driverId === d.id);
    if (!r) continue;
    starts += 1;
    points += r.points;
    if (r.dnf) dnf += 1;
    else {
      if (r.position === 1) wins += 1;
      if (r.position <= 3) podiums += 1;
      if (r.position < bestFinish) bestFinish = r.position;
    }
    if (w.qualifying[0]?.driverId === d.id) poles += 1;
  }
  return {
    year: world.year,
    teamId: d.teamId ?? '',
    points, wins, podiums, poles, dnf, starts,
    bestFinish: bestFinish === 99 ? 0 : bestFinish,
    championshipPos,
  };
}
