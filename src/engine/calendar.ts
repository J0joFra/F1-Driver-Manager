import type { Rng } from './rng.js';
import type { Region } from './types.js';
import { TRACKS } from './data/tracks.js';

/**
 * Il calendario della stagione.
 *
 * È modellato sul calendario vero della Formula 1, perché la sua forma non è
 * arbitraria: apre la seconda domenica di marzo, chiude la prima domenica di
 * dicembre, e ad agosto si ferma per tre settimane. In mezzo non ci sono gare
 * sparse a caso ma un giro del mondo — Oceania, Asia, Medio Oriente, la
 * trasferta americana di primavera, l'estate europea, poi di nuovo Asia,
 * Americhe e il finale in Medio Oriente.
 *
 * Tutto è ancorato a date reali invece che a un conteggio di settimane: così
 * le libere cadono di venerdì, la qualifica di sabato e la gara di domenica
 * anche negli anni bisestili, e la pausa estiva è davvero ad agosto.
 */

/** Tetto di settimane in un anno di gioco. Il dopo-stagione assorbe lo scarto. */
export const SEASON_WEEKS = 44;

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
  /**
   * Sessioni di allenamento concesse da questa settimana.
   *
   * Sta sulla settimana e non solo sul tipo perché nelle pause ci si allena
   * una settimana sì e una no: due settimane di pausa estiva hanno lo stesso
   * `kind` e capienza diversa. Il calendario resta l'unica fonte di verità su
   * cosa si può fare quando.
   */
  training: number;
}

/** Quante settimane di test precedono il via. */
const TESTING_WEEKS = 2;
/** Quante domeniche d'agosto restano libere. */
const SUMMER_BREAK_WEEKS = 3;
/** Tetto di gare: oltre, il giro del mondo perderebbe la sua forma. */
export const MAX_RACES = 24;

const DAY = 86_400_000;

function dayOfYear(date: Date): number {
  return Math.round((date.getTime() - Date.UTC(date.getUTCFullYear(), 0, 1)) / DAY);
}

/** L'n-esima domenica di un mese (n 1-based). */
function nthSunday(year: number, month: number, n: number): Date {
  const first = new Date(Date.UTC(year, month, 1));
  const offset = (7 - first.getUTCDay()) % 7; // getUTCDay: 0 = domenica
  return new Date(Date.UTC(year, month, 1 + offset + (n - 1) * 7));
}

/**
 * La stagione comincia con i test, due settimane prima dell'apertura, e
 * l'apertura è la seconda domenica di marzo. Il lunedì della settimana 0 è
 * quindi sei giorni prima di quella domenica, meno due settimane.
 */
export function seasonStartDay(year: number): number {
  const opener = nthSunday(year, 2, 2); // marzo
  return dayOfYear(opener) - 6 - TESTING_WEEKS * 7;
}

export function weekMonday(year: number, week: SeasonWeek): Date {
  return new Date(Date.UTC(year, 0, 1 + week.startDay));
}

/** La data di un giorno preciso della settimana, 0 = lunedì. */
export function dayDate(year: number, week: SeasonWeek, dayOfWeek: number): Date {
  return new Date(weekMonday(year, week).getTime() + dayOfWeek * DAY);
}

/** I tre giorni di un weekend: libere, qualifica, gara. */
export function weekendDays(year: number, week: SeasonWeek): { practice: Date; qualifying: Date; race: Date } {
  const monday = weekMonday(year, week);
  const at = (offset: number) => new Date(monday.getTime() + offset * DAY);
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

/**
 * Ora legale italiana: dall'ultima domenica di marzo all'ultima di ottobre
 * siamo a UTC+2, il resto dell'anno a UTC+1. Serve per dire al giocatore a
 * che ora vedrà la gara, che con le trasferte lontane è metà del discorso.
 */
export function italyOffset(date: Date): number {
  const year = date.getUTCFullYear();
  const marchLast = nthSunday(year, 2, 5).getUTCMonth() === 2 ? nthSunday(year, 2, 5) : nthSunday(year, 2, 4);
  const octoberLast = nthSunday(year, 9, 5).getUTCMonth() === 9 ? nthSunday(year, 9, 5) : nthSunday(year, 9, 4);
  return date >= marchLast && date < octoberLast ? 2 : 1;
}

/** L'ora italiana di una gara, come numero di ore 0–23. */
export function raceHourInItaly(localStart: number, utcOffset: number, raceDay: Date): number {
  return ((localStart - utcOffset + italyOffset(raceDay)) % 24 + 24) % 24;
}

export function formatHour(hour: number): string {
  return `${String(hour).padStart(2, '0')}:00`;
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
 * Sono poche sessioni di proposito. Un pilota non si allena dieci volte nella
 * settimana di un Gran Premio: prepara, viaggia, corre. Una sessione in un
 * weekend di gara e due in una settimana libera è il ritmo vero, e rende ogni
 * singola sessione una scelta invece che una riga di un monte ore.
 *
 * Nelle pause ci si allena una settimana sì e una no — in vacanza, ma senza
 * perdere la forma. La capienza effettiva di ogni settimana sta in
 * `SeasonWeek.training`, che applica questa alternanza.
 */
export const WEEK_TRAINING_CAPACITY: Record<WeekKind, number> = {
  testing: 3,
  free: 2,
  race: 1,
  summerBreak: 2,
  postseason: 2,
};

/** Le pause in cui ci si allena a settimane alterne. */
const ALTERNATING: ReadonlySet<WeekKind> = new Set<WeekKind>(['summerBreak', 'postseason']);

/**
 * La capienza effettiva di una settimana: la tabella qui sopra, ma spenta
 * nelle settimane pari delle pause. `offset` è la posizione dentro il blocco
 * di pausa, 0-based.
 */
export function capacityOf(kind: WeekKind, offset: number): number {
  if (ALTERNATING.has(kind) && offset % 2 === 1) return 0;
  return WEEK_TRAINING_CAPACITY[kind];
}

/**
 * Recupero extra concesso dalla settimana, in punti di stanchezza.
 *
 * Nelle pause si stacca davvero: è lì che si smaltisce il logorio di
 * ventiquattro Gran Premi. Ci si allena comunque a settimane alterne — un
 * pilota in vacanza non smette di correre — ma il bilancio resta nettamente
 * a favore del riposo.
 */
export const WEEK_RECOVERY: Record<WeekKind, number> = {
  testing: 0,
  free: 0,
  race: 0,
  summerBreak: 22,
  postseason: 6,
};

/**
 * Il giro del mondo, in ordine.
 *
 * Le due metà sono divise dalla pausa estiva. È la stessa struttura del
 * calendario vero: si apre lontano perché in Europa è ancora inverno, si
 * passa l'estate in Europa, e si chiude inseguendo la luce verso ovest fino
 * alle gare notturne del Medio Oriente.
 */
const TOUR_SPRING: readonly Region[] = [
  'oceania',
  'asia', 'asia',
  'middleEast', 'middleEast',
  'americas', 'americas',
  'europe', 'europe', 'europe', 'europe', 'europe', 'europe', 'europe',
];

const TOUR_AUTUMN: readonly Region[] = [
  'europe', 'europe',
  'asia', 'asia',
  'americas', 'americas', 'americas', 'americas',
  'middleEast', 'middleEast',
];

/**
 * Adatta un tratto di giro al numero di tappe effettivamente disponibili.
 * Se il calendario è più corto si saltano tappe in modo uniforme, se è più
 * lungo si ripete la regione dominante di quel tratto: meglio due gare in più
 * in Europa che un salto intercontinentale senza senso.
 */
function fitTour(template: readonly Region[], count: number): Region[] {
  if (count <= 0) return [];
  if (count === template.length) return [...template];
  if (count < template.length) {
    const step = template.length / count;
    return Array.from({ length: count }, (_, i) => template[Math.floor(i * step)]!);
  }
  const out = [...template];
  const dominant = mostCommon(template);
  while (out.length < count) out.splice(Math.floor(out.length / 2), 0, dominant);
  return out;
}

function mostCommon(regions: readonly Region[]): Region {
  const counts = new Map<Region, number>();
  for (const r of regions) counts.set(r, (counts.get(r) ?? 0) + 1);
  return [...counts.entries()].sort((a, b) => b[1] - a[1])[0]![0];
}

/**
 * Sceglie le settimane di gara fra quelle disponibili.
 *
 * Non le sparpaglia a intervalli regolari: le raggruppa in blocchi di una,
 * due o tre gare separati da settimane libere, come fa il calendario vero
 * dove le triple header ormai sono normali. I blocchi vengono decisi prima e
 * poi le settimane libere avanzate si distribuiscono fra loro, così la prima
 * e l'ultima gara cadono sempre esattamente sull'apertura e sul finale.
 */
function chooseRaceWeeks(available: readonly number[], races: number, rng: Rng): number[] {
  if (races >= available.length) return [...available];

  // Blocchi di gare consecutive. Due è la lunghezza tipica e tre è ormai
  // normale: sono le triple header a liberare le settimane che diventano le
  // pause lunghe di primavera. Un calendario tutto di gare singole sarebbe
  // regolare e irreale.
  const clusters: number[] = [];
  let placed = 0;
  while (placed < races) {
    const roll = rng.next();
    const size = Math.min(roll < 0.18 ? 1 : roll < 0.62 ? 2 : 3, races - placed);
    clusters.push(size);
    placed += size;
  }

  // Ogni intervallo fra due blocchi vale almeno una settimana libera. Se i
  // blocchi non ci stanno si fondono, partendo dal più corto: fondere sempre
  // l'ultimo ammasserebbe la coda della stagione in un blocco unico.
  const freeWeeks = available.length - races;
  while (clusters.length - 1 > freeWeeks && clusters.length > 1) {
    let smallest = 0;
    for (let i = 1; i < clusters.length; i++) if (clusters[i]! < clusters[smallest]!) smallest = i;
    const before = clusters[smallest - 1] ?? Infinity;
    const after = clusters[smallest + 1] ?? Infinity;
    const neighbour = before <= after ? smallest - 1 : smallest + 1;
    const lo = Math.min(smallest, neighbour);
    clusters[lo] = clusters[smallest]! + clusters[neighbour]!;
    clusters.splice(Math.max(smallest, neighbour), 1);
  }

  const gaps = Array.from({ length: Math.max(0, clusters.length - 1) }, () => 1);
  let surplus = freeWeeks - gaps.length;
  while (surplus > 0 && gaps.length > 0) {
    gaps[rng.int(0, gaps.length - 1)]! += 1;
    surplus -= 1;
  }

  const chosen: number[] = [];
  let cursor = 0;
  for (let c = 0; c < clusters.length; c++) {
    for (let i = 0; i < clusters[c]!; i++) chosen.push(available[cursor++]!);
    cursor += gaps[c] ?? 0;
  }
  return chosen;
}

/**
 * Costruisce il calendario di una stagione.
 *
 * Le date vengono prima: si calcolano apertura, pausa estiva e finale, e solo
 * dopo si decide dove stanno le gare. È l'ordine giusto, perché la forma
 * dell'anno non dipende da quante gare ci sono quell'anno.
 */
export function buildCalendar(year: number, raceCount: number, rng: Rng): SeasonWeek[] {
  const start = seasonStartDay(year);
  const weeks: SeasonWeek[] = Array.from({ length: SEASON_WEEKS }, (_, i) => ({
    index: i, kind: 'free' as WeekKind, startDay: start + i * 7,
    trackId: null, round: null, training: WEEK_TRAINING_CAPACITY.free,
  }));

  const weekOf = (sunday: Date) => Math.round((dayOfYear(sunday) - 6 - start) / 7);
  const openerWeek = TESTING_WEEKS;
  const finaleWeek = Math.min(SEASON_WEEKS - 1, weekOf(nthSunday(year, 11, 1))); // dicembre
  const breakStart = weekOf(nthSunday(year, 7, 1)); // agosto

  for (let i = 0; i < TESTING_WEEKS; i++) setKind(weeks[i], 'testing', i);
  for (let i = 0; i < SUMMER_BREAK_WEEKS; i++) setKind(weeks[breakStart + i], 'summerBreak', i);
  for (let i = finaleWeek + 1; i < SEASON_WEEKS; i++) {
    setKind(weeks[i], 'postseason', i - finaleWeek - 1);
  }

  const available: number[] = [];
  for (let i = openerWeek; i <= finaleWeek; i++) {
    if (weeks[i]!.kind === 'free') available.push(i);
  }

  const races = Math.max(1, Math.min(raceCount, available.length, MAX_RACES, TRACKS.length));
  const raceWeeks = chooseRaceWeeks(available, races, rng);

  // Il giro del mondo si adatta a quante gare cadono prima e dopo la pausa.
  const beforeBreak = raceWeeks.filter((w) => w < breakStart).length;
  const tour = [
    ...fitTour(TOUR_SPRING, beforeBreak),
    ...fitTour(TOUR_AUTUMN, races - beforeBreak),
  ];

  // Ogni regione ha il suo mazzo mescolato: i circuiti girano di anno in anno
  // e qualcuno resta fuori, come succede davvero.
  const pools = new Map<Region, string[]>();
  for (const id of rng.shuffle(TRACKS.map((t) => t.id))) {
    const region = TRACKS.find((t) => t.id === id)!.region;
    if (!pools.has(region)) pools.set(region, []);
    pools.get(region)!.push(id);
  }
  /**
   * Se una regione esaurisce i circuiti, il ripiego non pesca a caso: prende
   * dalla tappa vicina nel giro. Meglio una gara europea in più di fila che
   * una trasferta in Europa incastrata fra Americhe e Medio Oriente — è
   * l'errore che rende evidente che il calendario è generato.
   */
  const take = (region: Region | undefined): string | null => {
    const pool = region ? pools.get(region) : undefined;
    return pool && pool.length > 0 ? pool.shift()! : null;
  };
  const fullest = (): string => {
    const best = [...pools.values()].sort((a, b) => b.length - a.length)[0];
    if (!best || best.length === 0) throw new Error('Circuiti esauriti');
    return best.shift()!;
  };

  raceWeeks.forEach((weekIndex, r) => {
    const week = weeks[weekIndex]!;
    setKind(week, 'race', 0);
    week.trackId = take(tour[r]) ?? take(tour[r - 1]) ?? take(tour[r + 1]) ?? fullest();
    week.round = r + 1;
  });

  return weeks;
}

/** Assegna tipo e capienza insieme: separarli lascerebbe le due cose divergere. */
function setKind(week: SeasonWeek | undefined, kind: WeekKind, offset: number): void {
  if (!week) return;
  week.kind = kind;
  week.training = capacityOf(kind, offset);
}

export function raceCountOf(schedule: readonly SeasonWeek[]): number {
  return schedule.filter((w) => w.trackId !== null).length;
}
