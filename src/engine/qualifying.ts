import type { Track } from './types.js';
import type { RaceEntry } from './race.js';
import { clamp, type Rng } from './rng.js';
import { driverInfluence } from './layout.js';

/**
 * La qualifica, come tre decisioni.
 *
 * Un giro secco non si guida a comandi: si prepara. Quello che un pilota
 * decide davvero è **quando uscire**, **su che gomma** e **come scaldarla**,
 * e poi il giro è la conseguenza di quelle tre scelte più il talento.
 *
 * Nessuna delle tre ha una risposta giusta: ognuna scambia decimi contro
 * rischio, e quanto rischio ti puoi permettere dipende da dove sei in
 * classifica e da quanto è difficile sorpassare su quel tracciato — su un
 * cittadino la pole vale una gara, su una pista di potenza molto meno.
 */

export type OutTiming = 'presto' | 'meta' | 'tardi';
export type QualCompound = 'S' | 'M';
export type OutLap = 'scarico' | 'standard' | 'spinto';

export interface QualifyingPlan {
  timing: OutTiming;
  compound: QualCompound;
  outLap: OutLap;
}

export const DEFAULT_PLAN: QualifyingPlan = {
  timing: 'meta', compound: 'S', outLap: 'standard',
};

export interface Choice<T> {
  value: T;
  label: string;
  /** cosa ci guadagni o ci perdi, in una riga */
  effect: string;
}

/**
 * Quando uscire.
 *
 * Più si aspetta più la pista è gommata e veloce, ma aumenta il rischio di
 * trovare traffico o una bandiera gialla che cancella il giro — ed è un
 * rischio che non dipende da te.
 */
export const TIMINGS: readonly Choice<OutTiming>[] = [
  { value: 'presto', label: 'Subito', effect: 'Pista libera, ma asfalto poco gommato' },
  { value: 'meta', label: 'A metà', effect: 'Nessun estremo' },
  { value: 'tardi', label: 'Ultimo momento', effect: 'Pista al massimo, ma traffico e bandiere' },
];

export const COMPOUNDS: readonly Choice<QualCompound>[] = [
  { value: 'S', label: 'Soft', effect: 'Più passo, ma una sola occasione buona' },
  { value: 'M', label: 'Medium', effect: 'Mezzo secondo in meno, molto più margine' },
];

/**
 * Il giro di lancio.
 *
 * Scaldare le gomme è metà del giro secco. Spingere nel lancio le porta nella
 * finestra giusta ma le consuma e stanca; andare piano le lascia fredde, e
 * una gomma fredda nel primo settore è un giro perso.
 */
export const OUT_LAPS: readonly Choice<OutLap>[] = [
  { value: 'scarico', label: 'Conservativo', effect: 'Gomme fredde, ma intatte per la gara' },
  { value: 'standard', label: 'Normale', effect: 'Preparazione da manuale' },
  { value: 'spinto', label: 'Spinto', effect: 'Gomme perfette, ma le paghi in gara' },
];

export interface QualifyingOutcome {
  /** secondi da aggiungere al giro: negativo è guadagno */
  delta: number;
  /** probabilità che il giro salti del tutto */
  risk: number;
  /** usura con cui si parte in gara, 0–100 */
  startWear: number;
  /** cosa è successo, da mostrare */
  note: string;
}

/**
 * L'effetto delle tre scelte su un giro secco.
 *
 * Gli attributi del pilota non spostano il giro qui — quello lo fa già il
 * modello di gara — ma decidono **quanto bene gli riesce ogni scelta**: la
 * sensibilità tecnica serve a scaldare le gomme, la freddezza a non buttare
 * il giro quando la pista è affollata.
 */
export function qualifyingOutcome(
  plan: QualifyingPlan, e: RaceEntry, track: Track, rng: Rng,
): QualifyingOutcome {
  let delta = 0;
  let risk = 0;
  let startWear = 0;

  // Quando esci: l'asfalto si gomma, ma l'ultimo momento è affollato.
  if (plan.timing === 'presto') delta += 0.22;
  if (plan.timing === 'tardi') {
    delta -= 0.34;
    // La freddezza serve a gestire il traffico, non a evitarlo.
    risk += clamp(0.26 - e.composure * 0.0018, 0.06, 0.26);
  } else if (plan.timing === 'meta') {
    risk += 0.05;
  } else {
    risk += 0.02;
  }

  // La mescola: la soft dà passo ma perdona poco.
  if (plan.compound === 'S') {
    delta -= 0.45;
    risk += clamp(0.14 - e.tyres * 0.0010, 0.03, 0.14);
    startWear += 6;
  } else {
    risk += 0.02;
    startWear += 2;
  }

  // Il giro di lancio: la temperatura è metà del giro secco.
  if (plan.outLap === 'spinto') {
    // Con la sensibilità giusta la gomma arriva nella finestra; senza, si cuoce.
    const skill = clamp((e.technical - 55) / 45, -0.6, 1);
    delta -= 0.18 + skill * 0.22;
    startWear += 12;
    risk += 0.04;
  } else if (plan.outLap === 'scarico') {
    delta += 0.30;
    startWear += 1;
  }

  // Su un tracciato guidato il pilota può recuperare di più con le sue scelte.
  delta *= driverInfluence(track.layout);

  // Il giro saltato: traffico, bandiera, o semplicemente un errore.
  /*
   * Quanto costa perdere il giro.
   *
   * Non è mai «hai buttato la qualifica»: il traffico ti toglie qualche
   * decimo, non la sessione. Tenerlo alto rendeva ogni scelta rischiosa un
   * affare in perdita — e l'IA con la macchina lenta, che è quella che deve
   * rischiare, ci rimetteva sempre: in quarant'anni il divario fra la prima
   * scuderia e le altre si allargava da solo.
   */
  const lost = rng.chance(clamp(risk, 0, 0.6));
  const note = lost
    ? plan.timing === 'tardi' ? 'Traffico nel terzo settore: giro compromesso'
      : plan.compound === 'S' ? 'Gomme oltre la finestra: giro compromesso'
      : 'Errore in staccata: giro compromesso'
    : plan.outLap === 'spinto' ? 'Gomme nella finestra perfetta'
      : plan.timing === 'tardi' ? 'Pista al massimo, giro pulito'
      : 'Giro pulito';

  return {
    delta: lost ? delta + rng.range(0.35, 0.9) : delta,
    risk,
    startWear,
    note,
  };
}

/**
 * Come sceglie un pilota gestito dal computer.
 *
 * Chi ha una macchina forte non ha motivo di rischiare: esce a metà sessione
 * e porta a casa il giro. Chi ha una macchina lenta deve provarci, perché una
 * fila guadagnata vale più del rischio di perderne una.
 */
export function aiQualifyingPlan(e: RaceEntry, rng: Rng): QualifyingPlan {
  const disperato = e.carPace < 72;
  const timing: OutTiming = disperato || rng.chance(0.25) ? 'tardi'
    : rng.chance(0.15) ? 'presto' : 'meta';
  const outLap: OutLap = disperato || e.technical > 70 ? 'spinto'
    : rng.chance(0.2) ? 'scarico' : 'standard';
  return { timing, compound: 'S', outLap };
}
