import type { CarKey, Team, World } from './types.js';
import { CAR_KEYS } from './types.js';
import { clamp } from './rng.js';
import { DEV_BAND, tierCeiling, tierFloor } from './tiers.js';

/**
 * Il campionato in tre fasi.
 *
 * ## Perché spezzare l'anno
 *
 * Una stagione di ventiquattro gare è lunga, e per ventiquattro gare non
 * succedeva niente al di fuori delle gare stesse: i progetti maturavano con i
 * loro tempi e il resto era attesa. Spezzandola in tre blocchi, due volte
 * l'anno il campionato si ferma e chiede conto — hai portato punti? — e paga
 * in sviluppo quello che hai portato.
 *
 * Sono tre fasi e non quattro perché i confini devono essere pochi: un premio
 * che arriva di continuo smette di essere un momento.
 *
 * ## Il rischio, dichiarato
 *
 * Un bonus proporzionale ai risultati spinge **nella direzione opposta**
 * all'handicap di `deliveredGain`, che esiste apposta perché la classifica di
 * partenza non sia la classifica per sempre. Se la curva fosse ripida, chi
 * vince svilupperebbe di più, vincerebbe di più e il campionato si
 * congelerebbe in tre stagioni.
 *
 * Per questo la curva è piatta: fra chi ha dominato la fase e chi non ha preso
 * un punto ci sono poco più di due volte, non venti. Il bonus è un
 * riconoscimento, non una leva — e `npm run check:phases` sorveglia che resti
 * tale.
 */

export const PHASE_COUNT = 3;

export const PHASE_LABEL = ['Prima fase', 'Seconda fase', 'Terza fase'];

/** Quante gare copre ogni fase, dato un calendario. */
export function phaseLength(races: number): number {
  return Math.max(1, Math.ceil(races / PHASE_COUNT));
}

/** In che fase cade una gara, 0-based. */
export function phaseOf(round: number, races: number): number {
  return clamp(Math.floor(round / phaseLength(races)), 0, PHASE_COUNT - 1);
}

/**
 * La fase che si è appena chiusa correndo questa gara, o `null`.
 *
 * `round` è il numero di gare già corse, quindi la fase si chiude quando
 * `round` diventa un multiplo della lunghezza. L'ultima non paga: a fine
 * stagione ci sono già i premi del campionato, e un bonus di sviluppo
 * consegnato a dicembre sarebbe un bonus per la macchina dell'anno dopo.
 */
export function phaseJustClosed(round: number, races: number): number | null {
  const len = phaseLength(races);
  if (round <= 0 || round % len !== 0) return null;
  const closed = round / len - 1;
  return closed >= 0 && closed < PHASE_COUNT - 1 ? closed : null;
}

/**
 * Quanti punti sviluppo vale una fase.
 *
 * La base la prendono tutti, perché una scuderia che non ha segnato un punto
 * ha comunque passato otto gare a imparare qualcosa sulla propria macchina — e
 * perché toglierle anche questo vorrebbe dire condannarla.
 */
export const PHASE_BONUS_BASE = 0.18;
export const PHASE_BONUS_PER_POINT = 0.0009;
export const PHASE_BONUS_CAP = 0.4;

export function phaseBonusFor(points: number): number {
  return clamp(PHASE_BONUS_BASE + points * PHASE_BONUS_PER_POINT, PHASE_BONUS_BASE, PHASE_BONUS_CAP);
}

/** Chiude la fase: accredita a tutti e azzera i contatori. */
export function closePhase(world: World): Record<string, number> {
  const credited: Record<string, number> = {};
  for (const team of Object.values(world.teams)) {
    const credit = phaseBonusFor(team.phasePoints);
    team.devCredit += credit;
    credited[team.id] = credit;
    team.phasePoints = 0;
  }
  return credited;
}

/**
 * Dove c'è ancora spazio per crescere, in punti, reparto per reparto.
 *
 * Serve a due cose: all'IA per non buttare il bonus, e alla schermata per
 * spegnere il pulsante di un reparto già in cima alla banda. Un credito speso
 * dove non c'è spazio è un credito perso, ed è giusto che si veda prima.
 */
export function roomFor(team: Team, area: CarKey): number {
  return Math.max(0, tierCeiling(team.tier, area) - team.car[area]);
}

export function totalRoom(team: Team): number {
  return CAR_KEYS.reduce((s, k) => s + roomFor(team, k), 0);
}

/** Spende parte del credito su un reparto. Restituisce quanto è stato speso davvero. */
export function spendCredit(team: Team, area: CarKey, amount: number): number {
  const spend = Math.min(amount, team.devCredit, roomFor(team, area));
  if (spend <= 0) return 0;
  team.car[area] = clamp(
    team.car[area] + spend,
    tierFloor(team.tier, area),
    tierCeiling(team.tier, area),
  );
  team.devCredit -= spend;
  return spend;
}

/**
 * Come spende il bonus una scuderia del computer.
 *
 * Sul reparto con più spazio, non su quello più debole in assoluto: dentro una
 * banda larga quattro punti «più debole» e «con più spazio» sono quasi sempre
 * lo stesso reparto, ma quando non lo sono è lo spazio a contare, perché un
 * credito versato su un reparto pieno evapora.
 */
export function aiSpendCredit(team: Team): void {
  let guard = CAR_KEYS.length * 2;
  while (team.devCredit > 0.01 && totalRoom(team) > 0.01 && guard-- > 0) {
    const area = [...CAR_KEYS].sort((a, b) => roomFor(team, b) - roomFor(team, a))[0]!;
    if (spendCredit(team, area, Math.min(team.devCredit, DEV_BAND)) <= 0) break;
  }
  // Quello che non entra da nessuna parte è perso: la banda è la banda.
  if (totalRoom(team) <= 0.01) team.devCredit = 0;
}
