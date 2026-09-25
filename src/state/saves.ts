import type { World } from '../engine/types.js';
import { migrateWorld } from '../engine/migrate.js';
import { constructorStandings } from '../engine/season.js';

/**
 * Gli slot di salvataggio.
 *
 * Tre partite in parallelo, ciascuna in una chiave sua. Il menu ne mostra
 * l'anteprima senza caricarle tutte: l'indice è un oggetto piccolo e separato,
 * perché leggere tre mondi interi — duecento chilobyte l'uno — solo per
 * scrivere «Corse Aurora, 2034, 4ª» renderebbe lenta la schermata da cui si
 * entra nel gioco.
 */

export const SLOT_COUNT = 3;

const INDEX_KEY = 'f1dm-slots-v1';
const slotKey = (slot: number) => `f1dm-slot-${slot}`;

export interface SlotMeta {
  slot: number;
  teamName: string;
  teamColour: string;
  year: number;
  /** settimana della stagione, per dire a che punto è */
  week: number;
  position: number;
  teams: number;
  /** quando è stato scritto, in millisecondi */
  saved: number;
}

export type SlotIndex = Record<number, SlotMeta>;

export function readIndex(): SlotIndex {
  try {
    const raw = localStorage.getItem(INDEX_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw) as SlotIndex;
    return typeof parsed === 'object' && parsed ? parsed : {};
  } catch {
    return {};
  }
}

function writeIndex(index: SlotIndex): void {
  try {
    localStorage.setItem(INDEX_KEY, JSON.stringify(index));
  } catch {
    // Spazio esaurito: il mondo attivo resta comunque salvato dallo store.
  }
}

/** L'anteprima che il menu mostra, ricavata dal mondo. */
export function describe(world: World, slot: number): SlotMeta {
  const team = world.seat.mode === 'scuderia' ? world.teams[world.seat.teamId] : null;
  const table = constructorStandings(world);
  return {
    slot,
    teamName: team?.name ?? 'Scuderia sconosciuta',
    teamColour: team?.colour ?? '#888888',
    year: world.year,
    week: world.week,
    position: team ? table.findIndex((c) => c.teamId === team.id) + 1 : 0,
    teams: Object.keys(world.teams).length,
    saved: Date.now(),
  };
}

export function saveSlot(slot: number, world: World): SlotMeta | null {
  if (slot < 0 || slot >= SLOT_COUNT) return null;
  const meta = describe(world, slot);
  try {
    localStorage.setItem(slotKey(slot), JSON.stringify(world));
  } catch {
    // Se il mondo non entra, l'indice non deve dire che c'è: sarebbe uno slot
    // che si vede nel menu e non si carica.
    return null;
  }
  const index = readIndex();
  index[slot] = meta;
  writeIndex(index);
  return meta;
}

/** Carica uno slot, passando dalla stessa migrazione del salvataggio attivo. */
export function loadSlot(slot: number): World | null {
  try {
    const raw = localStorage.getItem(slotKey(slot));
    if (!raw) return null;
    return migrateWorld(JSON.parse(raw));
  } catch {
    return null;
  }
}

export function deleteSlot(slot: number): void {
  try {
    localStorage.removeItem(slotKey(slot));
  } catch {
    // niente da fare
  }
  const index = readIndex();
  delete index[slot];
  writeIndex(index);
}

/** Il primo slot libero, o `null` se sono tutti pieni. */
export function firstFreeSlot(index = readIndex()): number | null {
  for (let i = 0; i < SLOT_COUNT; i++) if (!index[i]) return i;
  return null;
}

/** Quanto tempo fa, detto in italiano e in modo grossolano. */
export function savedAgo(saved: number, now = Date.now()): string {
  const minutes = Math.max(0, Math.round((now - saved) / 60_000));
  if (minutes < 1) return 'adesso';
  if (minutes < 60) return `${minutes} min fa`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `${hours} ${hours === 1 ? 'ora' : 'ore'} fa`;
  const days = Math.round(hours / 24);
  return `${days} ${days === 1 ? 'giorno' : 'giorni'} fa`;
}
