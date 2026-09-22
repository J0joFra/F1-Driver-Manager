/**
 * Curve e funzioni di forma.
 *
 * Tutto ciò che nel gioco cresce, cala o si decide a probabilità passa da qui:
 * tenere le curve in un posto solo è ciò che rende il bilanciamento leggibile
 * invece che sparso dentro venti formule.
 */

export function clamp(v: number, min: number, max: number): number {
  return v < min ? min : v > max ? max : v;
}

/** Sigmoide logistica: schiaccia qualunque punteggio in (0, 1). */
export function logistic(x: number): number {
  return 1 / (1 + Math.exp(-x));
}

/** Interpolazione lineare fra a e b. */
export function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * clamp(t, 0, 1);
}

/**
 * Difficoltà marginale della crescita.
 *
 * `gap` è quanto manca al proprio tetto, normalizzato: 1 = tutto da costruire,
 * 0 = già arrivato. L'esponente maggiore di 1 rende gli ultimi punti davvero
 * difficili — a gap 0.1 la crescita vale il 2.5% di quella di un principiante.
 *
 * Il fattore si applica **una volta sola**: moltiplicarlo ancora per `gap`
 * darebbe `gap^2.6`, che a un decimo dal tetto congela la crescita a un
 * quattrocentesimo e rende il potenziale di fatto irraggiungibile.
 */
export const MARGINAL_EXPONENT = 1.6;

export function marginalDifficulty(gap: number): number {
  return Math.pow(clamp(gap, 0, 1), MARGINAL_EXPONENT);
}

/**
 * Curva di crescita per età, asimmetrica attorno al picco dell'attributo.
 *
 * Prima del picco sale in fretta e poi rallenta; dopo decade dolcemente. Le
 * due metà si incontrano esattamente a 1 nel punto di picco: una formulazione
 * che arriva a 1.5 salendo e riparte da 1.0 scendendo farebbe perdere di colpo
 * un terzo della crescita nel giorno del compleanno.
 */
export const GROWTH_START_AGE = 16;

export function ageGrowthCurve(age: number, peakAge: number): number {
  if (age <= GROWTH_START_AGE) return 1;
  if (age <= peakAge) {
    const progress = (age - GROWTH_START_AGE) / Math.max(1, peakAge - GROWTH_START_AGE);
    // Parte alta e scende verso 1 al picco: i sedicenni imparano in fretta.
    return lerp(1.6, 1, Math.pow(progress, 0.7));
  }
  return Math.exp(-Math.pow((age - peakAge) / 6, 2));
}

/**
 * Rendimenti decrescenti su una somma di contributi.
 *
 * Tre professionisti eccellenti non valgono tre volte uno solo: senza questo,
 * l'unica strategia sensata sarebbe accumulare staff finché il budget regge.
 */
export function diminishing(total: number, strength = 0.6): number {
  return 1 + Math.log(Math.max(1, total)) * strength;
}
