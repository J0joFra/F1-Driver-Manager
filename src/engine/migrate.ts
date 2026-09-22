import type { World } from './types.js';
import { POTENTIAL_ANCHOR } from './market.js';
import { TEAM_SEEDS } from './data/teams.js';
import { buildCalendar, seasonStartDay, SEASON_WEEKS, type SeasonWeek } from './calendar.js';
import { createRng, hashSeed } from './rng.js';

/**
 * Salvataggi scritti da versioni precedenti.
 *
 * Il mondo è un oggetto che cresce a ogni funzione nuova: `offers` non
 * esisteva prima dei contratti, `talentAnchor` prima dell'anti-inflazione,
 * `short` sulle scuderie prima delle colonne strette. Un salvataggio vecchio
 * non li ha, e leggerli manda in crash l'app all'avvio — schermo nero, senza
 * un modo per uscirne.
 *
 * Qui i campi mancanti vengono riempiti con un valore sensato. Quando il
 * salvataggio è troppo rovinato per essere recuperato si restituisce `null`,
 * e l'app riparte dalla creazione di una carriera invece di rompersi.
 */
export function migrateWorld(raw: unknown): World | null {
  if (!raw || typeof raw !== 'object') return null;
  const w = raw as Partial<World> & Record<string, unknown>;

  // Senza questi non c'è un mondo da recuperare.
  if (!w.drivers || !w.teams || typeof w.year !== 'number' || !Array.isArray(w.schedule)) {
    return null;
  }

  // Il calendario ha cambiato forma due volte: prima era una lista di id di
  // circuito, poi quaranta settimane ancorate a febbraio, ora quarantaquattro
  // ancorate al calendario vero. In tutti e tre i casi si ricostruisce
  // mantenendo il numero di gare, e la settimana corrente si riporta in scala
  // sulla nuova lunghezza: il giocatore ritrova la stagione al punto in cui
  // l'aveva lasciata, anche se le date sotto sono cambiate.
  const schedule = w.schedule as unknown[];
  const first = schedule[0] as Partial<SeasonWeek> | string | null | undefined;
  const legacyList = schedule.length > 0 && (typeof first === 'string' || first === null);
  const staleShape = !legacyList && schedule.length > 0
    && (schedule.length !== SEASON_WEEKS
      || (first as Partial<SeasonWeek>)?.startDay !== seasonStartDay(w.year));

  if (legacyList || staleShape) {
    const races = legacyList
      ? schedule.filter((x) => typeof x === 'string').length || 20
      : schedule.filter((x) => (x as Partial<SeasonWeek>)?.trackId != null).length || 20;
    const progress = typeof w.week === 'number' ? w.week / Math.max(1, schedule.length) : 0;
    w.schedule = buildCalendar(w.year, races, createRng(hashSeed('calendario', w.seed ?? w.year)));
    w.week = Math.min(SEASON_WEEKS - 1, Math.round(progress * SEASON_WEEKS));
  }

  if (!Array.isArray(w.offers)) w.offers = [];
  if (typeof w.talentAnchor !== 'number') w.talentAnchor = POTENTIAL_ANCHOR;
  if (!Array.isArray(w.academy)) w.academy = [];
  if (!Array.isArray(w.results)) w.results = [];
  if (!Array.isArray(w.champions)) w.champions = [];
  if (!w.standings) w.standings = {};
  if (!w.constructorStandings) w.constructorStandings = {};
  if (w.lastMinigame === undefined) w.lastMinigame = null;
  if (typeof w.week !== 'number') w.week = 0;
  // Il tempo scorreva a settimane: un salvataggio vecchio riparte dal lunedì.
  if (typeof w.dayOfWeek !== 'number') w.dayOfWeek = 0;
  if (typeof w.round !== 'number') w.round = 0;
  if (!w.seat) w.seat = { mode: 'osservatore' };
  if (!w.regulations) {
    w.regulations = { lastResetYear: w.year, nextResetYear: w.year + 5 };
  }

  // `short` è arrivato dopo: senza, le colonne strette mostrano "undefined".
  for (const team of Object.values(w.teams)) {
    if (!team.short) {
      const seed = TEAM_SEEDS.find((t) => t.id === team.id);
      team.short = seed?.short ?? team.name.replace(/^Scuderia\s+/i, '').split(' ')[0] ?? team.name;
    }
  }

  for (const driver of Object.values(w.drivers)) {
    if (!Array.isArray(driver.staff)) driver.staff = [];
    if (!Array.isArray(driver.history)) driver.history = [];
    if (typeof driver.money !== 'number') driver.money = 0;
    // Arrivati con il modello di progressione: stanchezza e esperienza.
    if (typeof driver.fatigue !== 'number') driver.fatigue = 0;
    if (typeof driver.experience !== 'number') {
      // Si stima dalle gare già disputate, così un veterano non riparte da
      // zero: l'esperienza è ciò che lo tiene competitivo.
      driver.experience = Math.min(1000, (driver.career?.starts ?? 0) * 4);
    }
  }

  return w as World;
}
