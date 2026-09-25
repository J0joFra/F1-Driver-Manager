import type { World } from './types.js';
import { SEASON_WEEKS } from './calendar.js';
import { commitDay, DAYS_IN_WEEK, QUALIFYING_DAY, RACE_DAY } from './days.js';

/**
 * Quali giorni chiedono qualcosa, e quali si possono saltare.
 *
 * Una stagione dura 44 settimane e 308 giorni. Di quei giorni, quelli in cui
 * il giocatore ha davvero una decisione da prendere sono meno di cento: il
 * giorno in cui il lavoro della settimana va a bilancio, il sabato della
 * qualifica, la domenica della gara. Tutti gli altri erano un pulsante da
 * premere per far scorrere il calendario — un lavoro, non un gioco.
 *
 * Qui si calcola **quanti giorni saltare** per arrivare al prossimo che conta.
 * È una funzione pura sul mondo: il motore continua ad avanzare un giorno alla
 * volta, e resta identico a sé stesso: quello che cambia è quante volte lo
 * chiama l'interfaccia prima di fermarsi e chiedere.
 */

export type StopReason =
  | 'allenamento'
  | 'qualifica'
  | 'gara'
  | 'fine stagione';

export interface Stop {
  /** giorni da avanzare per arrivarci; 0 se ci siamo già sopra */
  days: number;
  reason: StopReason;
  /** la settimana in cui cade */
  week: number;
  dayOfWeek: number;
}

export const STOP_LABEL: Record<StopReason, string> = {
  allenamento: 'Lavoro della settimana',
  qualifica: 'Qualifica',
  gara: 'Gara',
  'fine stagione': 'Fine stagione',
};

/**
 * Le fermate di una settimana, in ordine.
 *
 * La consegna dei progetti non compare come voce a sé: i reparti consegnano
 * nello stesso giorno in cui il lavoro della settimana va a bilancio, quindi
 * quella fermata c'è già. Aggiungerne una seconda sullo stesso giorno
 * significherebbe fermarsi due volte nello stesso punto.
 */
function stopsInWeek(world: World, week: number): { day: number; reason: StopReason }[] {
  const schedule = world.schedule[week];
  if (!schedule) return [];

  const stops: { day: number; reason: StopReason }[] = [];

  // Il lavoro della settimana: solo se c'è qualcuno da allenare e la
  // settimana concede sessioni. In pausa estiva non c'è niente da decidere.
  const hasDrivers = world.seat.mode === 'scuderia'
    && (world.teams[world.seat.teamId]?.driverIds.length ?? 0) > 0;
  if (hasDrivers && schedule.training > 0) {
    stops.push({ day: commitDay(schedule.training), reason: 'allenamento' });
  }

  if (schedule.trackId) {
    stops.push({ day: QUALIFYING_DAY, reason: 'qualifica' });
    stops.push({ day: RACE_DAY, reason: 'gara' });
  }

  return stops.sort((a, b) => a.day - b.day);
}

/**
 * Il prossimo giorno che chiede qualcosa, a partire da dove siamo.
 *
 * `includeToday` decide se il giorno corrente conta come fermata. Serve
 * perché la stessa funzione risponde a due domande diverse: «cosa devo fare
 * oggi?» — e allora sì — e «dove mi porta il prossimo Avanza?», e allora no,
 * altrimenti il pulsante non muoverebbe il tempo di un giorno.
 */
export function nextStop(world: World, includeToday = false): Stop {
  const startWeek = world.week;
  const startDay = world.dayOfWeek;

  for (let week = startWeek; week < SEASON_WEEKS; week++) {
    for (const stop of stopsInWeek(world, week)) {
      const ahead = (week - startWeek) * DAYS_IN_WEEK + (stop.day - startDay);
      if (ahead < 0 || (ahead === 0 && !includeToday)) continue;
      return { days: ahead, reason: stop.reason, week, dayOfWeek: stop.day };
    }
  }

  // Niente più fermate: si va alla fine della stagione, che è una fermata
  // sempre — l'anno va chiuso a mano.
  const days = (SEASON_WEEKS - startWeek) * DAYS_IN_WEEK - startDay;
  return {
    days: Math.max(includeToday ? 0 : 1, days),
    reason: 'fine stagione',
    week: SEASON_WEEKS,
    dayOfWeek: 0,
  };
}

/** Cosa succede oggi, se succede qualcosa. */
export function todaysStop(world: World): StopReason | null {
  const stop = nextStop(world, true);
  return stop.days === 0 ? stop.reason : null;
}

/**
 * Quanti giorni mancano al prossimo weekend di gara.
 *
 * Il pulsante «Al weekend» resta utile anche ora che Avanza salta da solo:
 * salta **anche** le fermate di allenamento, per chi vuole solo arrivare a
 * correre e lascia il lavoro della settimana al piano che c'è già.
 */
export function daysToWeekend(world: World): number {
  for (let week = world.week; week < SEASON_WEEKS; week++) {
    if (!world.schedule[week]?.trackId) continue;
    const ahead = (week - world.week) * DAYS_IN_WEEK + (QUALIFYING_DAY - world.dayOfWeek);
    if (ahead > 0) return ahead;
  }
  return Math.max(1, (SEASON_WEEKS - world.week) * DAYS_IN_WEEK - world.dayOfWeek);
}
