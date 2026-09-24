import type { Track } from './types.js';
import { clamp } from './curves.js';

/**
 * Ritiri: errore del pilota e guasto della monoposto, contati separatamente.
 *
 * Tenerli distinti serve a raccontare la gara — "ti si è rotto il motore" non
 * è "hai sbagliato" — e a bilanciarli uno per uno: l'affidabilità è una leva
 * della scuderia, la costanza una del pilota.
 */

export interface IncidentInputs {
  consistency: number;
  /** 0–100: stanchezza accumulata */
  fatigue: number;
  /** 0–1: le gare nelle gambe */
  experience?: number;
  /** usura della gomma, 0–150 */
  tyreWear: number;
  /** 0 asciutto, 1 diluvio */
  wetness: number;
  /** guida sul bagnato del pilota */
  wetSkill: number;
  /** sta attaccando o è attaccato da vicino */
  underPressure: boolean;
  reliability: number;
}

/** Probabilità per giro di un errore che mette fuori gara. */
export function driverErrorChance(i: IncidentInputs): number {
  const base = 0.0016;
  // Una costanza bassa moltiplica il rischio; il denominatore ha un minimo
  // perché a costanza zero la divisione esploderebbe.
  const consistencyFactor = 60 / Math.max(20, i.consistency);
  const fatigueFactor = 1 + clamp(i.fatigue, 0, 100) / 100;
  // Chi ha centocinquanta gare nelle gambe sbaglia un terzo di meno.
  const rookieFactor = 1.35 - clamp(i.experience ?? 0, 0, 1) * 0.5;
  const tyreFactor = i.tyreWear > 80 ? 1.5 : 1;
  // Sul bagnato conta chi ci sa stare: un fenomeno sotto la pioggia rischia
  // quasi come all'asciutto, un pilota mediocre il doppio.
  const wetFactor = 1 + i.wetness * (2.4 - clamp(i.wetSkill, 0, 100) / 100 * 1.4);
  const pressureFactor = i.underPressure ? 1.3 : 1;

  return base * consistencyFactor * fatigueFactor * tyreFactor * wetFactor
    * pressureFactor * rookieFactor;
}

/** Probabilità per giro di un guasto. Non dipende dal pilota. */
export function mechanicalFailureChance(reliability: number): number {
  return 0.0009 * (60 / Math.max(25, reliability));
}

export function totalRetirementChance(i: IncidentInputs): number {
  return driverErrorChance(i) + mechanicalFailureChance(i.reliability);
}

/** Probabilità di safety car per giro, dalla probabilità dichiarata per gara. */
export function safetyCarChancePerLap(track: Track, wetness: number): number {
  const perRace = clamp(track.safetyCar * (1 + wetness * 0.6), 0, 0.95);
  return 1 - Math.pow(1 - perRace, 1 / Math.max(1, track.laps));
}
