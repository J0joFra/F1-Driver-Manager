import type { Compound, World } from '../engine/types.js';
import { prepareWeekend, type PreparedWeekend } from '../engine/season.js';
import { createLiveRace, type LiveRace } from '../engine/liveRace.js';

/**
 * La gara in corso vive qui, fuori dallo store.
 *
 * `LiveRace` contiene il generatore casuale, che è una chiusura: non è
 * serializzabile e non deve finire nel salvataggio. Lo store tiene solo un
 * flag; l'oggetto vero sta in questo modulo e viene mutato a ogni passo,
 * mentre React lo rilegge senza ricrearlo.
 */

let current: { prepared: PreparedWeekend; race: LiveRace } | null = null;

export function beginRace(world: World, trackId: string, playerCompound: Compound = 'M') {
  const prepared = prepareWeekend(world, trackId);
  const playerIds = world.seat.mode === 'scuderia'
    ? world.teams[world.seat.teamId]?.driverIds ?? []
    : [];
  const race = createLiveRace(prepared.track, prepared.entries, prepared.raceRng, {
    wet: prepared.wet,
    ...(playerIds.length > 0 ? { playerIds, playerCompound } : {}),
  });
  current = { prepared, race };
  return current;
}

export function currentRace() {
  return current;
}

export function endRace(): void {
  current = null;
}
