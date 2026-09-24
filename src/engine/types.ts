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
  /**
   * L'overall del pilota alla fine di quella stagione.
   *
   * Senza questa fotografia la crescita non è raccontabile: `history` sapeva
   * quanti punti aveva fatto, non quanto era diventato bravo. È la differenza
   * fra «sesto in campionato nel 2034» e «sesto in campionato nel 2034 perché
   * nel frattempo era passato da 71 a 76».
   */
  overall: number;
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
  /**
   * Gli attributi com'erano all'inizio di questa stagione.
   *
   * Serve a una cosa sola, e importante: far vedere la crescita mentre
   * succede. Un guadagno di due decimi a settimana è invisibile; la somma di
   * quaranta settimane no, ma solo se c'è un punto di partenza con cui
   * confrontarla.
   */
  seasonStartAttrs: Attributes;
  /** tetto invalicabile per ogni attributo, fissato alla nascita del pilota */
  caps: Attributes;
  /** punti abilità non ancora spesi */
  skillPoints: number;
  /** id dei nodi dell'albero già sbloccati */
  perks: string[];
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

/** I quattro reparti tecnici. Sono anche le voci della monoposto. */
export const CAR_KEYS = ['aero', 'engine', 'chassis', 'reliability'] as const;
export type CarKey = (typeof CAR_KEYS)[number];

export type ProjectSize = 'piccolo' | 'medio' | 'grande';

/** Un progetto di sviluppo in corso in un reparto. */
export interface Project {
  id: string;
  area: CarKey;
  size: ProjectSize;
  /** durata totale in settimane */
  weeks: number;
  /** settimane ancora da lavorare; un progetto senza fondi non scende */
  weeksLeft: number;
  /** costo totale in euro, distribuito sulle settimane */
  cost: number;
  /** quanto è già stato pagato: non torna indietro se si annulla */
  spent: number;
}

export interface Team {
  id: string;
  name: string;
  short: string;
  colour: string;
  car: CarRating;
  /** budget cap annuo in euro */
  budget: number;
  /**
   * Soldi in cassa, in euro.
   *
   * Il budget è quanto ti è **permesso** spendere in un anno; la cassa è
   * quanto hai davvero. La differenza non era mai contata perché non
   * serviva: lo sviluppo arrivava gratis a dicembre. Adesso che i progetti si
   * pagano a settimana, è la cassa a decidere quanti reparti puoi tenere al
   * lavoro — ed è il vincolo attorno a cui ruota tutto il gioco.
   */
  cash: number;
  /** 0–100: attrattiva sul mercato piloti */
  prestige: number;
  /** qualità dello staff tecnico della scuderia */
  crew: { technical: number; trackEngineer: number; pitCrew: number };
  driverIds: string[];
  /** progetti di sviluppo aperti, al massimo uno per reparto */
  projects: Project[];
  /** vero solo per la scuderia fondata dal giocatore */
  founded?: boolean;
}

/** Macro-area geografica: decide l'ordine delle tappe nel calendario. */
export type Region = 'oceania' | 'asia' | 'middleEast' | 'europe' | 'americas';

import type { SectorMix } from './layout.js';
import type { QualifyingPlan } from './qualifying.js';

export interface Track {
  id: string;
  name: string;
  region: Region;
  /** tempo sul giro di riferimento — derivato da lunghezza e forma */
  baseLap: number;
  /** lunghezza del giro in km, misurata sul tracciato reale */
  lengthKm: number;
  /** giri di gara — derivato: il più corto che superi i 305 km, max 78 */
  laps: number;
  /**
   * La forma del giro: quanta parte in rettilineo, curve lente, medie e
   * veloci. Le quattro frazioni sommano a uno, e da qui discendono il passo
   * della monoposto, quello del pilota, i sorpassi e il degrado.
   */
  layout: SectorMix;
  /**
   * Quanto è larga la pista: 0 è un canyon fra i muretti, 1 una pista moderna
   * dove ci stanno tre macchine affiancate. È un fatto del posto, non una
   * manopola di bilanciamento, ed è la ragione vera per cui su un cittadino
   * non si passa — non la velocità delle curve.
   */
  width: number;
  /** zone DRS: aiutano a passare, ma solo dove ci sono rettilinei */
  drsZones: number;
  /** 0.6 = sorpassi facili, 0.25 = quasi impossibili — derivato dalla forma */
  overtaking: number;
  /** moltiplicatore di degrado gomme — derivato dalla forma */
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
  /** ha finito senza usare due mescole: venticinque secondi di penalità */
  penalised?: boolean;
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
  /** cosa è successo nel giro, dalle tre decisioni */
  note?: string;
  /** usura con cui si parte in gara, lasciata dal giro di lancio */
  startWear?: number;
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

/**
 * Chi è il giocatore.
 *
 * Una modalità sola: si fonda una scuderia e la si porta avanti.
 * `osservatore` non è una modalità di gioco — è il mondo che gira senza
 * nessuno al comando, e serve al simulatore da riga di comando, che corre
 * quaranta stagioni per verificare che la griglia si regga da sola.
 *
 * C'era anche una Modalità Pilota, in cui si guidava una carriera invece di
 * una squadra. È stata tolta: due modalità significavano due interfacce e due
 * insiemi di decisioni sopra lo stesso motore, e nessuna delle due arrivava
 * in fondo.
 */
export type Seat =
  | { mode: 'scuderia'; teamId: string }
  | { mode: 'osservatore' };

export interface World {
  seed: number;
  year: number;
  /** settimana corrente della stagione, 0-based (una stagione dura SEASON_WEEKS) */
  week: number;
  /** giorno della settimana corrente, 0 = lunedì */
  dayOfWeek: number;
  /** le tre decisioni scelte dal giocatore per la qualifica di sabato */
  qualifyingPlan: QualifyingPlan | null;
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
  /** albo d'oro: anno → id del campione */
  champions: { year: number; driverId: string; teamId: string }[];
}
