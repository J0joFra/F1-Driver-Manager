import type { EngineMode, QualifyingResult, RaceResult, Track } from './types.js';
import { type Rng } from './rng.js';
import { clamp } from './curves.js';
import {
  COMPOUND_PACE, freshTyre, tyreLapPenalty, updateTemperature,
  wearPerLap as tyreWearPerLap, type TyreState,
} from './tyres.js';
import { DRS_RANGE, overtakeChance as overtakeProbability } from './overtaking.js';
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
}

export const POINTS = [25, 18, 15, 12, 10, 8, 6, 4, 2, 1];
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
export function lapTimeFor(e: RaceEntry, ctx: LapContext, rng: Rng): number {
  const { track } = ctx;
  // Il rumore si estrae sempre, anche dietro la safety car: la sequenza
  // casuale non deve dipendere da un ramo, altrimenti lo stesso seed produce
  // mondi diversi a seconda di quando esce la safety car.
  const noise = rng.normal() * (0.34 - e.consistency * 0.0016);
  if (ctx.underSafetyCar) return track.baseLap * 1.55;

  let t = track.baseLap;
  // La monoposto pesa circa il doppio del pilota: è la Formula 1, non i kart.
  t += (100 - e.carPace) * 0.092;
  t += (100 - driverSkillOf(e, ctx.wet, track)) * 0.03 * driverInfluence(track.layout);
  t += COMPOUND_PACE[ctx.tyre.compound];
  t += tyreLapPenalty(ctx.tyre, e.tyres, track);
  t += (track.laps - ctx.lap) * 0.046;
  t += MODE_PACE[ctx.mode];
  if (ctx.dirtyAir) t += 0.22;
  if (ctx.wet) t += 7.5 + (100 - e.wet) * 0.05;
  // L'esperienza non rende più veloci: fa sbagliare meno, e sul giro si vede.
  t -= (e.experience ?? 0) * 0.08;
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

/** Strategia di sosta dell'IA: una o due soste a seconda del degrado del tracciato. */
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
  const cars: Car[] = entries.map((e) => ({
    e,
    // Le vetture partono distanziate come sulla griglia reale.
    time: e.grid * 0.28,
    lastLap: track.baseLap,
    tyre: freshTyre(track.tyreWear > 1.2 ? 'M' : rng.chance(0.4) ? 'S' : 'M'),
    stops: 0,
    plan: pitStrategy(track, rng),
    dnf: false,
    best: Infinity,
    dirty: false,
  }));

  // --- il via: qui contano le partenze, non la macchina ---
  for (const c of cars) {
    const launch = ((c.e.starts - 70) / 100) * rng.range(0.6, 1.8);
    c.time += -launch * 0.9 + rng.normal() * 0.55 + (wet ? rng.normal() * 0.4 : 0);
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

      // Sosta ai box
      if (c.plan.includes(lap)) {
        const loss = pitLossFor(e, underSC);
        c.time += loss;
        c.stops += 1;
        c.tyre = freshTyre(c.tyre.compound === 'S' ? 'H' : track.tyreWear > 1.2 ? 'M' : 'S');
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
      gap: c.time - winnerTime,
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
export function simulateQualifying(
  track: Track,
  entries: readonly RaceEntry[],
  rng: Rng,
  wet = false,
): QualifyingResult[] {
  const laps = entries.map((e) => {
    const skill = e.speed * 0.6 + e.composure * 0.2 + (wet ? e.wet * 0.2 : e.consistency * 0.2);
    let t = track.baseLap * 0.965;
    t += (100 - e.carPace) * 0.092;
    t += (100 - skill) * 0.032;
    if (wet) t += 6.8 + (100 - e.wet) * 0.06;
    t += rng.normal() * (0.30 - e.consistency * 0.0014);
    // Errore o traffico: il giro salta e resti col tempo peggiore.
    if (rng.chance(clamp(0.1 - e.composure * 0.0008, 0.015, 0.1))) t += rng.range(0.4, 1.4);
    return { driverId: e.driverId, lapTime: t };
  });

  laps.sort((a, b) => a.lapTime - b.lapTime);
  return laps.map((l, i) => ({ ...l, position: i + 1 }));
}
