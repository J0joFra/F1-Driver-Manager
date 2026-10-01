import type { QualifyingResult, Track } from './types.js';
import type { RaceEntry } from './race.js';
import { CAR_PACE_PER_POINT } from './race.js';
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
/** morbida nuova, morbida già usata, media */
export type QualCompound = 'S' | 'Su' | 'M';
export type OutLap = 'scarico' | 'standard' | 'spinto';

/**
 * I treni di morbida che hai per tutta la sessione.
 *
 * È il numero che rende la mescola una decisione invece di una preferenza.
 * Prima la morbida era gratis: nessuno aveva motivo di scegliere altro, e
 * infatti la domanda «che gomma» aveva una risposta sola.
 *
 * Sono **due** per tre manche, e il due non è decorativo: con tre treni per tre
 * manche il vincolo non si sarebbe mai fatto sentire — si chiede la morbida
 * ogni volta e c'è sempre — e i treni finiti sarebbero stati una regola
 * scritta e mai applicata. Con due, una delle tre manche va fatta di media o
 * su una gomma rimontata, e l'unica domanda che conta diventa **quale**.
 */
export const SOFT_SETS = 2;

/** Quanta usura si porta dietro un treno di morbida rimontato. */
export const SOFT_REUSE_WEAR = 7;

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
  { value: 'tardi', label: 'Tardi', effect: 'Pista al massimo, ma traffico e bandiere' },
];

export const COMPOUNDS: readonly Choice<QualCompound>[] = [
  { value: 'S', label: 'Soft', effect: 'Il massimo passo, e un treno in meno' },
  { value: 'Su', label: 'Usata', effect: 'Due decimi in meno della nuova, e la paghi in gara' },
  { value: 'M', label: 'Medium', effect: 'Mezzo secondo in meno, ma non consuma niente' },
];

/**
 * Il giro di lancio.
 *
 * Scaldare le gomme è metà del giro secco. Spingere nel lancio le porta nella
 * finestra giusta ma le consuma e stanca; andare piano le lascia fredde, e
 * una gomma fredda nel primo settore è un giro perso.
 */
export const OUT_LAPS: readonly Choice<OutLap>[] = [
  { value: 'scarico', label: 'Piano', effect: 'Gomme fredde, ma intatte per la gara' },
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

  // La mescola: la soft dà passo ma perdona poco, e quella rimontata ne ha già
  // dato una parte a qualcun altro.
  if (plan.compound === 'S') {
    delta -= 0.45;
    risk += clamp(0.14 - e.tyres * 0.0010, 0.03, 0.14);
    startWear += 3;
  } else if (plan.compound === 'Su') {
    delta -= 0.22;
    risk += clamp(0.18 - e.tyres * 0.0010, 0.05, 0.18);
    startWear += 3 + SOFT_REUSE_WEAR;
  } else {
    risk += 0.02;
    startWear += 1;
  }

  // Il giro di lancio: la temperatura è metà del giro secco.
  if (plan.outLap === 'spinto') {
    // Con la sensibilità giusta la gomma arriva nella finestra; senza, si cuoce.
    const skill = clamp((e.technical - 55) / 45, -0.6, 1);
    delta -= 0.18 + skill * 0.22;
    startWear += 6;
    risk += 0.04;
  } else if (plan.outLap === 'scarico') {
    delta += 0.30;
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
      : plan.compound !== 'M' ? 'Gomme oltre la finestra: giro compromesso'
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
export function aiQualifyingPlan(
  e: RaceEntry, rng: Rng, pressure = 0.5, stock?: QualiDriverState,
): QualifyingPlan {
  // Chi ha la macchina forte non ha motivo di rischiare in Q1; chi è sul filo
  // del taglio sì, e in Q3 rischiano tutti perché non c'è più niente da
  // conservare. È `pressure` a dirlo.
  const osa = pressure > 0.7 || e.carPace < 72;
  const timing: OutTiming = osa || rng.chance(0.2 * pressure) ? 'tardi'
    : rng.chance(0.15) ? 'presto' : 'meta';
  const outLap: OutLap = osa || e.technical > 70 ? 'spinto'
    : rng.chance(0.2) ? 'scarico' : 'standard';
  // La soft si tiene per quando serve: in Q1 con la macchina buona basta la
  // media, e quando i treni nuovi sono finiti si rimonta un usato invece di
  // chiedere qualcosa che non c'è.
  const wants: QualCompound = pressure < 0.35 && e.carPace > 84 ? 'M' : 'S';
  return { timing, compound: affordable(wants, stock), outLap };
}

/**
 * La mescola che si può davvero montare.
 *
 * Il piano è un'intenzione: chi chiede una morbida nuova che non ha più
 * rimonta una usata, e chi non ha nemmeno quella va di media. Vale per l'IA e
 * per il giocatore, perché un'interfaccia che offre un treno inesistente è un
 * modo elegante di mentire.
 */
export function affordable(wanted: QualCompound, stock?: QualiDriverState): QualCompound {
  if (!stock) return wanted;
  if (wanted === 'S' && stock.softNew <= 0) return stock.softUsed > 0 ? 'Su' : 'M';
  if (wanted === 'Su' && stock.softUsed <= 0) return stock.softNew > 0 ? 'S' : 'M';
  return wanted;
}

/**
 * Le tre manche.
 *
 * Non è una formalità: cambia la natura della decisione. In Q1 basta
 * sopravvivere, e rischiare per due decimi che non servono a niente è
 * stupido; in Q3 i due decimi sono la pole. La stessa scelta ha un prezzo
 * diverso a seconda di quanto hai da perdere, ed è questo che rende la
 * qualifica una cosa da giocare invece che da guardare.
 *
 * Le gomme non si azzerano fra una manche e l'altra: chi passa il taglio con
 * il cuore in gola ci arriva in Q3 con un treno in meno e la gomma segnata.
 */
export interface Segment {
  key: 'Q1' | 'Q2' | 'Q3';
  /** quanti restano in pista dopo questa manche */
  survivors: number;
  /** cosa c'è in palio, per chi gioca */
  stake: string;
}

/**
 * Le manche, dimensionate sul gruppo che c'è davvero.
 *
 * Erano scritte a mano — quindici e dieci superstiti — che è giusto per i
 * ventidue della Formula 1 e sbagliato per qualunque altro numero. Qui la
 * griglia si svuota quando un pilota si ritira e nessuno prende il sedile, e
 * con diciotto iscritti un taglio a quindici avrebbe eliminato tre vetture in
 * Q1 e cinque in Q2: la manche più dura sarebbe stata la seconda.
 */
export function segmentsFor(field: number): Segment[] {
  const q1 = Math.max(2, Math.round(field * 0.75));
  const q2 = Math.max(1, Math.round(field * 0.5));
  return [
    { key: 'Q1', survivors: q1, stake: `Passa il taglio: gli ultimi ${field - q1} sono fuori` },
    { key: 'Q2', survivors: q2, stake: `Entra nei primi ${q2}` },
    { key: 'Q3', survivors: 0, stake: 'La pole' },
  ];
}

/**
 * Quanto è avventato rischiare, in questa manche e con questa macchina.
 *
 * Serve all'IA e alla schermata: un pilota al sicuro in Q1 non ha motivo di
 * uscire all'ultimo momento, uno sul filo del taglio sì.
 */
export function pressureOf(segment: Segment, rank: number, field: number): number {
  if (segment.key === 'Q3') return 1;
  const margin = (segment.survivors - rank) / Math.max(1, field);
  // Chi è appena sopra il taglio ha tutto da perdere e quindi tutto da osare.
  return clamp(1 - margin * 3, 0.15, 1);
}

/* ────────────────────────────────────────────────────────────────────────────
 * La sessione: tre manche, non un conto solo
 * ──────────────────────────────────────────────────────────────────────────── */

/**
 * Lo stato di un pilota dentro la sessione.
 *
 * I treni non si azzerano fra una manche e l'altra, ed è tutto il punto: chi
 * passa il taglio col cuore in gola ci arriva in Q3 con un treno in meno e la
 * gomma segnata.
 */
export interface QualiDriverState {
  /** treni di morbida nuova ancora disponibili */
  softNew: number;
  /** treni di morbida già usati, rimontabili */
  softUsed: number;
  /** il tempo della manche appena corsa, null se non ha girato */
  lap: number | null;
  /** cosa è successo nell'ultimo giro */
  note: string | null;
  /** la mescola dell'ultimo giro */
  compound: QualCompound | null;
  /**
   * L'usura del treno con cui finisce la qualifica, che è quello con cui parte
   * la gara. Non è la somma di tutta la sessione: si parte sul set dell'ultimo
   * tentativo, non su tutti insieme.
   */
  startWear: number;
}

export interface QualiSession {
  track: Track;
  entries: readonly RaceEntry[];
  wet: boolean;
  rng: Rng;
  /** le monoposto che decide il giocatore */
  playerIds: readonly string[];
  segments: readonly Segment[];
  /** 0 = Q1. Quando arriva a `segments.length` la sessione è finita */
  segment: number;
  /** chi è ancora in gioco, ordinato per il tempo dell'ultima manche */
  alive: string[];
  /** chi è già fuori, nell'ordine in cui andrà in griglia */
  tail: string[];
  state: Record<string, QualiDriverState>;
}

export function beginQualifying(
  track: Track,
  entries: readonly RaceEntry[],
  rng: Rng,
  wet = false,
  playerIds: readonly string[] = [],
): QualiSession {
  const state: Record<string, QualiDriverState> = {};
  for (const e of entries) {
    state[e.driverId] = {
      softNew: SOFT_SETS, softUsed: 0, lap: null, note: null, compound: null, startWear: 0,
    };
  }
  return {
    track, entries, wet, rng, playerIds,
    segments: segmentsFor(entries.length),
    segment: 0,
    alive: entries.map((e) => e.driverId),
    tail: [],
    state,
  };
}

export function currentSegment(s: QualiSession): Segment | null {
  return s.segments[s.segment] ?? null;
}

export function isOver(s: QualiSession): boolean {
  return s.segment >= s.segments.length;
}

/** Quanti ne restano dopo la manche in corso, e quindi dov'è la linea. */
export function cutAt(s: QualiSession): number {
  const seg = currentSegment(s);
  if (!seg || seg.survivors === 0) return s.alive.length;
  return Math.min(seg.survivors, s.alive.length);
}

/**
 * Il giro secco.
 *
 * Stessa struttura del passo di gara — macchina, pilota, pista — ma su un giro
 * solo e con la pista più veloce del 3,5%, perché in qualifica si gira con
 * poco carburante e la macchina scarica.
 *
 * Il `segment` serve alla gomma che si deposita sull'asfalto: due decimi a
 * manche, che sul bagnato non valgono quasi niente perché la pioggia li porta
 * via.
 */
export const TRACK_RUBBER = 0.19;

function flyingLap(
  e: RaceEntry, track: Track, wet: boolean, segment: number, rng: Rng,
): number {
  const skill = e.speed * 0.6 + e.composure * 0.2 + (wet ? e.wet * 0.2 : e.consistency * 0.2);
  let t = track.baseLap * 0.965;
  // La pista si gomma manche dopo manche: in Q3 si gira più forte che in Q1
  // anche con la stessa macchina, ed è il motivo per cui i tempi degli
  // eliminati restano indietro di più di quanto dica il loro passo.
  t -= segment * TRACK_RUBBER * (wet ? 0.3 : 1);
  t += (100 - e.carPace) * CAR_PACE_PER_POINT;
  t += (100 - skill) * 0.032;
  if (wet) t += 6.8 + (100 - e.wet) * 0.06;
  t += rng.normal() * (0.30 - e.consistency * 0.0014);
  // Errore o traffico: il giro salta e resti col tempo peggiore.
  if (rng.chance(clamp(0.1 - e.composure * 0.0008, 0.015, 0.1))) t += rng.range(0.4, 1.4);
  return t;
}

/**
 * Corre una manche: tutti quelli ancora in gioco fanno il loro tentativo, si
 * ordinano, e chi è sotto la linea è fuori.
 *
 * I piani mancanti li riempie l'IA. `pressureOf` dice quanto ha senso osare
 * per ciascuno — in Q1 chi è al sicuro non ha motivo di rischiare, in Q3 non
 * c'è più niente da conservare — ed è la stessa funzione che serve alla
 * schermata per dire al giocatore quanto è in pericolo.
 */
export function runSegment(
  s: QualiSession,
  plans?: ReadonlyMap<string, QualifyingPlan>,
): void {
  const seg = currentSegment(s);
  if (!seg) return;

  const field = s.alive.length;
  const runs = s.alive.map((id, rank) => {
    const e = s.entries.find((x) => x.driverId === id)!;
    const st = s.state[id]!;
    const fork = s.rng.fork(`q${s.segment}:${id}`);
    const wanted = plans?.get(id)
      ?? aiQualifyingPlan(e, fork.fork('plan'), pressureOf(seg, rank + 1, field), st);
    // Il piano è un'intenzione; i treni sono quelli che ci sono.
    const plan: QualifyingPlan = { ...wanted, compound: affordable(wanted.compound, st) };

    const outcome = qualifyingOutcome(plan, e, s.track, fork.fork('giro'));
    const lap = flyingLap(e, s.track, s.wet, s.segment, fork.fork('passo')) + outcome.delta;

    if (plan.compound === 'S') { st.softNew -= 1; st.softUsed += 1; }
    st.lap = lap;
    st.note = outcome.note;
    st.compound = plan.compound;
    // Si parte in gara sul treno dell'ultimo tentativo, non sulla somma della
    // sessione: chi esce in Q1 e non gira più va in griglia con la gomma di
    // quel giro lì.
    st.startWear = outcome.startWear;
    return { id, lap };
  });

  runs.sort((a, b) => a.lap - b.lap);
  const keep = seg.survivors === 0 ? runs.length : Math.min(seg.survivors, runs.length);
  s.alive = runs.slice(0, keep).map((r) => r.id);
  // Gli eliminati vanno in coda nell'ordine dei loro tempi, davanti a chi era
  // già uscito prima: si va in griglia nell'ordine in cui si è usciti.
  s.tail = [...runs.slice(keep).map((r) => r.id), ...s.tail];
  s.segment += 1;
}

/** La griglia: chi è rimasto, poi gli eliminati nell'ordine in cui sono usciti. */
export function qualifyingGrid(s: QualiSession): QualifyingResult[] {
  return [...s.alive, ...s.tail].map((id, i) => {
    const st = s.state[id]!;
    return {
      driverId: id,
      position: i + 1,
      lapTime: st.lap ?? 0,
      note: st.note ?? 'Non ha girato',
      startWear: st.startWear,
      softLeft: st.softNew,
    };
  });
}

/**
 * La qualifica intera, per i weekend che nessuno guarda.
 *
 * È la stessa sessione, corsa fino in fondo senza fermarsi: `prepareWeekend` la
 * usa per i weekend simulati, la schermata la avanza una manche alla volta. Due
 * cadenze dello stesso modello, come per la gara — se divergessero, il
 * giocatore vedrebbe una qualifica diversa da quella che il mondo corre.
 */
export function simulateQualifying(
  track: Track,
  entries: readonly RaceEntry[],
  rng: Rng,
  wet = false,
  /** le decisioni di chi è giocato: senza, le sceglie l'IA */
  plans?: ReadonlyMap<string, QualifyingPlan>,
): QualifyingResult[] {
  const s = beginQualifying(track, entries, rng, wet);
  while (!isOver(s)) runSegment(s, plans);
  return qualifyingGrid(s);
}
