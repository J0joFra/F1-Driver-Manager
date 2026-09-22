import type { AttributeKey, Driver, MinigameKind, TrainingCategory, TrainingPlan } from './types.js';
import { commitTraining, previewTraining, recover } from './progression.js';
import { physioQuality } from './staff.js';
import { clamp } from './curves.js';

/**
 * La settimana del pilota.
 *
 * Sessioni da distribuire su quattro categorie, con un tetto per categoria:
 * con 10 sessioni e un massimo di 4 sei costretto a toccarne almeno tre, e la
 * scelta resta viva invece di collassare sempre sullo stesso ottimo.
 */

export const MAX_PER_CATEGORY = 4;

export const TRAINING_CATEGORIES: readonly TrainingCategory[] = [
  'simulator', 'fitness', 'engineering', 'media',
];

/** Quali attributi allena ogni categoria, e con che peso. */
export const CATEGORY_EFFECTS: Record<TrainingCategory, Partial<Record<AttributeKey, number>>> = {
  simulator:   { speed: 0.35, consistency: 0.30, technical: 0.20 },
  fitness:     { consistency: 0.35, composure: 0.20, starts: 0.15 },
  engineering: { technical: 0.50, tyres: 0.25, wet: 0.10 },
  media:       {},
};

/** Il minigioco è la conseguenza di dove hai investito, non una lotteria. */
export const CATEGORY_MINIGAME: Record<TrainingCategory, MinigameKind | null> = {
  simulator: 'thermal',
  fitness: 'reaction',
  engineering: 'sequence',
  media: null,
};

export interface TrainingLimits {
  total: number;
  perCategory: Record<TrainingCategory, number>;
}

/**
 * Quanto si può lavorare in una settimana.
 *
 * Il monte dipende dal carattere della settimana — sei sessioni in un weekend
 * di gara, dodici durante i test invernali, zero nella pausa estiva — e lo
 * staff alza i tetti. Un ingaggio che cambia una regola vale più di uno che
 * cambia un numero.
 */
export function trainingLimits(d: Driver, base: number): TrainingLimits {
  const hasCoach = d.staff.some((s) => s.role === 'coach');
  const hasTrainer = d.staff.some((s) => s.role === 'trainer');
  const perCategory = Math.min(MAX_PER_CATEGORY, base);
  return {
    total: base > 0 ? base + (hasTrainer ? 1 : 0) : 0,
    perCategory: {
      simulator: perCategory + (hasCoach && base > 0 ? 1 : 0),
      fitness: perCategory,
      engineering: perCategory,
      media: perCategory,
    },
  };
}

/**
 * Riporta un piano dentro i limiti della settimana.
 *
 * Serve perché il piano del giocatore sopravvive da una settimana all'altra,
 * e le settimane non hanno la stessa capienza: un piano da due sessioni
 * arriva intatto al weekend di gara, che ne concede una. Senza questo,
 * avanzare di un giorno lancerebbe un'eccezione e la schermata resterebbe
 * nera — l'ho già visto succedere una volta.
 */
export function clampPlan(plan: TrainingPlan, limits: TrainingLimits): TrainingPlan {
  const out = emptyPlan();
  let left = limits.total;
  for (const c of TRAINING_CATEGORIES) {
    const take = Math.max(0, Math.min(plan[c], limits.perCategory[c], left));
    out[c] = take;
    left -= take;
  }
  return out;
}

export function emptyPlan(): TrainingPlan {
  return { simulator: 0, fitness: 0, engineering: 0, media: 0 };
}

export function planTotal(plan: TrainingPlan): number {
  return plan.simulator + plan.fitness + plan.engineering + plan.media;
}

/** Restituisce l'elenco dei problemi; vuoto se il piano è valido. */
export function validatePlan(plan: TrainingPlan, limits: TrainingLimits): string[] {
  const errs: string[] = [];
  for (const c of TRAINING_CATEGORIES) {
    if (plan[c] < 0) errs.push(`${c}: le sessioni non possono essere negative`);
    if (plan[c] > limits.perCategory[c]) {
      errs.push(`${c}: massimo ${limits.perCategory[c]} sessioni`);
    }
  }
  if (planTotal(plan) > limits.total) {
    errs.push(`totale: massimo ${limits.total} sessioni questa settimana`);
  }
  return errs;
}

/**
 * Sceglie il minigioco della settimana: quello della categoria più investita.
 * Se coincide con quello della settimana scorsa passa alla seconda, così il
 * divieto di ripetizione spinge anche a ruotare l'allenamento.
 */
export function pickMinigame(plan: TrainingPlan, last: MinigameKind | null): MinigameKind | null {
  const ranked = TRAINING_CATEGORIES
    .filter((c) => plan[c] > 0 && CATEGORY_MINIGAME[c] !== null)
    .sort((a, b) => plan[b] - plan[a]);
  for (const c of ranked) {
    const game = CATEGORY_MINIGAME[c];
    if (game && game !== last) return game;
  }
  return null;
}

/** Una prestazione 0–1 nel minigioco vale un moltiplicatore fra 0.85× e 1.30×. */
export const MINIGAME_MIN = 0.85;
export const MINIGAME_MAX = 1.30;
export const MINIGAME_AUTO = 0.95;

export function minigameMultiplier(score: number): number {
  return MINIGAME_MIN + clamp(score, 0, 1) * (MINIGAME_MAX - MINIGAME_MIN);
}

export interface TrainingOutcome {
  gains: Partial<Record<AttributeKey, number>>;
  reputationGain: number;
  fatigueGain: number;
  load: number;
}

/**
 * Applica una settimana di allenamento.
 *
 * Il calcolo vive in `progression.ts`; qui restano i vincoli della settimana
 * — i tetti per categoria — e il ponte verso il resto del motore. Anteprima e
 * applicazione passano dalla stessa funzione, così quello che il giocatore
 * legge è esattamente quello che succede.
 */
export function applyTraining(
  d: Driver,
  plan: TrainingPlan,
  minigameMult = MINIGAME_AUTO,
  capacity = 0,
  efficiency?: number,
): TrainingOutcome {
  const limits = trainingLimits(d, capacity);
  const preview = previewTraining(
    d, plan, limits.perCategory, limits.total, minigameMult, 1, efficiency,
  );
  commitTraining(d, preview);
  recover(d, physioQuality(d));
  return {
    gains: preview.gains,
    reputationGain: preview.reputationGain,
    fatigueGain: preview.fatigueGain,
    load: preview.load,
  };
}

/**
 * Priorità di una settimana di allenamento, dalla più alla meno probabile.
 *
 * Con una sola sessione a settimana la prima voce non può essere sempre la
 * stessa: un pilota che allena il simulatore ventiquattro volte di fila non
 * tocca mai la freddezza né le partenze, e l'insieme dei suoi attributi si
 * squilibra. Queste quote dicono quanto spesso ogni categoria si prende la
 * sessione, e sono la ragione per cui un campionato di piloti IA resta
 * composto da piloti completi.
 */
const PRIORITY_SHARE = [0.4, 0.3, 0.2, 0.1] as const;

/** Piano usato dai piloti gestiti dal computer: equilibrato, con un po' di carattere. */
export function aiTrainingPlan(d: Driver, limits: TrainingLimits, bias: number): TrainingPlan {
  const plan = emptyPlan();
  let left = limits.total;
  // I giovani spingono sul simulatore, i veterani sul lavoro tecnico e sui media.
  const order: TrainingCategory[] = d.age < 25
    ? ['simulator', 'fitness', 'engineering', 'media']
    : ['engineering', 'simulator', 'media', 'fitness'];

  // Da dove parte il giro di questa settimana. Con dieci sessioni si finiva
  // per coprire tutto comunque; con una, il punto di partenza è la scelta.
  let start = 0;
  let roll = bias;
  for (let i = 0; i < PRIORITY_SHARE.length; i++) {
    if (roll < PRIORITY_SHARE[i]!) { start = i; break; }
    roll -= PRIORITY_SHARE[i]!;
    start = i + 1;
  }
  start = Math.min(start, order.length - 1);

  for (let i = 0; i < order.length && left > 0; i++) {
    const c = order[(start + i) % order.length]!;
    const take = Math.min(limits.perCategory[c], left);
    plan[c] = take;
    left -= take;
  }
  return plan;
}
