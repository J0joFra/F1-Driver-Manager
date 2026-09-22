import type { AttributeKey, Driver, TrainingCategory, TrainingPlan } from './types.js';
import { ATTRIBUTE_KEYS, ATTRIBUTE_PROFILE } from './types.js';
import { ageGrowthCurve, clamp, marginalDifficulty } from './curves.js';
import { staffEfficiency } from './staff.js';
import { CATEGORY_EFFECTS, TRAINING_CATEGORIES } from './training.js';

/**
 * Crescita settimanale del pilota.
 *
 * La formula è un prodotto di fattori indipendenti, ognuno con un solo
 * compito: così il bilanciamento si fa spostando un numero alla volta invece
 * di indovinare dentro una formula unica.
 *
 *   crescita = baseGain(attributo)
 *            × difficoltàMarginale(quanto manca al tetto)
 *            × curvaEtà(età, picco dell'attributo)
 *            × efficienzaStaff
 *            × caricoAllenamento × penalitàSovrallenamento
 *            × penalitàStanchezza × fattoreMorale
 *            × moltiplicatoreMinigioco
 *            × rumore
 *
 * Il tetto non è un `if`: emerge da `difficoltàMarginale`, che a un decimo
 * dal potenziale vale già un quarantesimo.
 */

/**
 * Scala globale della crescita settimanale.
 *
 * Tarata sulla curva di carriera, non a occhio: un diciottenne con potenziale
 * 91 arriva a 81 da solo e a 87 con uno staff di livello, in entrambi i casi
 * attorno ai ventisette anni. Il tetto resta un asintoto — `marginalDifficulty`
 * rende gli ultimi punti proibitivi — e i sei punti di differenza sono ciò che
 * lo staff vale davvero.
 */
const WEEK_SCALE = 3;

export interface GrowthContext {
  /** 0–1: quanto della settimana è andato in questa categoria */
  load: number;
  /** 0–1: carico totale della settimana, per il sovrallenamento */
  totalLoad: number;
  staff: number;
  minigame: number;
  noise: number;
}

/** Oltre questa soglia allenare di più rende di meno. */
export const OVERTRAINING_THRESHOLD = 0.85;

export function overtrainingPenalty(totalLoad: number): number {
  return totalLoad > OVERTRAINING_THRESHOLD
    ? clamp(1 - (totalLoad - OVERTRAINING_THRESHOLD) * 2.5, 0.4, 1)
    : 1;
}

export function fatiguePenalty(fatigue: number): number {
  return 1 - clamp(fatigue, 0, 100) / 100 * 0.6;
}

export function moraleFactor(morale: number): number {
  return 0.75 + clamp(morale, 0, 100) / 100 * 0.5;
}

/** Crescita di un singolo attributo in una settimana. */
export function attributeGrowth(
  driver: Driver,
  attr: AttributeKey,
  ctx: GrowthContext,
): number {
  const profile = ATTRIBUTE_PROFILE[attr];
  const current = driver.attrs[attr];
  const cap = driver.caps[attr];
  if (current >= cap) return 0;

  const gap = clamp((cap - current) / Math.max(1, cap), 0, 1);

  return (
    WEEK_SCALE *
    profile.baseGain *
    marginalDifficulty(gap) *
    ageGrowthCurve(driver.age, profile.peakAge) *
    ctx.staff *
    ctx.load *
    overtrainingPenalty(ctx.totalLoad) *
    fatiguePenalty(driver.fatigue) *
    moraleFactor(driver.morale) *
    ctx.minigame *
    ctx.noise
  );
}

export interface TrainingPreview {
  gains: Partial<Record<AttributeKey, number>>;
  reputationGain: number;
  fatigueGain: number;
  /** carico totale della settimana, 0–1 */
  load: number;
}

/**
 * Calcola l'effetto di un piano **senza applicarlo**.
 *
 * L'interfaccia mostra questa anteprima; il motore applica esattamente lo
 * stesso risultato. Duplicare la formula nella schermata significava che una
 * modifica al bilanciamento non si vedeva più dove il giocatore la legge.
 */
export function previewTraining(
  driver: Driver,
  plan: TrainingPlan,
  capacity: Record<TrainingCategory, number>,
  totalCapacity: number,
  minigame: number,
  noise = 1,
  /** efficienza esterna: lo staff del giocatore, o l'entourage di un pilota IA */
  efficiency?: number,
): TrainingPreview {
  const totalSessions = TRAINING_CATEGORIES.reduce((s, c) => s + plan[c], 0);
  const totalLoad = totalCapacity > 0 ? totalSessions / totalCapacity : 0;
  const staff = efficiency ?? staffEfficiency(driver);
  const gains: Partial<Record<AttributeKey, number>> = {};

  for (const category of TRAINING_CATEGORIES) {
    const sessions = plan[category];
    if (sessions <= 0) continue;
    const max = capacity[category] || 1;
    const load = sessions / max;

    for (const [key, weight] of Object.entries(CATEGORY_EFFECTS[category]) as [AttributeKey, number][]) {
      const delta = attributeGrowth(driver, key, {
        load: load * weight * 2.2,
        totalLoad,
        staff,
        minigame,
        noise,
      });
      if (delta > 0) gains[key] = (gains[key] ?? 0) + delta;
    }
  }

  return {
    gains,
    reputationGain: plan.media * 0.6 * minigame,
    // Le settimane pesanti si pagano: la stanchezza è il freno naturale
    // all'ottimo "tutto al massimo, sempre".
    fatigueGain: totalLoad * 14 - 4,
    load: totalLoad,
  };
}

/** Applica al pilota il risultato dell'anteprima. */
export function commitTraining(driver: Driver, preview: TrainingPreview): void {
  for (const k of ATTRIBUTE_KEYS) {
    const g = preview.gains[k];
    if (g) driver.attrs[k] = clamp(driver.attrs[k] + g, 1, driver.caps[k]);
  }
  driver.reputation = clamp(driver.reputation + preview.reputationGain, 0, 100);
  driver.fatigue = clamp(driver.fatigue + preview.fatigueGain, 0, 100);
}

/** Riposo fra un impegno e l'altro. Il fisioterapista accorcia i tempi. */
export function recover(driver: Driver, physioQuality: number): void {
  const rate = 6 + (physioQuality / 100) * 6;
  driver.fatigue = clamp(driver.fatigue - rate, 0, 100);
}
