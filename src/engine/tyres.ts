import type { Compound, Track } from './types.js';
import { clamp } from './curves.js';

/**
 * Le gomme.
 *
 * Il degrado non è una parabola: è piatto finché la gomma regge, poi cede, e
 * nell'ultimo terzo crolla. È quel crollo — il *cliff* — a rendere la scelta
 * di quando fermarsi una decisione invece di un calcolo.
 */

export interface TyreState {
  compound: Compound;
  /** 0–150: oltre 100 la gomma è finita e si continua per disperazione */
  wear: number;
  /** 0–100, finestra ottimale 60–80 */
  temperature: number;
  /** giri percorsi con questo treno */
  age: number;
}

/** Passo della mescola rispetto alla media, in secondi sul giro. */
export const COMPOUND_PACE: Record<Compound, number> = { S: -0.78, M: 0, H: 0.68 };
/** Velocità di degrado relativa. */
export const COMPOUND_WEAR: Record<Compound, number> = { S: 1.6, M: 1.0, H: 0.62 };
/** Temperatura a cui la mescola lavora meglio. */
export const COMPOUND_TEMP: Record<Compound, number> = { S: 74, M: 70, H: 66 };

export const TEMP_WINDOW = { min: 60, max: 80 } as const;

export function freshTyre(compound: Compound): TyreState {
  return { compound, wear: 0, temperature: COMPOUND_TEMP[compound], age: 0 };
}

/**
 * Penalità sul giro dovuta allo stato della gomma, in secondi.
 *
 * Tre fasi: lineare fino al 40% di usura, quadratica fino al 70%, poi il
 * cliff. Un pilota dolce sulle gomme ritarda tutte e tre.
 */
export function tyreLapPenalty(tyre: TyreState, tyreManagement: number, track: Track): number {
  const w = tyre.wear;
  let penalty: number;

  if (w < 40) {
    penalty = w * 0.015;
  } else if (w < 70) {
    const excess = w - 40;
    penalty = 0.6 + excess * 0.04 + excess * excess * 0.002;
  } else {
    const excess = w - 70;
    penalty = 2.0 + Math.pow(excess, 1.8) * 0.08;
  }

  // La gestione gomme attenua il degrado, non lo annulla.
  penalty *= 1 - clamp(tyreManagement, 0, 100) / 100 * 0.25;
  penalty *= track.tyreWear;

  return penalty + temperaturePenalty(tyre.temperature);
}

/** Fuori dalla finestra termica la gomma non lavora: troppo fredda scivola, troppo calda si consuma. */
export function temperaturePenalty(temperature: number): number {
  if (temperature < TEMP_WINDOW.min) return (TEMP_WINDOW.min - temperature) * 0.03;
  if (temperature > TEMP_WINDOW.max) return (temperature - TEMP_WINDOW.max) * 0.05;
  return 0;
}

/** Quanto degrada in un giro intero, prima di applicarlo alla frazione percorsa. */
export function wearPerLap(
  tyre: TyreState,
  tyreManagement: number,
  track: Track,
  pushFactor: number,
): number {
  const base = COMPOUND_WEAR[tyre.compound] * track.tyreWear * pushFactor * 1.9;
  // Un pilota dolce consuma meno, ma la differenza è contenuta: la gomma
  // resta la gomma, il pilota la amministra.
  const skill = 100 / (60 + clamp(tyreManagement, 0, 100) * 0.45);
  // Fuori finestra termica la gomma si rovina più in fretta.
  const thermal = tyre.temperature > TEMP_WINDOW.max ? 1.25 : 1;
  return base * skill * thermal;
}

/**
 * Evoluzione della temperatura lungo un giro.
 *
 * Tende all'equilibrio fra la mescola, quanto si spinge e la temperatura
 * dell'asfalto. È il gancio del minigioco "banda termica": lì il giocatore
 * pilota questa stessa variabile a mano.
 */
export function updateTemperature(
  tyre: TyreState,
  pushFactor: number,
  trackTemp: number,
  lapFraction: number,
): number {
  const target = COMPOUND_TEMP[tyre.compound] + (pushFactor - 1) * 22 + (trackTemp - 40) * 0.35;
  // Convergenza esponenziale: mezzo giro per dimezzare la distanza.
  const rate = 1 - Math.exp(-lapFraction * 1.4);
  return clamp(tyre.temperature + (target - tyre.temperature) * rate, 20, 120);
}
