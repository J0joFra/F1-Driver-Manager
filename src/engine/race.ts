import type { Compound, EngineMode, RaceResult, Track } from './types.js';
import { type Rng } from './rng.js';
import {
  CLIFF, COMPOUND_PACE, freshTyre, tyreLapPenalty, updateTemperature,
  wearPerLap as tyreWearPerLap, type TyreState,
} from './tyres.js';
import { DRS_RANGE, overtakeChance as overtakeProbability } from './overtaking.js';
import { breaksCompoundRule, COMPOUND_RULE_PENALTY, POINTS } from './rules.js';
import { driverInfluence, driverSkillOn, NEUTRAL_MIX } from './layout.js';
import { driverErrorChance, mechanicalFailureChance, safetyCarChancePerLap } from './incidents.js';

export { COMPOUND_PACE, COMPOUND_WEAR } from './tyres.js';
export { ATTACK_RANGE, DRS_RANGE } from './overtaking.js';

/**
 * Il modello di gara.
 *
 * Non c'è fisica: si calcola un tempo sul giro per ogni vettura, lo si accumula
 * e si risolvono aria sporca e sorpassi con un modello probabilistico.
 *
 * Le funzioni esportate qui sotto sono l'unica definizione del modello. Le usano
 * sia `simulateRace` (risoluzione di giro, per simulare stagioni intere da riga
 * di comando) sia `liveRace.ts` (risoluzione di tick, per la gara che il
 * giocatore guarda e in cui interviene). Una sola formula, due cadenze.
 */

export interface RaceEntry {
  driverId: string;
  teamId: string;
  /** 0–100, prestazione complessiva della monoposto */
  carPace: number;
  reliability: number;
  /** 0–1: quanto l'esperienza riduce gli errori e affina il passo */
  experience?: number;
  speed: number;
  consistency: number;
  tyres: number;
  starts: number;
  wet: number;
  composure: number;
  /** sensibilità tecnica: conta nelle curve lente, dove si guida di fino */
  technical: number;
  /** qualità dei meccanici: incide sul tempo di sosta */
  pitCrew: number;
  grid: number;
  /** abilità sbloccate: punti in più quando attacca, non quando difende */
  overtakeMod?: number;
  /** abilità sbloccate: moltiplicatore del degrado, sotto 1 è un guadagno */
  tyreWearMod?: number;
  /**
   * L'usura con cui si parte, lasciata dalla qualifica.
   *
   * Si va in griglia sul treno dell'ultimo tentativo del sabato: chi ha
   * spinto nel giro di lancio e rimontato una morbida già usata parte con
   * trenta punti di usura addosso, chi è uscito in Q1 e non ha più girato con
   * quasi niente. È la riga «le paghi in gara» che l'interfaccia prometteva e
   * che prima non leggeva nessuno.
   */
  startWear?: number;
}

export { POINTS } from './rules.js';
export const MIN_GAP = 0.42;
export const BASE_PIT_LOSS = 21.5;

/** Quanto pesa la modalità motore sul tempo sul giro e sul degrado. */
export const MODE_PACE: Record<EngineMode, number> = { conserve: 0.45, normal: 0, push: -0.35 };
export const MODE_WEAR: Record<EngineMode, number> = { conserve: 0.7, normal: 1, push: 1.35 };

/** Abilità del pilota pesata per le condizioni. */
/**
 * Quanto vale il pilota su questo tracciato.
 *
 * Non è una media fissa dei suoi attributi: fra i muretti contano la
 * sensibilità e la freddezza, in un curvone il coraggio, su un rettilineo
 * quasi niente. `driverInfluence` dice inoltre quanta parte del giro è in
 * mano sua: 0.62× su un tracciato di solo gas, 1.34× fra i tornanti.
 */
export function driverSkillOf(e: RaceEntry, wet: boolean, track?: Track): number {
  const mix = track?.layout ?? NEUTRAL_MIX;
  return driverSkillOn(e, mix, wet);
}

export interface LapContext {
  track: Track;
  lap: number;
  tyre: TyreState;
  wet: boolean;
  dirtyAir: boolean;
  mode: EngineMode;
  underSafetyCar: boolean;
}

/** Il tempo sul giro. Unica definizione: la usano sia la gara veloce sia quella live. */
/**
 * Quanto vale un punto di monoposto, in secondi sul giro.
 *
 * Era 0.092, ed è il numero che ha reso le gare illeggibili. Con la griglia di
 * partenza che va da 70 a 95, novantadue millesimi a punto fanno 2,3 secondi
 * al giro fra la prima e l'ultima — che su cinquantotto giri sono due giri di
 * distacco. Il campo arrivava spalmato su sette giri e mezzo, e una scuderia
 * nuova non correva contro nessuno: veniva doppiata da tutti, sempre.
 *
 * Il valore va letto insieme a `TEAM_SEEDS`, che è stata stretta: sono la
 * stessa decisione presa in due punti. Quello che conta è il prodotto —
 * quanti secondi separano la prima dall'ultima — e adesso vale attorno al
 * secondo, che è una griglia in cui si può correre.
 *
 * Il rapporto con il pilota resta quello dichiarato: la monoposto pesa circa
 * il doppio, non cinque volte.
 */
export const CAR_PACE_PER_POINT = 0.058;

export function lapTimeFor(e: RaceEntry, ctx: LapContext, rng: Rng): number {
  const { track } = ctx;
  // Il rumore si estrae sempre, anche dietro la safety car: la sequenza
  // casuale non deve dipendere da un ramo, altrimenti lo stesso seed produce
  // mondi diversi a seconda di quando esce la safety car.
  /*
   * Il rumore sul giro: quanto un pilota è ripetibile.
   *
   * L'esperienza lo riduce quanto la costanza, ed è il motivo per cui un
   * esordiente perde tempo anche quando è veloce: non sbaglia il giro buono,
   * sbaglia tutti gli altri. Nei dati storici il salto fra la prima e la
   * seconda stagione è il più grande di tutta la carriera, e viene da qui.
   */
  const steadiness = e.consistency * 0.0016 + (e.experience ?? 0) * 0.09;
  const noise = rng.normal() * Math.max(0.08, 0.34 - steadiness);
  if (ctx.underSafetyCar) return track.baseLap * 1.55;

  let t = track.baseLap;
  // La monoposto pesa circa il doppio del pilota: è la Formula 1, non i kart.
  t += (100 - e.carPace) * CAR_PACE_PER_POINT;
  t += (100 - driverSkillOf(e, ctx.wet, track)) * 0.040 * driverInfluence(track.layout);
  t += COMPOUND_PACE[ctx.tyre.compound];
  t += tyreLapPenalty(ctx.tyre, e.tyres, track);
  t += (track.laps - ctx.lap) * 0.046;
  t += MODE_PACE[ctx.mode];
  if (ctx.dirtyAir) t += 0.22;
  if (ctx.wet) t += 7.5 + (100 - e.wet) * 0.05;
  // Conoscere il tracciato vale qualche centesimo; il grosso lo fa il
  // rumore qui sopra, cioè non buttare via i giri normali.
  t -= (e.experience ?? 0) * 0.14;
  t += noise;
  return t;
}

/** Degrado per giro percorso, con la spinta della modalità motore. */
export function wearPerLap(
  e: RaceEntry, tyre: TyreState, track: Track, mode: EngineMode, attacking = false,
): number {
  return tyreWearPerLap(tyre, e.tyres, track, MODE_WEAR[mode] * (attacking ? 1.5 : 1))
    * (e.tyreWearMod ?? 1);
}

export { overtakeProbability as overtakeChance };

/** Probabilità di ritiro per giro: guasto meccanico più errore del pilota. */
export function retirementChancePerLap(
  e: RaceEntry, tyre: TyreState, wet: boolean, fatigue = 0, underPressure = false,
): number {
  return (
    driverErrorChance({
      consistency: e.consistency,
      fatigue,
      tyreWear: tyre.wear,
      experience: e.experience ?? 0,
      wetness: wet ? 1 : 0,
      wetSkill: e.wet,
      underPressure,
      reliability: e.reliability,
    }) + mechanicalFailureChance(e.reliability)
  );
}

/** Tempo perso ai box, safety car compresa. */
export function pitLossFor(e: RaceEntry, underSafetyCar: boolean): number {
  return (underSafetyCar ? 12 : BASE_PIT_LOSS) + (100 - e.pitCrew) * 0.022;
}

/**
 * Oltre questa usura si entra ai box comunque, piano o non piano.
 *
 * È lo stesso numero che usa la cadenza live: le due devono decidere allo
 * stesso modo, o la gara che il giocatore guarda non è quella che il
 * campionato simula.
 */
export const PIT_WEAR = 82;

/** Un treno nuovo, meno quello che la qualifica si è già preso. */
export function usedTyre(compound: Compound, startWear = 0): TyreState {
  const t = freshTyre(compound);
  t.wear = Math.max(0, startWear);
  return t;
}

/**
 * Quanti giri regge una mescola su questo tracciato, per un pilota medio.
 *
 * Serve a scegliere la gomma guardando quanto manca, che è l'unica cosa che
 * conta e che prima nessuno guardava: la regola era «se sei su gomma morbida
 * monta dura, altrimenti monta morbida», e su uno stint da trenta giri quella
 * morbida arrivava al crollo a due terzi e ci restava. Non era una strategia
 * sbagliata: era una strategia che nessuno aveva preso.
 */
export function compoundLife(track: Track, compound: Compound, tyreSkill = 70): number {
  const rate = tyreWearPerLap(freshTyre(compound), tyreSkill, track, 1);
  return rate > 0 ? CLIFF / rate : 99;
}

/**
 * La mescola giusta per i giri che restano.
 *
 * La più morbida che ci arriva senza sfondare il crollo — perché a parità di
 * durata la morbida è più veloce. Se non ci arriva nessuna si monta la dura e
 * si stringono i denti: vuol dire che la sosta andava fatta prima.
 *
 * `needsDifferent` forza la regola delle due mescole quando è l'ultimo treno
 * utile: scoprire la penalità di venticinque secondi a fine gara non è una
 * regola, è un agguato.
 */
export function compoundFor(
  track: Track, lapsLeft: number, tyreSkill: number, used: readonly Compound[],
): Compound {
  const order: Compound[] = ['S', 'M', 'H'];
  const fits = order.filter((c) => compoundLife(track, c, tyreSkill) >= lapsLeft);
  const wanted = fits[0] ?? 'H';

  // Se finora si è usata una sola mescola e questo è l'ultimo treno, va
  // cambiata comunque.
  const distinct = new Set(used);
  if (distinct.size === 1 && lapsLeft <= compoundLife(track, wanted, tyreSkill)) {
    const only = [...distinct][0]!;
    if (wanted === only) {
      const alternative = order.filter((c) => c !== only);
      return alternative.find((c) => compoundLife(track, c, tyreSkill) >= lapsLeft) ?? 'H';
    }
  }
  return wanted;
}

/** Strategia di sosta dell'IA: una o due soste a seconda del degrado del tracciato. */
/**
 * Il via, in secondi persi o guadagnati sul resto del gruppo.
 *
 * La griglia schiera le vetture a 0,28s l'una dall'altra: perché la partenza
 * sposti qualcosa deve valere qualche decimo, e deve valerlo per bravura e non
 * per sorte. Col vecchio rapporto — abilità entro ±0,22s contro un rumore di
 * deviazione 0,55s — il caso pesava due volte e mezzo lo spunto del pilota: le
 * prime curve erano una lotteria che cancellava il risultato della qualifica.
 *
 * Adesso l'attributo `starts` (55-95 nel gruppo) apre circa 0,85s fra il
 * migliore e il peggiore, mentre il rumore scende a 0,22s. Due o tre posizioni
 * le decide il pilota, mezza i dadi.
 *
 * Il valore restituito è tempo PERSO: negativo per chi parte bene. Le due
 * cadenze — `simulateRace` e `stepRace` — devono chiamare questa e nient'altro,
 * così un buon partente resta un buon partente in entrambe.
 */
export function launchDelta(starts: number, wet: boolean, rng: Rng): number {
  const launch = ((starts - 70) / 100) * rng.range(1.7, 3.1);
  return -launch * 0.9 + rng.normal() * 0.22 + (wet ? rng.normal() * 0.3 : 0);
}

export function pitStrategy(track: Track, rng: Rng): number[] {
  const stops = track.tyreWear > 1.2 || rng.chance(0.3) ? 2 : 1;
  const laps = track.laps;
  if (stops === 1) return [Math.round(laps * rng.range(0.38, 0.56))];
  return [Math.round(laps * rng.range(0.26, 0.34)), Math.round(laps * rng.range(0.62, 0.72))];
}

/** Strategia di sosta dell'IA: una o due soste a seconda del degrado del tracciato. */
export interface Car {
  e: RaceEntry;
  time: number;
  lastLap: number;
  tyre: TyreState;
  /** le mescole montate e già usate: servono alla regola delle due mescole */
  compounds: Compound[];
  stops: number;
  plan: number[];
  dnf: boolean;
  best: number;
  dirty: boolean;
}

export interface RaceOptions {
  wet?: boolean;
  /** forza il numero di safety car invece di estrarle */
  safetyCars?: number;
}

export interface RaceOutcome {
  results: RaceResult[];
  safetyCars: number;
  wet: boolean;
}

export function simulateRace(
  track: Track,
  entries: readonly RaceEntry[],
  rng: Rng,
  opts: RaceOptions = {},
): RaceOutcome {
  const wet = opts.wet ?? rng.chance(track.rain);
  const cars: Car[] = entries.map((e) => {
    const plan = pitStrategy(track, rng);
    return {
      e,
      // Le vetture partono distanziate come sulla griglia reale.
      time: e.grid * 0.28,
      lastLap: track.baseLap,
      // La gomma di partenza guarda già alla prima finestra di sosta, non al
      // solo degrado del tracciato, e porta l'usura lasciata dalla qualifica.
      tyre: usedTyre(compoundFor(track, plan[0] ?? track.laps, e.tyres, []), e.startWear),
      compounds: [] as Compound[],
      stops: 0,
      plan,
      dnf: false,
      best: Infinity,
      dirty: false,
    };
  });

  // --- il via: qui contano le partenze, non la macchina ---
  for (const c of cars) {
    c.time += launchDelta(c.e.starts, wet, rng);
  }

  let safetyCars = opts.safetyCars ?? 0;
  if (opts.safetyCars === undefined && rng.chance(safetyCarChancePerLap(track, wet ? 1 : 0) * track.laps)) {
    safetyCars = 1;
  }
  const scLap = safetyCars > 0 ? rng.int(4, track.laps - 6) : -1;

  for (let lap = 1; lap <= track.laps; lap++) {
    const underSC = lap >= scLap && lap < scLap + 4 && scLap > 0;

    for (const c of cars) {
      if (c.dnf) continue;
      const e = c.e;

      const lapTime = lapTimeFor(e, {
        track, lap, tyre: c.tyre, wet,
        dirtyAir: c.dirty, mode: 'normal', underSafetyCar: underSC,
      }, rng);

      c.lastLap = lapTime;
      c.time += lapTime;
      if (!underSC && lapTime < c.best) c.best = lapTime;

      const wearRate = wearPerLap(e, c.tyre, track, 'normal');
      c.tyre.wear = Math.min(150, c.tyre.wear + (underSC ? wearRate * 0.16 : wearRate));
      c.tyre.age += 1;
      c.tyre.temperature = updateTemperature(c.tyre, underSC ? 0.5 : 1, track.trackTemp, 1);

      /*
       * Sosta ai box.
       *
       * Il piano non basta: una gomma finita va cambiata anche se il piano
       * diceva di resistere. Questo percorso seguiva il piano alla cieca
       * mentre quello live si fermava a usura 82, e le due cadenze dello
       * stesso modello devono decidere allo stesso modo — è la regola su cui
       * è costruito tutto il progetto.
       *
       * Era anche la ragione vera dei distacchi assurdi: chi si trovava con
       * una mescola sbagliata restava in pista venti giri oltre il crollo,
       * e la classifica finale misurava la sfortuna al sorteggio delle
       * strategie invece della velocità.
       */
      const lapsLeft = track.laps - lap;
      const worthIt = lapsLeft >= 3;
      if (worthIt && (c.plan.includes(lap) || c.tyre.wear > PIT_WEAR)) {
        const loss = pitLossFor(e, underSC);
        c.time += loss;
        c.stops += 1;
        c.compounds.push(c.tyre.compound);
        c.tyre = freshTyre(compoundFor(track, lapsLeft, e.tyres, c.compounds));
      }

      if (rng.chance(retirementChancePerLap(e, c.tyre, wet))) c.dnf = true;
    }

    // --- posizioni, aria sporca e sorpassi ---
    const running = cars.filter((c) => !c.dnf).sort((a, b) => a.time - b.time);
    for (let i = 1; i < running.length; i++) {
      const lead = running[i - 1]!;
      const fol = running[i]!;
      const gap = fol.time - lead.time;
      fol.dirty = gap < 1.0;
      if (gap >= MIN_GAP || underSC) continue;

      const p = overtakeProbability(track, {
        gap,
        attackSkill: fol.e.speed + fol.e.composure + (fol.e.overtakeMod ?? 0),
        defenceSkill: lead.e.speed + lead.e.consistency,
        paceDelta: lead.lastLap - fol.lastLap,
        tyreAdvantage: lead.tyre.wear - fol.tyre.wear,
        drs: gap < DRS_RANGE,
        attacking: false,
      });
      // Una probabilità per secondo, applicata al tempo di un giro.
      if (p > 0 && rng.chance(1 - Math.pow(1 - p, track.baseLap))) {
        const swap = lead.time;
        lead.time = fol.time + 0.3;
        fol.time = swap - 0.3;
      } else {
        fol.time = lead.time + MIN_GAP;
      }
    }
  }

  const finishers = cars.filter((c) => !c.dnf).sort((a, b) => a.time - b.time);
  const retired = cars.filter((c) => c.dnf);
  const winnerTime = finishers[0]?.time ?? 0;

  let fastest: Car | undefined;
  for (const c of finishers) if (!fastest || c.best < fastest.best) fastest = c;

  const results: RaceResult[] = [];
  finishers.forEach((c, i) => {
    const position = i + 1;
    let points = POINTS[i] ?? 0;
    if (fastest === c && position <= 10) points += 1;
    results.push({
      driverId: c.e.driverId,
      position,
      grid: c.e.grid,
      points,
      dnf: false,
      gap: c.time - winnerTime + penalty(c.compounds, c.tyre.compound, wet),
      penalised: breaksCompoundRule([...c.compounds, c.tyre.compound], wet),
      stops: c.stops,
      fastestLap: fastest === c,
    });
  });
  retired.forEach((c, i) => {
    results.push({
      driverId: c.e.driverId,
      position: finishers.length + i + 1,
      grid: c.e.grid,
      points: 0,
      dnf: true,
      gap: null,
      stops: c.stops,
      fastestLap: false,
    });
  });

  return { results, safetyCars, wet };
}

/**
 * Qualifica: un giro secco a serbatoio scarico.
 *
 * Nel gioco il giocatore prende tre decisioni (quando uscire, come preparare le
 * gomme, quanto rischiare nell'ultimo settore); qui contano solo l'esito e
 * l'ordine di griglia.
 */
/**
 * La penalità delle due mescole.
 *
 * Su asciutto vanno usate almeno due mescole diverse, il che rende
 * obbligatoria almeno una sosta. È l'unica ragione per cui una strategia
 * esiste: senza, la gara migliore sarebbe sempre partire con la dura e non
 * fermarsi mai. Qui costa venticinque secondi invece della squalifica —
 * abbastanza da rovinare la gara, non da cancellarla.
 */
function penalty(used: readonly Compound[], current: Compound, wet: boolean): number {
  return breaksCompoundRule([...used, current], wet) ? COMPOUND_RULE_PENALTY : 0;
}

