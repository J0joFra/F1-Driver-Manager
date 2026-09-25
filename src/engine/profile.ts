import { emptyWallet, grant, startingWallet, type Wallet } from './wallet.js';

/**
 * Il profilo: quello che resta quando cambi carriera.
 *
 * Il salvataggio di una partita è `World` e finisce quando la abbandoni. Il
 * profilo no: tiene il portafoglio, i giorni di accesso, gli obiettivi
 * raggiunti e l'elenco degli slot. È l'account, nel senso in cui lo intendono
 * i gestionali sportivi — solo che qui sta tutto sul dispositivo, senza
 * registrazione e senza server.
 */

export const PROFILE_VERSION = 1;

/**
 * Quello che il profilo conta, e da cui dipendono gli obiettivi.
 *
 * Contatori cumulativi su tutte le carriere, non la fotografia di una sola:
 * un obiettivo che si azzera quando ricominci non è un obiettivo, è un
 * compito.
 */
export interface ProfileStats {
  seasons: number;
  racesEntered: number;
  wins: number;
  podiums: number;
  poles: number;
  titles: number;
  constructorTitles: number;
  projectsDelivered: number;
  driversSigned: number;
  /** miglior posizione costruttori mai ottenuta; 0 = nessuna stagione chiusa */
  bestConstructorPosition: number;
}

export function emptyStats(): ProfileStats {
  return {
    seasons: 0, racesEntered: 0, wins: 0, podiums: 0, poles: 0, titles: 0,
    constructorTitles: 0, projectsDelivered: 0, driversSigned: 0,
    bestConstructorPosition: 0,
  };
}

export interface DailyState {
  /** giorni consecutivi di accesso, 1–7 e poi riparte */
  streak: number;
  /** giorno dell'ultimo ritiro, in formato AAAA-MM-GG */
  lastClaim: string | null;
  /** quanti giorni in totale, solo per mostrarlo */
  totalDays: number;
}

export interface Profile {
  version: number;
  wallet: Wallet;
  daily: DailyState;
  stats: ProfileStats;
  /** id degli obiettivi già riscossi */
  claimed: string[];
  /** acquisti già accreditati, per non accreditarli due volte */
  purchases: string[];
  /** lingua scelta nel menu */
  language: string;
}

export function newProfile(): Profile {
  return {
    version: PROFILE_VERSION,
    wallet: startingWallet(),
    daily: { streak: 0, lastClaim: null, totalDays: 0 },
    stats: emptyStats(),
    claimed: [],
    purchases: [],
    language: 'it',
  };
}

/* ------------------------------------------------------------------ */
/* Ricompense giornaliere                                              */
/* ------------------------------------------------------------------ */

/**
 * Il ciclo di sette giorni.
 *
 * Sale, e il settimo vale quanto i primi quattro messi insieme: è la forma
 * che hanno tutti i calendari di accesso, e funziona perché la ricompensa che
 * conta è sempre quella che non hai ancora preso.
 *
 * Nessuno di questi premi è necessario per giocare. Sono un acceleratore, e
 * questo è il patto: chi apre il gioco ogni giorno va un po' più in fretta,
 * chi non lo fa arriva lo stesso — la sonda di bilanciamento misura proprio
 * quello, una scuderia che non spende un gettone.
 */
export const DAILY_CYCLE: readonly Partial<Wallet>[] = [
  { credits: 2_000_000 },
  { credits: 1_500_000, research: 1 },
  { credits: 4_000_000 },
  { skill: 1, research: 1 },
  { credits: 8_000_000 },
  { credits: 3_000_000, skill: 1 },
  { credits: 12_000_000, skill: 2, research: 2 },
];

export const CYCLE_LENGTH = DAILY_CYCLE.length;

/** La data di oggi come AAAA-MM-GG, nel fuso del dispositivo. */
export function today(now = new Date()): string {
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, '0');
  const d = String(now.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

/** Il giorno precedente a una data AAAA-MM-GG. */
function dayBefore(iso: string): string {
  const d = new Date(`${iso}T12:00:00`);
  d.setDate(d.getDate() - 1);
  return today(d);
}

/**
 * Quale casella del ciclo si può ritirare adesso, o `null` se si è già preso
 * il premio di oggi.
 *
 * È 0-based. La serie si spezza se salti un giorno: riparte dal primo premio,
 * non da dove eri. Sembra severo ed è il punto — una serie che non si può
 * perdere non è una serie.
 */
export function claimableDay(daily: DailyState, date = today()): number | null {
  if (daily.lastClaim === date) return null;
  const continues = daily.lastClaim === dayBefore(date);
  const streak = continues ? daily.streak : 0;
  return streak % CYCLE_LENGTH;
}

export interface DailyClaim {
  day: number;
  reward: Partial<Wallet>;
}

/** Ritira il premio di oggi. Restituisce `null` se era già stato preso. */
export function claimDaily(profile: Profile, date = today()): DailyClaim | null {
  const day = claimableDay(profile.daily, date);
  if (day === null) return null;

  const continues = profile.daily.lastClaim === dayBefore(date);
  profile.daily.streak = (continues ? profile.daily.streak : 0) + 1;
  profile.daily.lastClaim = date;
  profile.daily.totalDays += 1;

  const reward = DAILY_CYCLE[day]!;
  grant(profile.wallet, reward);
  return { day, reward };
}

/* ------------------------------------------------------------------ */
/* Obiettivi                                                           */
/* ------------------------------------------------------------------ */

/**
 * Un obiettivo.
 *
 * `metric` è il contatore del profilo che lo fa avanzare, `target` la soglia.
 * `playGamesId` è l'identificatore che gli corrisponde su Play Games Services,
 * ed è vuoto finché non lo si crea nella console di Google: il gioco funziona
 * senza, e chi pubblica lo riempie una volta sola.
 */
export interface Objective {
  id: string;
  name: string;
  hint: string;
  metric: keyof ProfileStats;
  target: number;
  reward: Partial<Wallet>;
  /** id dell'obiettivo corrispondente su Play Games, quando esiste */
  playGamesId?: string;
}

export const OBJECTIVES: readonly Objective[] = [
  { id: 'first-season', name: 'Primo anno', hint: 'Chiudi una stagione intera.',
    metric: 'seasons', target: 1, reward: { credits: 5_000_000, research: 1 } },
  { id: 'first-points', name: 'A punti', hint: 'Porta una monoposto sul podio.',
    metric: 'podiums', target: 1, reward: { credits: 6_000_000, skill: 1 } },
  { id: 'first-win', name: 'La prima vittoria', hint: 'Vinci un Gran Premio.',
    metric: 'wins', target: 1, reward: { credits: 10_000_000, skill: 2 } },
  { id: 'first-pole', name: 'Davanti a tutti', hint: 'Conquista una pole position.',
    metric: 'poles', target: 1, reward: { credits: 4_000_000, research: 1 } },
  { id: 'builder', name: 'Reparto avviato', hint: 'Porta a termine dieci progetti di sviluppo.',
    metric: 'projectsDelivered', target: 10, reward: { research: 4 } },
  { id: 'scout', name: 'Occhio da talent scout', hint: 'Ingaggia cinque piloti.',
    metric: 'driversSigned', target: 5, reward: { credits: 6_000_000, skill: 1 } },
  { id: 'veteran', name: 'Cinque stagioni', hint: 'Arriva alla quinta stagione.',
    metric: 'seasons', target: 5, reward: { credits: 15_000_000, skill: 2, research: 2 } },
  { id: 'century', name: 'Cento gare', hint: 'Schiera le tue monoposto in cento gran premi.',
    metric: 'racesEntered', target: 100, reward: { credits: 20_000_000, research: 3 } },
  { id: 'podium-team', name: 'Sul podio dei costruttori',
    hint: 'Chiudi una stagione fra le prime tre scuderie.',
    metric: 'bestConstructorPosition', target: 3, reward: { credits: 25_000_000, skill: 3 } },
  { id: 'champion', name: 'Campione del mondo', hint: 'Vinci il titolo piloti.',
    metric: 'titles', target: 1, reward: { credits: 40_000_000, skill: 5, research: 5 } },
  { id: 'constructor-champion', name: 'Titolo costruttori',
    hint: 'Vinci il campionato costruttori.',
    metric: 'constructorTitles', target: 1, reward: { credits: 50_000_000, skill: 5, research: 5 } },
];

/**
 * A che punto è un obiettivo, fra 0 e il bersaglio.
 *
 * `bestConstructorPosition` va al contrario di tutti gli altri — più è bassa
 * meglio è, e zero vuol dire «nessuna stagione chiusa». Senza questo caso a
 * parte, un giocatore che non ha ancora corso risulterebbe già primo.
 */
export function progressOf(stats: ProfileStats, objective: Objective): number {
  if (objective.metric === 'bestConstructorPosition') {
    const best = stats.bestConstructorPosition;
    if (best === 0) return 0;
    return best <= objective.target ? objective.target : 0;
  }
  return Math.min(stats[objective.metric], objective.target);
}

export function isComplete(stats: ProfileStats, objective: Objective): boolean {
  return progressOf(stats, objective) >= objective.target;
}

export function claimable(profile: Profile, objective: Objective): boolean {
  return isComplete(profile.stats, objective) && !profile.claimed.includes(objective.id);
}

/** Riscuote un obiettivo raggiunto. Restituisce false se non si poteva. */
export function claimObjective(profile: Profile, id: string): boolean {
  const objective = OBJECTIVES.find((o) => o.id === id);
  if (!objective || !claimable(profile, objective)) return false;
  grant(profile.wallet, objective.reward);
  profile.claimed.push(objective.id);
  return true;
}

/** Quanti obiettivi sono pronti da riscuotere: è il numero sul badge. */
export function pendingObjectives(profile: Profile): number {
  return OBJECTIVES.filter((o) => claimable(profile, o)).length;
}

/* ------------------------------------------------------------------ */
/* Migrazione                                                          */
/* ------------------------------------------------------------------ */

/**
 * Recupera un profilo scritto da una versione precedente.
 *
 * Vale più della migrazione del mondo: un mondo rotto costa una carriera, un
 * profilo rotto costa quello che il giocatore ha **pagato**. Nel dubbio si
 * tiene tutto quello che si riesce a leggere e si riempie il resto.
 */
export function migrateProfile(raw: unknown): Profile {
  if (!raw || typeof raw !== 'object') return newProfile();
  const p = raw as Partial<Profile> & Record<string, unknown>;
  const base = newProfile();

  const wallet = { ...emptyWallet() };
  if (p.wallet && typeof p.wallet === 'object') {
    for (const key of ['credits', 'skill', 'research'] as const) {
      const value = (p.wallet as unknown as Record<string, unknown>)[key];
      if (typeof value === 'number' && Number.isFinite(value)) {
        wallet[key] = Math.max(0, value);
      }
    }
  }

  return {
    version: PROFILE_VERSION,
    // Un profilo mai visto prima riceve la dotazione iniziale; uno che
    // esisteva già tiene quello che ha, anche se è zero.
    wallet: p.wallet ? wallet : base.wallet,
    daily: {
      streak: typeof p.daily?.streak === 'number' ? p.daily.streak : 0,
      lastClaim: typeof p.daily?.lastClaim === 'string' ? p.daily.lastClaim : null,
      totalDays: typeof p.daily?.totalDays === 'number' ? p.daily.totalDays : 0,
    },
    stats: { ...base.stats, ...(typeof p.stats === 'object' ? p.stats : {}) },
    claimed: Array.isArray(p.claimed) ? p.claimed.filter((x) => typeof x === 'string') : [],
    purchases: Array.isArray(p.purchases) ? p.purchases.filter((x) => typeof x === 'string') : [],
    language: typeof p.language === 'string' ? p.language : 'it',
  };
}
