import type { AttributeKey, Driver, MinigameKind, TrainingCategory, TrainingPlan } from './types.js';
import { ATTRIBUTE_KEYS } from './types.js';
import { clamp } from './rng.js';
import { ageGrowthFactor } from './driver.js';
import { staffGrowthMultiplier } from './staff.js';

/**
 * La settimana del pilota.
 *
 * Sessioni da distribuire su quattro categorie, con un tetto per categoria:
 * con 10 sessioni e un massimo di 4 sei costretto a toccarne almeno tre, e la
 * scelta resta viva invece di collassare sempre sullo stesso ottimo.
 */

export const SESSIONS_RACE_WEEK = 6;
export const SESSIONS_FREE_WEEK = 10;
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

/** Lo staff non regala punti: alza i tetti. Un ingaggio che cambia una regola vale più di uno che cambia un numero. */
export function trainingLimits(d: Driver, isRaceWeek: boolean): TrainingLimits {
  const hasCoach = d.staff.some((s) => s.role === 'coach');
  const hasTrainer = d.staff.some((s) => s.role === 'trainer');
  return {
    total: (isRaceWeek ? SESSIONS_RACE_WEEK : SESSIONS_FREE_WEEK) + (hasTrainer ? 2 : 0),
    perCategory: {
      simulator: MAX_PER_CATEGORY + (hasCoach ? 1 : 0),
      fitness: MAX_PER_CATEGORY,
      engineering: MAX_PER_CATEGORY,
      media: MAX_PER_CATEGORY,
    },
  };
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

const WEEK_GROWTH_BASE = 0.135;

export interface TrainingOutcome {
  gains: Partial<Record<AttributeKey, number>>;
  reputationGain: number;
  growthMultiplier: number;
}

/**
 * Applica una settimana di allenamento.
 *
 * La crescita è sempre frenata da `(cap - attuale)`: al proprio tetto si
 * azzera da sola, qualunque sia lo staff e qualunque sia il punteggio del
 * minigioco.
 */
export function applyTraining(
  d: Driver,
  plan: TrainingPlan,
  minigameMult = MINIGAME_AUTO,
): TrainingOutcome {
  const staffMult = staffGrowthMultiplier(d);
  const ageMult = ageGrowthFactor(d.age);
  const gains: Partial<Record<AttributeKey, number>> = {};

  for (const category of TRAINING_CATEGORIES) {
    const sessions = plan[category];
    if (sessions <= 0) continue;
    for (const [key, weight] of Object.entries(CATEGORY_EFFECTS[category]) as [AttributeKey, number][]) {
      const gap = d.caps[key] - d.attrs[key];
      if (gap <= 0) continue;
      const gapFactor = clamp(gap / 15, 0.12, 1);
      const delta = WEEK_GROWTH_BASE * weight * sessions * staffMult * ageMult * minigameMult * gapFactor;
      gains[key] = (gains[key] ?? 0) + delta;
    }
  }

  for (const k of ATTRIBUTE_KEYS) {
    const g = gains[k];
    if (g) d.attrs[k] = clamp(d.attrs[k] + g, 1, d.caps[k]);
  }

  const reputationGain = plan.media * 0.6 * (minigameMult / MINIGAME_AUTO);
  d.reputation = clamp(d.reputation + reputationGain, 0, 100);

  return { gains, reputationGain, growthMultiplier: staffMult * ageMult * minigameMult };
}

/** Piano usato dai piloti gestiti dal computer: equilibrato, con un po' di carattere. */
export function aiTrainingPlan(d: Driver, limits: TrainingLimits, bias: number): TrainingPlan {
  const plan = emptyPlan();
  let left = limits.total;
  // I giovani spingono sul simulatore, i veterani sul lavoro tecnico e sui media.
  const order: TrainingCategory[] = d.age < 25
    ? ['simulator', 'fitness', 'engineering', 'media']
    : ['engineering', 'simulator', 'media', 'fitness'];
  if (bias > 0.6) order.reverse();
  for (const c of order) {
    const take = Math.min(limits.perCategory[c], left, c === 'media' ? 2 : limits.perCategory[c]);
    plan[c] = take;
    left -= take;
    if (left <= 0) break;
  }
  return plan;
}
