/** Modello dati del mondo di gioco. Nessuna dipendenza da React o dal DOM. */

import type { SeasonWeek } from './calendar.js';

export type { SeasonWeek } from './calendar.js';

export type AttributeKey =
  | 'speed'        // velocità pura sul giro secco
  | 'consistency'  // costanza: quanto raramente sbagli
  | 'tyres'        // gestione gomme
  | 'starts'       // partenze da fermo
  | 'wet'          // guida sul bagnato
  | 'technical'    // feedback tecnico agli ingegneri
  | 'composure';   // sangue freddo sotto pressione

export type Attributes = Record<AttributeKey, number>;

export const ATTRIBUTE_KEYS: readonly AttributeKey[] = [
  'speed', 'consistency', 'tyres', 'starts', 'wet', 'technical', 'composure',
];

/**
 * Carattere di ogni attributo.
 *
 * `peakAge` è l'età in cui smette di crescere e comincia a calare; `physical`
 * dice se il calo lo tocca davvero. È questa distinzione che dà un senso ai
 * veterani: a 34 anni i riflessi se ne sono andati, ma il feedback tecnico e
 * il sangue freddo sono al massimo della carriera.
 */
export interface AttributeProfile {
  peakAge: number;
  physical: boolean;
  /** quanto cresce in fretta, a parità di tutto il resto */
  baseGain: number;
}

export const ATTRIBUTE_PROFILE: Record<AttributeKey, AttributeProfile> = {
  speed:       { peakAge: 26, physical: true,  baseGain: 2.6 },
  starts:      { peakAge: 25, physical: true,  baseGain: 2.2 },
  consistency: { peakAge: 30, physical: false, baseGain: 1.8 },
  wet:         { peakAge: 29, physical: false, baseGain: 1.5 },
  tyres:       { peakAge: 31, physical: false, baseGain: 1.4 },
  composure:   { peakAge: 32, physical: false, baseGain: 1.2 },
  technical:   { peakAge: 33, physical: false, baseGain: 1.1 },
};

export type Compound = 'S' | 'M' | 'H';
export type EngineMode = 'conserve' | 'normal' | 'push';

/** I quattro ruoli dello staff personale del pilota (Modalità Pilota). */
export type StaffRole = 'coach' | 'trainer' | 'physio' | 'agent';

export interface StaffMember {
  id: string;
  name: string;
  role: StaffRole;
  /** 1–99: qualità professionale */
  quality: number;
  /** costo annuo in euro; per l'agente è 0 e conta `salaryPct` */
  cost: number;
  /** solo per l'agente: percentuale trattenuta sull'ingaggio */
  salaryPct?: number;
  /** reputazione minima del pilota perché accetti */
  minReputation: number;
}

/** Le quattro categorie di allenamento settimanale. */
export type TrainingCategory = 'simulator' | 'fitness' | 'engineering' | 'media';

export type MinigameKind = 'thermal' | 'reaction' | 'sequence';

export interface TrainingPlan {
  simulator: number;
  fitness: number;
  engineering: number;
  media: number;
}

export interface SeasonTotals {
  year: number;
  teamId: string;
  points: number;
  wins: number;
  podiums: number;
  poles: number;
  dnf: number;
  starts: number;
  bestFinish: number;
  championshipPos: number;
}

export interface CareerTotals {
  starts: number;
  points: number;
  wins: number;
  podiums: number;
  poles: number;
  titles: number;
  bestFinish: number;
}

export interface Driver {
  id: string;
  name: string;
  nationality: string;
  age: number;
  /** valori correnti 1–99 */
  attrs: Attributes;
  /** tetto invalicabile per ogni attributo, fissato alla nascita del pilota */
  caps: Attributes;
  /** 0–100: apre contratti, sponsor e accesso allo staff migliore */
  reputation: number;
  /** 0–100: forma del momento */
  form: number;
  /** 0–100: morale */
  morale: number;
  /** 0–100: stanchezza accumulata. Sale con il carico, scende col riposo. */
  fatigue: number;
  /**
   * 0–1000: esperienza, cresce sempre e non cala mai. È ciò che compensa il
   * declino fisico e tiene competitivo un veterano.
   */
  experience: number;
  teamId: string | null;
  contractYears: number;
  /** ingaggio annuo lordo in euro */
  salary: number;
  /** liquidità accumulata in euro */
  money: number;
  staff: StaffMember[];
  retired: boolean;
  isPlayer: boolean;
  /** aggregati per sempre: ~200 byte a stagione */
  history: SeasonTotals[];
  career: CareerTotals;
}

export interface CarRating {
  aero: number;
  engine: number;
  chassis: number;
  reliability: number;
}

export interface Team {
  id: string;
  name: string;
  short: string;
  colour: string;
  car: CarRating;
  /** budget cap annuo in euro */
  budget: number;
  /** 0–100: attrattiva sul mercato piloti */
  prestige: number;
  /** qualità dello staff tecnico della scuderia */
  crew: { technical: number; trackEngineer: number; pitCrew: number };
  driverIds: string[];
  /** quota di budget dedicata all'anno successivo (0–1) */
  futureFocus: number;
}

/** Macro-area geografica: decide l'ordine delle tappe nel calendario. */
export type Region = 'oceania' | 'asia' | 'middleEast' | 'europe' | 'americas';

export interface Track {
  id: string;
  name: string;
  region: Region;
  /** tempo sul giro di riferimento in secondi per una macchina da 100 */
  baseLap: number;
  laps: number;
  /** 0.6 = sorpassi facili, 0.25 = quasi impossibili */
  overtaking: number;
  /** moltiplicatore di degrado gomme */
  tyreWear: number;
  /** probabilità di safety car per gara */
  safetyCar: number;
  /** probabilità di pioggia */
  rain: number;
  /** temperatura media dell'asfalto in °C: decide la finestra termica */
  trackTemp: number;
  /** ora di partenza locale, 0–23 */
  localStart: number;
  /** fuso del circuito rispetto a UTC, in ore */
  utcOffset: number;
}

export interface RaceResult {
  driverId: string;
  position: number;
  grid: number;
  points: number;
  dnf: boolean;
  /** secondi dal vincitore; null se ritirato */
  gap: number | null;
  stops: number;
  fastestLap: boolean;
}

export interface QualifyingResult {
  driverId: string;
  position: number;
  lapTime: number;
}

export interface WeekendResult {
  trackId: string;
  round: number;
  qualifying: QualifyingResult[];
  race: RaceResult[];
  wet: boolean;
  safetyCars: number;
}

export interface Regulations {
  /** anno in cui il regolamento tecnico è stato azzerato l'ultima volta */
  lastResetYear: number;
  /** anno del prossimo azzeramento */
  nextResetYear: number;
}

/** Un'offerta di contratto rivolta al giocatore a fine stagione. */
export interface ContractOffer {
  teamId: string;
  years: number;
  /** ingaggio annuo lordo in euro */
  salary: number;
  role: 'prima' | 'seconda';
  /** 0–100: quanto la scuderia ti vuole */
  interest: number;
}

/** Chi è il giocatore. Lo stesso mondo regge entrambe le modalità. */
export type Seat =
  | { mode: 'pilota'; driverId: string }
  | { mode: 'scuderia'; teamId: string }
  | { mode: 'osservatore' };

export interface World {
  seed: number;
  year: number;
  /** settimana corrente della stagione, 0-based (una stagione dura SEASON_WEEKS) */
  week: number;
  /** giorno della settimana corrente, 0 = lunedì */
  dayOfWeek: number;
  /** gare già corse quest'anno */
  round: number;
  drivers: Record<string, Driver>;
  teams: Record<string, Team>;
  /** il calendario dell'anno: una voce per settimana, con carattere e data */
  schedule: SeasonWeek[];
  regulations: Regulations;
  seat: Seat;
  /** talenti non ancora ingaggiati */
  academy: string[];
  /**
   * Livello a cui vengono generati i nuovi piloti. Non è una costante: si
   * corregge ogni anno in base a quanto la griglia si è allontanata dal
   * riferimento, così i record delle prime stagioni continuano a valere.
   */
  talentAnchor: number;
  /** classifica piloti della stagione in corso */
  standings: Record<string, number>;
  constructorStandings: Record<string, number>;
  results: WeekendResult[];
  /** minigioco assegnato la settimana scorsa: non può ripetersi */
  lastMinigame: MinigameKind | null;
  /**
   * Offerte in attesa di risposta dal giocatore. Finché ce ne sono, il suo
   * sedile resta vuoto e la stagione non può ripartire.
   */
  offers: ContractOffer[];
  /** albo d'oro: anno → id del campione */
  champions: { year: number; driverId: string; teamId: string }[];
}
