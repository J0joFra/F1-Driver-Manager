import type { Track } from './types.js';
import { clamp, logistic } from './curves.js';

/**
 * Sorpassi, a modello logistico.
 *
 * La formulazione additiva precedente poteva produrre probabilità negative o
 * maggiori di uno, e non c'era modo di dire "a Marabec nemmeno a due decimi si
 * passa" se non a forza di tarature a occhio. Una sigmoide sta sempre fra 0 e
 * 1 e ha coefficienti che si leggono uno per uno.
 */

/** Oltre questo distacco non si tenta nemmeno. */
export const ATTACK_RANGE = 0.8;
/** Entro questo distacco il DRS è disponibile. */
export const DRS_RANGE = 1.0;

export interface OvertakeInputs {
  /** distacco in secondi fra chi attacca e chi difende */
  gap: number;
  /** racecraft + riflessi di chi attacca, 0–200 */
  attackSkill: number;
  /** racecraft + costanza di chi difende, 0–200 */
  defenceSkill: number;
  /** quanto l'attaccante è più veloce sul giro, in secondi */
  paceDelta: number;
  /** usura di chi difende meno quella di chi attacca, in punti */
  tyreAdvantage: number;
  drs: boolean;
  /** il giocatore sta spingendo per passare */
  attacking: boolean;
}

/**
 * Probabilità di completare il sorpasso in un secondo di gara.
 *
 * I coefficienti si leggono così: il distacco pesa più di tutto, poi il passo,
 * poi la differenza di abilità; la difficoltà del circuito sottrae. La
 * costante negativa tiene basso il livello di fondo, altrimenti due vetture
 * appaiate si scambierebbero ogni secondo.
 */
export function overtakeChance(track: Track, i: OvertakeInputs): number {
  if (i.gap > ATTACK_RANGE || i.gap < 0) return 0;

  const proximity = 1 - i.gap / ATTACK_RANGE;
  const skillDelta = clamp((i.attackSkill - i.defenceSkill) / 200, -0.5, 0.5);
  const paceAdvantage = clamp(i.paceDelta, -1.5, 1.5);
  const tyreEdge = clamp(i.tyreAdvantage / 100, -0.5, 0.5);

  // `overtaking` è 0.22 (cittadino) – 0.62 (pista veloce): si converte in una
  // difficoltà, così il coefficiente resta negativo come gli altri malus.
  const difficulty = 1 - track.overtaking;

  const score =
    -3.2 +
    2.6 * proximity +
    1.9 * paceAdvantage +
    1.5 * skillDelta +
    1.1 * tyreEdge +
    (i.drs ? 0.55 : 0) +
    (i.attacking ? 0.75 : 0) -
    2.4 * difficulty;

  return logistic(score);
}
