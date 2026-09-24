import type { Driver, SeasonWeek, Team, World } from './types.js';
import { getTrack } from './data/tracks.js';
import { driverStandings, SEASON_WEEKS } from './season.js';
import { dayDate, raceCountOf, weekendDays, WEEK_LABEL, type WeekKind } from './calendar.js';
import { RACE_DAY } from './days.js';

/** Query di sola lettura sul mondo. Nessuna muta lo stato. */

/** La scuderia del giocatore. */
export function myTeam(world: World): Team | null {
  return world.seat.mode === 'scuderia' ? world.teams[world.seat.teamId] ?? null : null;
}

/** I piloti sotto contratto con la scuderia del giocatore, in ordine di sedile. */
export function myDrivers(world: World): Driver[] {
  const team = myTeam(world);
  if (!team) return [];
  return team.driverIds.map((id) => world.drivers[id]).filter((d): d is Driver => !!d);
}

/**
 * Il pilota su cui sono puntate le schede di dettaglio.
 *
 * Gestendo due monoposto, «il pilota» non esiste più come cosa unica: c'è
 * quello che stai guardando. Se non ne hai scelto nessuno si prende il primo,
 * e se non ne hai nessuno sotto contratto la risposta è `null` — che è uno
 * stato possibile del gioco, non un errore.
 */
export function focusedDriver(world: World, selected: string | null): Driver | null {
  const roster = myDrivers(world);
  return roster.find((d) => d.id === selected) ?? roster[0] ?? null;
}

export function teamOf(world: World, d: Driver | null): Team | null {
  return d?.teamId ? world.teams[d.teamId] ?? null : null;
}

export function teammateOf(world: World, d: Driver | null): Driver | null {
  const team = teamOf(world, d);
  if (!team || !d) return null;
  const id = team.driverIds.find((x) => x !== d.id);
  return id ? world.drivers[id] ?? null : null;
}

export function currentWeek(world: World): SeasonWeek | null {
  return world.schedule[world.week] ?? null;
}

export function isRaceWeek(world: World): boolean {
  return currentWeek(world)?.trackId != null;
}

export function weekKind(world: World): WeekKind {
  return currentWeek(world)?.kind ?? 'postseason';
}

export function weekLabel(world: World): string {
  return WEEK_LABEL[weekKind(world)];
}

/** La data di oggi nel mondo: settimana più giorno della settimana. */
export function today(world: World): Date | null {
  const week = currentWeek(world);
  return week ? dayDate(world.year, week, world.dayOfWeek) : null;
}

/** Oggi si corre. */
export function isRaceDay(world: World): boolean {
  return isRaceWeek(world) && world.dayOfWeek === RACE_DAY;
}

export interface NextRace {
  trackId: string;
  trackName: string;
  week: number;
  weeksAway: number;
  round: number;
  totalRounds: number;
  /** giorno della gara, per mostrarlo nel calendario */
  raceDay: Date;
}

export function nextRace(world: World): NextRace | null {
  const total = raceCountOf(world.schedule);
  for (let w = world.week; w < SEASON_WEEKS; w++) {
    const week = world.schedule[w];
    if (!week?.trackId) continue;
    return {
      trackId: week.trackId,
      trackName: getTrack(week.trackId).name,
      week: w,
      weeksAway: w - world.week,
      round: week.round ?? world.round + 1,
      totalRounds: total,
      raceDay: weekendDays(world.year, week).race,
    };
  }
  return null;
}

export function championshipPosition(world: World, driverId: string): number {
  const row = driverStandings(world).find((r) => r.driverId === driverId);
  return row?.position ?? 0;
}

/** Risultati del pilota gara per gara, nell'ordine in cui si sono corse. */
export function seasonResults(world: World, driverId: string) {
  return world.results.map((w) => ({
    trackId: w.trackId,
    trackName: getTrack(w.trackId).name,
    grid: w.qualifying.find((q) => q.driverId === driverId)?.position ?? 0,
    race: w.race.find((r) => r.driverId === driverId) ?? null,
  }));
}

/** Testa a testa con il compagno di squadra: lo stesso mezzo, nessun alibi. */
export function headToHead(world: World, a: string, b: string) {
  let qualiA = 0, qualiB = 0, raceA = 0, raceB = 0;
  for (const w of world.results) {
    const qa = w.qualifying.find((q) => q.driverId === a)?.position;
    const qb = w.qualifying.find((q) => q.driverId === b)?.position;
    if (qa && qb) (qa < qb ? qualiA++ : qualiB++);
    const ra = w.race.find((r) => r.driverId === a);
    const rb = w.race.find((r) => r.driverId === b);
    if (ra && rb && !ra.dnf && !rb.dnf) (ra.position < rb.position ? raceA++ : raceB++);
  }
  return { qualiA, qualiB, raceA, raceB };
}
