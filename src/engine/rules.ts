/**
 * Le regole del campionato.
 *
 * Non formule di prestazione — quelle stanno in `race.ts` — ma i vincoli
 * scritti nel regolamento: quanto è lunga una gara, quanti punti dà un
 * arrivo, cosa devi aver fatto per essere classificato. Sono le regole che
 * un giocatore dà per scontate perché le conosce dalla televisione, e che
 * quindi si notano solo quando mancano.
 */

/** Distanza di gara: la più corta che superi i 305 km. */
export const RACE_DISTANCE_KM = 305;

/**
 * Tetto ai giri, che è anche la ragione per cui Monaco è più corta.
 *
 * Il regolamento non dice «a Monaco si corre meno»: dice che la gara non
 * supera un certo numero di giri. Su un tracciato da 3.3 km i 305 km
 * vorrebbero 91 giri, il tetto ne concede 78, e la gara viene 260 km. È
 * l'eccezione di Monaco, che qui non è un caso speciale ma la conseguenza
 * di una regola sola.
 */
export const MAX_RACE_LAPS = 78;

/** Quanti giri si corrono su un tracciato di questa lunghezza. */
export function raceLaps(lengthKm: number): number {
  return Math.min(MAX_RACE_LAPS, Math.ceil(RACE_DISTANCE_KM / Math.max(1, lengthKm)));
}

/** Punti ai primi dieci, più uno al giro più veloce se arriva nei dieci. */
export const POINTS = [25, 18, 15, 12, 10, 8, 6, 4, 2, 1];

/**
 * Due mescole diverse, su asciutto.
 *
 * È la regola che rende obbligatoria almeno una sosta, e quindi l'unica
 * ragione per cui esiste una strategia: senza, la gara migliore sarebbe
 * sempre partire con la gomma dura e non fermarsi mai.
 */
export const COMPOUND_RULE_PENALTY = 25;

export function breaksCompoundRule(compoundsUsed: readonly string[], wet: boolean): boolean {
  if (wet) return false;
  const dry = new Set(compoundsUsed.filter((c) => c === 'S' || c === 'M' || c === 'H'));
  return dry.size < 2;
}
