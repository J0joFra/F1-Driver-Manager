import type { QualifyingPlan, QualiSession } from '../engine/qualifying.js';
import { beginQualifying, isOver, qualifyingGrid, runSegment } from '../engine/qualifying.js';
import { weekendStage } from '../engine/season.js';
import type { World } from '../engine/types.js';

/**
 * La qualifica in corso vive qui, fuori dallo store.
 *
 * Stessa ragione della gara: `QualiSession` contiene il generatore casuale,
 * che è una chiusura, e una chiusura non si serializza. Nel salvataggio finisce
 * solo il risultato — `world.qualifying` — che è l'unica cosa che deve
 * sopravvivere a una chiusura dell'app.
 */

let current: { trackId: string; session: QualiSession } | null = null;

export function beginQualifyingFor(world: World, trackId: string): QualiSession {
  if (current?.trackId === trackId && !isOver(current.session)) return current.session;
  const { track, entries, rng, qualiWet } = weekendStage(world, trackId);
  const playerIds = world.seat.mode === 'scuderia'
    ? world.teams[world.seat.teamId]?.driverIds ?? []
    : [];
  const session = beginQualifying(track, entries, rng, qualiWet, playerIds);
  current = { trackId, session };
  return session;
}

export function currentQualifying(): QualiSession | null {
  return current?.session ?? null;
}

/** Corre una manche con le decisioni del giocatore; l'IA riempie il resto. */
export function runQualifyingSegment(
  session: QualiSession,
  plans: Record<string, QualifyingPlan>,
): void {
  runSegment(session, new Map(Object.entries(plans)));
}

export { isOver as qualifyingOver, qualifyingGrid };

export function endQualifying(): void {
  current = null;
}
