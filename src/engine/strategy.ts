import type { Compound, Track } from './types.js';
import { compoundFor, compoundLife } from './race.js';

/**
 * La strategia con cui una vettura affronta la gara.
 *
 * Esiste per una ragione precisa: fino a ieri le monoposto del giocatore erano
 * le uniche del gruppo che non si fermavano mai da sole. Il motore chiamava ai
 * box tutte le altre venti; le tue due aspettavano che qualcuno premesse un
 * pulsante, e se nessuno lo premeva finivano la gara su un treno di gomme oltre
 * il crollo, quattordici secondi al giro più lente. Una gara guardata senza
 * toccare niente non deve essere una gara persa: deve essere la gara che il
 * muretto avrebbe corso al posto tuo.
 *
 * Perciò la strategia si sceglie **prima** del via, una per pilota, e da quel
 * momento le soste avvengono da sole. I comandi in gara non spariscono: chi
 * chiama il box a mano scavalca il piano, che è esattamente il motivo per cui
 * vale la pena guardarla invece di simularla.
 *
 * `stops` sono i giri in cui rientrare, `fit` la mescola da montare a ciascuna
 * sosta: hanno la stessa lunghezza, e `start` è la gomma del primo stint.
 */
export interface RaceStrategy {
  id: StrategyId;
  start: Compound;
  stops: number[];
  fit: Compound[];
}

export type StrategyId = 'conservativa' | 'equilibrata' | 'aggressiva';

/**
 * Le tre strategie, come numero di soste e lunghezza del primo stint.
 *
 * Non come mescole: quelle seguono. Il primo tentativo le scriveva a mano —
 * `['M','H']` per l'equilibrata — e il risultato era che su un tracciato a
 * basso degrado le tue due partivano su media mentre quattro decimi del gruppo
 * partivano su morbida, cioè otto decimi al giro in meno per tre giri: nella
 * misura le tue perdevano 1,25 posizioni al via invece di guadagnarne 0,89.
 * Una strategia predefinita non deve regalare posizioni alla partenza.
 *
 * Una strategia è quindi **quando ti fermi**; la gomma la sceglie
 * `compoundFor` sulla lunghezza dello stint — la più morbida che ci arriva
 * senza sfondare il crollo. Così la conservativa, che allunga il primo stint,
 * finisce da sola sulle mescole dure, e l'aggressiva, che lo accorcia, sulle
 * morbide: senza che nessuno scriva «dura» o «morbida» da nessuna parte, e
 * adattandosi a Monaco come a Spa.
 *
 * `share` è la quota di gara del primo stint; gli altri si dividono il resto in
 * parti uguali.
 */
const SHAPES: Record<StrategyId, { stints: number; share: number }> = {
  conservativa: { stints: 2, share: 0.62 },
  equilibrata: { stints: 2, share: 0.48 },
  aggressiva: { stints: 3, share: 0.3 },
};

export const STRATEGY_IDS: StrategyId[] = ['conservativa', 'equilibrata', 'aggressiva'];

/** La strategia che vale se il giocatore non tocca niente. */
export const DEFAULT_STRATEGY: StrategyId = 'equilibrata';

/**
 * Dove cadono le soste, e con che gomma si riparte.
 *
 * Due vincoli sui giri: nessuno stint sotto i tre giri, e ogni stint che deve
 * ancora venire ne ha almeno tre — una sosta al penultimo giro non è una
 * strategia, è un errore di calcolo.
 *
 * `compoundFor` fa anche rispettare la regola delle due mescole: nessuna delle
 * tre deve poter arrivare al traguardo con venticinque secondi di penalità che
 * il giocatore non aveva modo di prevedere.
 */
function build(track: Track, tyreSkill: number, id: StrategyId): RaceStrategy {
  const { stints, share } = SHAPES[id];
  const laps = track.laps;
  const stops: number[] = [];
  let done = 0;
  for (let i = 0; i < stints - 1; i++) {
    const len = Math.max(3, Math.round(i === 0 ? laps * share : (laps - done) / (stints - i)));
    done = Math.min(laps - 3 * (stints - 1 - i), done + len);
    stops.push(done);
  }

  const rubber = () => {
    const out: Compound[] = [];
    let from = 0;
    for (let i = 0; i <= stops.length; i++) {
      const to = stops[i] ?? laps;
      out.push(compoundFor(track, to - from, tyreSkill, out));
      from = to;
    }
    return out;
  };
  let compounds = rubber();

  // La regola delle due mescole, garantita e non sperata.
  //
  // `compoundFor` la fa rispettare solo quando la mescola che vorrebbe regge lo
  // stint. Sulle piste lunghe e abrasive non la regge nessuna: torna 'H' per
  // ogni stint e la strategia veniva 'H>H', cioè venticinque secondi di
  // penalità al traguardo che il giocatore non aveva modo di vedere arrivare.
  //
  // La risposta non è montare una morbida su uno stint che non la regge — su
  // settantotto giri a Vallmar sarebbero trentasette giri oltre il crollo —
  // ma aggiungere una sosta corta in coda, che è esattamente quello che fa un
  // muretto vero quando la regola non è ancora soddisfatta e la gara sta per
  // finire.
  if (new Set(compounds).size === 1) {
    const tail = Math.max(4, Math.min(
      Math.round(laps * 0.16),
      Math.round(compoundLife(track, 'M', tyreSkill)),
    ));
    const cut = laps - tail;
    if (cut >= (stops[stops.length - 1] ?? 0) + 3) {
      stops.push(cut);
      compounds = rubber();
    }
  }

  return { id, start: compounds[0]!, stops, fit: compounds.slice(1) };
}

export function strategyFor(track: Track, id: StrategyId, tyreSkill = 70): RaceStrategy {
  return build(track, tyreSkill, id);
}

export function strategiesFor(track: Track, tyreSkill = 70): RaceStrategy[] {
  return STRATEGY_IDS.map((id) => strategyFor(track, id, tyreSkill));
}
