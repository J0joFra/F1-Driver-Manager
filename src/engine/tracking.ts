import type { ProfileStats } from './profile.js';
import type { RaceResult, World } from './types.js';
import { constructorStandings, driverStandings } from './season.js';

/**
 * Cosa il profilo impara da una partita.
 *
 * Gli obiettivi contano su tutte le carriere, il mondo su una sola: qualcuno
 * deve tradurre. Sta qui, in funzioni pure che prendono il mondo e
 * restituiscono **quanto aggiungere** — non che lo scrivono da sole. Così
 * l'unico posto che tocca il profilo resta lo store, e questo file si può
 * provare senza inventarsi un profilo.
 */

/** Cosa aggiungere ai contatori dopo un weekend corso. */
export function fromWeekend(world: World, results: readonly RaceResult[]): Partial<ProfileStats> {
  const mine = new Set(world.seat.mode === 'scuderia'
    ? world.teams[world.seat.teamId]?.driverIds ?? []
    : []);
  if (mine.size === 0) return {};

  let racesEntered = 0, wins = 0, podiums = 0, poles = 0;
  for (const r of results) {
    if (!mine.has(r.driverId)) continue;
    racesEntered += 1;
    if (r.grid === 1) poles += 1;
    if (r.dnf) continue;
    if (r.position === 1) wins += 1;
    if (r.position <= 3) podiums += 1;
  }
  return { racesEntered, wins, podiums, poles };
}

/**
 * Cosa aggiungere a fine stagione.
 *
 * `bestConstructorPosition` non si somma: è un minimo, e va trattato a parte
 * da chi applica il risultato — sommare due terzi posti darebbe un sesto.
 */
export interface SeasonTally {
  add: Partial<ProfileStats>;
  /** posizione costruttori di quest'anno, da confrontare con la migliore */
  constructorPosition: number;
}

export function fromSeason(world: World): SeasonTally {
  if (world.seat.mode !== 'scuderia') return { add: {}, constructorPosition: 0 };
  const teamId = world.seat.teamId;
  const team = world.teams[teamId];
  if (!team) return { add: {}, constructorPosition: 0 };

  const table = constructorStandings(world);
  const position = table.findIndex((c) => c.teamId === teamId) + 1;

  const champion = driverStandings(world)[0];
  const titles = champion && team.driverIds.includes(champion.driverId) ? 1 : 0;
  const constructorTitles = position === 1 ? 1 : 0;

  return {
    add: { seasons: 1, titles, constructorTitles },
    constructorPosition: position,
  };
}

/** Applica un incremento ai contatori, con la regola del minimo dove serve. */
export function applyTally(
  stats: ProfileStats, add: Partial<ProfileStats>, constructorPosition = 0,
): void {
  for (const [key, value] of Object.entries(add) as [keyof ProfileStats, number][]) {
    if (key === 'bestConstructorPosition') continue;
    stats[key] += value;
  }
  if (constructorPosition > 0) {
    stats.bestConstructorPosition = stats.bestConstructorPosition === 0
      ? constructorPosition
      : Math.min(stats.bestConstructorPosition, constructorPosition);
  }
}
