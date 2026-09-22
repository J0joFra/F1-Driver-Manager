import type { Rng } from './rng.js';
import { TRACKS } from './data/tracks.js';

/**
 * Il calendario della stagione.
 *
 * Una stagione non è una fila di quaranta caselle uguali: ci sono i test
 * invernali, i weekend di gara, le settimane libere e la pausa estiva. Dare un
 * carattere a ogni settimana serve a due cose — far capire al giocatore dove
 * si trova nell'anno, e dare peso diverso al tempo: nella pausa non ci si
 * allena e si recupera, nei test si lavora il doppio.
 */

export const SEASON_WEEKS = 40;

export type WeekKind =
  | 'testing'      // test invernali: si lavora tanto, non si corre
  | 'race'         // weekend di gara
  | 'free'         // settimana fra due gare
  | 'summerBreak'  // pausa estiva: fabbriche chiuse, riposo forzato
  | 'postseason';  // dopo l'ultima gara

export interface SeasonWeek {
  /** 0-based nell'anno di gioco */
  index: number;
  kind: WeekKind;
  /** giorno dell'anno del lunedì di questa settimana, 0-based */
  startDay: number;
  trackId: string | null;
  /** numero di round, 1-based; null se non si corre */
  round: number | null;
}

/** Blocchi fissi dell'anno. Le gare si distribuiscono solo nei due periodi di corse. */
const TESTING_WEEKS = 2;
const SUMMER_BREAK = { start: 21, weeks: 3 } as const;
const POSTSEASON_START = 38;

/** La stagione parte con i test nella settimana del primo lunedì di febbraio. */
export function seasonStartDay(year: number): number {
  const feb1 = new Date(Date.UTC(year, 1, 1));
  const weekday = (feb1.getUTCDay() + 6) % 7; // 0 = lunedì
  const firstMonday = new Date(Date.UTC(year, 1, 1 + ((7 - weekday) % 7)));
  const jan1 = Date.UTC(year, 0, 1);
  return Math.round((firstMonday.getTime() - jan1) / 86_400_000);
}

export function weekMonday(year: number, week: SeasonWeek): Date {
  return new Date(Date.UTC(year, 0, 1 + week.startDay));
}

/** I tre giorni di un weekend: libere, qualifica, gara. */
export function weekendDays(year: number, week: SeasonWeek): { practice: Date; qualifying: Date; race: Date } {
  const monday = weekMonday(year, week);
  const at = (offset: number) => new Date(monday.getTime() + offset * 86_400_000);
  return { practice: at(4), qualifying: at(5), race: at(6) };
}

const MONTHS = [
  'gennaio', 'febbraio', 'marzo', 'aprile', 'maggio', 'giugno',
  'luglio', 'agosto', 'settembre', 'ottobre', 'novembre', 'dicembre',
];

export function formatDay(date: Date): string {
  return `${date.getUTCDate()} ${MONTHS[date.getUTCMonth()]}`;
}

export function formatShortDay(date: Date): string {
  return `${String(date.getUTCDate()).padStart(2, '0')}/${String(date.getUTCMonth() + 1).padStart(2, '0')}`;
}

export function monthName(index: number): string {
  return MONTHS[index] ?? '';
}

export const WEEK_LABEL: Record<WeekKind, string> = {
  testing: 'Test invernali',
  race: 'Weekend di gara',
  free: 'Settimana libera',
  summerBreak: 'Pausa estiva',
  postseason: 'Fine stagione',
};

/**
 * Quanto si può lavorare in una settimana, prima dei bonus dello staff.
 *
 * Nella pausa estiva le fabbriche chiudono davvero: non ci si allena, si
 * recupera. È l'unico momento dell'anno in cui la stanchezza scende da sola.
 */
export const WEEK_TRAINING_CAPACITY: Record<WeekKind, number> = {
  testing: 12,
  free: 10,
  race: 6,
  summerBreak: 0,
  postseason: 8,
};

/** Recupero extra concesso dalla settimana, in punti di stanchezza. */
export const WEEK_RECOVERY: Record<WeekKind, number> = {
  testing: 0,
  free: 0,
  race: 0,
  summerBreak: 22,
  postseason: 6,
};

/**
 * Costruisce il calendario di una stagione.
 *
 * Le gare stanno solo nei due periodi di corse, mai tre weekend di fila, e la
 * pausa estiva resta sgombra. Il numero di gare si adatta allo spazio: meglio
 * un calendario onesto che venti round incastrati a forza.
 */
export function buildCalendar(year: number, raceCount: number, rng: Rng): SeasonWeek[] {
  const weeks: SeasonWeek[] = [];
  const summerEnd = SUMMER_BREAK.start + SUMMER_BREAK.weeks;

  for (let i = 0; i < SEASON_WEEKS; i++) {
    let kind: WeekKind = 'free';
    if (i < TESTING_WEEKS) kind = 'testing';
    else if (i >= SUMMER_BREAK.start && i < summerEnd) kind = 'summerBreak';
    else if (i >= POSTSEASON_START) kind = 'postseason';
    weeks.push({
      index: i,
      kind,
      startDay: seasonStartDay(year) + i * 7,
      trackId: null,
      round: null,
    });
  }

  // Settimane in cui si può correre, con almeno una libera ogni due gare.
  const slots: number[] = [];
  let consecutive = 0;
  for (let i = TESTING_WEEKS; i < POSTSEASON_START; i++) {
    if (weeks[i]!.kind === 'summerBreak') {
      consecutive = 0;
      continue;
    }
    if (consecutive >= 2) {
      consecutive = 0;
      continue;
    }
    slots.push(i);
    consecutive += 1;
  }

  const pool = rng.shuffle(TRACKS.map((t) => t.id));
  const races = Math.min(raceCount, slots.length);
  // Le gare si spalmano sull'intero spazio invece di ammassarsi all'inizio.
  const step = slots.length / races;
  for (let r = 0; r < races; r++) {
    const week = weeks[slots[Math.floor(r * step)]!]!;
    week.kind = 'race';
    week.trackId = pool[r % pool.length]!;
    week.round = r + 1;
  }

  return weeks;
}

export function raceCountOf(schedule: readonly SeasonWeek[]): number {
  return schedule.filter((w) => w.trackId !== null).length;
}
