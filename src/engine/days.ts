import type { TrainingCategory, TrainingPlan } from './types.js';
import type { SeasonWeek } from './calendar.js';
import { TRAINING_CATEGORIES } from './training.js';

/**
 * La settimana giorno per giorno.
 *
 * Il motore ha sempre ragionato a settimane, e continua a farlo: i conti
 * dell'allenamento sono tarati su una settimana intera e spezzarli in sette
 * pezzi li cambierebbe. Quello che cambia è il **passo del tempo**: il
 * giocatore avanza di un giorno alla volta e vede il calendario scorrere,
 * come in Soccer Manager.
 *
 * Per farlo basta sapere due cose per ogni tipo di settimana: che cosa
 * succede in ciascuno dei sette giorni, e in quale giorno il lavoro della
 * settimana va messo a bilancio. Tutto il resto è presentazione.
 */

export const DAYS_IN_WEEK = 7;

/** La domenica: il giorno della gara. */
export const RACE_DAY = 6;

/** Il sabato: il giorno della qualifica. */
export const QUALIFYING_DAY = 5;

export const WEEKDAY_NAMES = [
  'lunedì', 'martedì', 'mercoledì', 'giovedì', 'venerdì', 'sabato', 'domenica',
] as const;

export const WEEKDAY_SHORT = ['Lun', 'Mar', 'Mer', 'Gio', 'Ven', 'Sab', 'Dom'] as const;

export type DayKind =
  | 'rest'        // niente
  | 'recovery'    // scarico attivo: la stanchezza scende
  | 'training'    // sessioni del piano
  | 'test'        // giornata di test invernali
  | 'minigame'    // la prova della settimana
  | 'travel'      // trasferta verso il circuito
  | 'practice'    // prove libere
  | 'qualifying'  // qualifica
  | 'race'        // gara
  | 'break';      // pausa estiva, fabbriche chiuse

export interface DayActivity {
  kind: DayKind;
  label: string;
  /**
   * Etichetta per la griglia mensile, dove una casella è larga meno di
   * settanta pixel. Non è il nome accorciato a caso: è il nome che regge in
   * undici caratteri, perché troncare con i puntini non informa nessuno.
   */
  short: string;
  /** categorie allenate, solo per le giornate di allenamento */
  categories?: TrainingCategory[];
}

/**
 * In che giorni cade l'allenamento, in ordine di preferenza.
 *
 * Il martedì per primo — dopo la gara si recupera — poi il giovedì, così due
 * sessioni non finiscono attaccate. Con una sola sessione a settimana la
 * scelta del giorno conta: mettere l'unico allenamento di un weekend di gara
 * di venerdì significherebbe farlo mentre si è già in pista.
 */
const PREFERRED_DAYS = [1, 3, 2, 4, 0] as const;

/** Le giornate di allenamento di una settimana che concede `capacity` sessioni. */
export function trainingDays(capacity: number): number[] {
  return PREFERRED_DAYS.slice(0, Math.max(0, capacity)).sort((a, b) => a - b);
}

/**
 * Il giorno in cui il lavoro della settimana viene messo a bilancio.
 *
 * È l'ultima giornata di allenamento: avanzando giorno per giorno gli
 * attributi si muovono quando il blocco di lavoro finisce, non il lunedì. In
 * una settimana senza allenamento è il lunedì, perché il recupero va comunque
 * applicato una volta.
 */
export function commitDay(capacity: number): number {
  const days = trainingDays(capacity);
  return days[days.length - 1] ?? 0;
}

/** Il giorno della prova della settimana, se la settimana ne concede una. */
export function minigameDay(capacity: number): number | null {
  return capacity > 0 ? trainingDays(capacity)[0]! : null;
}

/**
 * Distribuisce le sessioni del piano sulle giornate di allenamento.
 *
 * A turno e non a blocchi: così ogni giornata mescola categorie diverse,
 * invece di avere tre giorni di simulatore e uno di media. È anche più
 * onesto — un pilota non passa il martedì intero a fare interviste.
 */
export function sessionsByDay(plan: TrainingPlan, capacity: number): TrainingCategory[][] {
  const days = trainingDays(capacity);
  const out: TrainingCategory[][] = Array.from({ length: DAYS_IN_WEEK }, () => []);
  if (days.length === 0) return out;

  const queue: TrainingCategory[] = [];
  for (const c of TRAINING_CATEGORIES) for (let i = 0; i < plan[c]; i++) queue.push(c);

  queue.forEach((category, i) => {
    out[days[i % days.length]!]!.push(category);
  });
  return out;
}

const CATEGORY_NAME: Record<TrainingCategory, string> = {
  simulator: 'Simulatore',
  fitness: 'Preparazione',
  engineering: 'Ingegneria',
  media: 'Media',
};

const CATEGORY_SHORT: Record<TrainingCategory, string> = {
  simulator: 'Simul.',
  fitness: 'Fisico',
  engineering: 'Tecnica',
  media: 'Media',
};

/** Il nome da stampare su una giornata di allenamento. */
export function trainingLabel(categories: readonly TrainingCategory[], short = false): string {
  const names = short ? CATEGORY_SHORT : CATEGORY_NAME;
  if (categories.length === 0) return short ? 'Libero' : 'Allenamento';
  const unique = [...new Set(categories)];
  if (unique.length === 1) return names[unique[0]!];
  return short ? 'Misto' : `${names[unique[0]!]} +${unique.length - 1}`;
}

/**
 * Le attività dei sette giorni di una settimana.
 *
 * Prende la settimana e non solo il suo tipo perché la capienza è una
 * proprietà della settimana: due settimane di pausa estiva hanno lo stesso
 * `kind` e una sola delle due porta allenamento.
 *
 * `plan` serve a dare un nome alle giornate di allenamento: senza, le caselle
 * direbbero tutte "Allenamento" e il calendario non aiuterebbe a pianificare,
 * che è il motivo per cui esiste.
 */
export function weekActivities(week: SeasonWeek, plan: TrainingPlan | null): DayActivity[][] {
  const { kind, training } = week;
  const hasRace = week.trackId !== null;
  const days: DayActivity[][] = Array.from({ length: DAYS_IN_WEEK }, () => []);
  const sessions = plan ? sessionsByDay(plan, training) : null;

  for (const d of trainingDays(training)) {
    const categories = sessions?.[d] ?? [];
    // Una giornata senza sessioni assegnate è riposo, non un allenamento vuoto.
    if (plan && categories.length === 0) {
      days[d]!.push({ kind: 'rest', label: 'Riposo', short: 'Riposo' });
      continue;
    }
    days[d]!.push({
      kind: kind === 'testing' ? 'test' : 'training',
      label: kind === 'testing' ? 'Test' : trainingLabel(categories),
      short: kind === 'testing' ? 'Test' : trainingLabel(categories, true),
      categories,
    });
  }

  const game = minigameDay(training);
  if (game !== null && plan) {
    days[game]!.push({ kind: 'minigame', label: 'Prova della settimana', short: 'Prova' });
  }

  if (kind === 'summerBreak' || kind === 'postseason') {
    const label = kind === 'summerBreak' ? 'Pausa estiva' : 'Fine stagione';
    const short = kind === 'summerBreak' ? 'Pausa' : 'Riposo';
    for (let d = 0; d < DAYS_IN_WEEK; d++) {
      if (days[d]!.length === 0) days[d]!.push({ kind: 'break', label, short });
    }
    days[6]!.push({ kind: 'recovery', label: 'Recupero', short: 'Recupero' });
    return days;
  }

  if (hasRace) {
    days[0]!.push({ kind: 'recovery', label: 'Recupero', short: 'Recupero' });
    days[3]!.push({ kind: 'travel', label: 'Trasferta', short: 'Volo' });
    days[4]!.push({ kind: 'practice', label: 'Prove libere', short: 'Libere' });
    days[5]!.push({ kind: 'qualifying', label: 'Qualifica', short: 'Qualif.' });
    days[6]!.push({ kind: 'race', label: 'Gara', short: 'Gara' });
  } else if (kind === 'testing') {
    days[0]!.push({ kind: 'travel', label: 'Trasferta', short: 'Volo' });
  }

  // Tutto quello che resta vuoto è riposo: nessuna casella muta.
  for (let d = 0; d < DAYS_IN_WEEK; d++) {
    if (days[d]!.length > 0) continue;
    days[d]!.push(d === 6
      ? { kind: 'recovery', label: 'Recupero', short: 'Recupero' }
      : { kind: 'rest', label: 'Riposo', short: 'Riposo' });
  }

  return days;
}
