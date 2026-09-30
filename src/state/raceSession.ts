import type { World } from '../engine/types.js';
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

export function beginRace(world: World, trackId: string) {
  const prepared = prepareWeekend(world, trackId);
  const playerIds = world.seat.mode === 'scuderia'
    ? world.teams[world.seat.teamId]?.driverIds ?? []
    : [];
  // Le strategie non si passano qui: la griglia le fa scegliere dopo, quando la
  // gara esiste già, con `applyStrategy`. Chi non sceglie corre quella
  // predefinita, che `createLiveRace` monta da sé.
  const race = createLiveRace(prepared.track, prepared.entries, prepared.raceRng, {
    wet: prepared.wet,
    ...(playerIds.length > 0 ? { playerIds } : {}),
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
