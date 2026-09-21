import type { Compound, QualifyingResult, RaceResult, Track } from './types.js';
import { clamp, type Rng } from './rng.js';

/**
 * Simulazione di gara a risoluzione di giro.
 *
 * Non c'è fisica: si calcola un tempo sul giro per ogni vettura, lo si accumula
 * e si risolvono contatti e sorpassi con un modello probabilistico. È lo stesso
 * motore che l'interfaccia mostrerà giro per giro; qui gira in pochi millisecondi
 * perché serve simulare stagioni intere da riga di comando.
 */

export interface RaceEntry {
  driverId: string;
  teamId: string;
  /** 0–100, prestazione complessiva della monoposto */
  carPace: number;
  reliability: number;
  speed: number;
  consistency: number;
  tyres: number;
  starts: number;
  wet: number;
  composure: number;
  /** qualità dei meccanici: incide sul tempo di sosta */
  pitCrew: number;
  grid: number;
}

export const COMPOUND_PACE: Record<Compound, number> = { S: -0.78, M: 0, H: 0.68 };
export const COMPOUND_WEAR: Record<Compound, number> = { S: 1.6, M: 1.0, H: 0.62 };

const POINTS = [25, 18, 15, 12, 10, 8, 6, 4, 2, 1];
const MIN_GAP = 0.42;
const BASE_PIT_LOSS = 21.5;

interface Car {
  e: RaceEntry;
  time: number;
  lastLap: number;
  compound: Compound;
  wear: number;
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

function pitStrategy(track: Track, rng: Rng): number[] {
  const stops = track.tyreWear > 1.2 || rng.chance(0.3) ? 2 : 1;
  const laps = track.laps;
  if (stops === 1) return [Math.round(laps * rng.range(0.38, 0.56))];
  return [Math.round(laps * rng.range(0.26, 0.34)), Math.round(laps * rng.range(0.62, 0.72))];
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
    compound: track.tyreWear > 1.2 ? 'M' : rng.chance(0.4) ? 'S' : 'M',
    wear: 0,
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
  if (opts.safetyCars === undefined && rng.chance(track.safetyCar * (wet ? 1.6 : 1))) safetyCars = 1;
  const scLap = safetyCars > 0 ? rng.int(4, track.laps - 6) : -1;

  for (let lap = 1; lap <= track.laps; lap++) {
    const underSC = lap >= scLap && lap < scLap + 4 && scLap > 0;

    for (const c of cars) {
      if (c.dnf) continue;
      const e = c.e;

      const driverSkill =
        e.speed * 0.42 + e.consistency * 0.22 + e.tyres * 0.18 + e.composure * 0.1 +
        (wet ? e.wet * 0.08 : e.speed * 0.08);

      let lapTime = track.baseLap;
      // La monoposto pesa circa il doppio del pilota: è la Formula 1, non i kart.
      lapTime += (100 - e.carPace) * 0.092;
      lapTime += (100 - driverSkill) * 0.030;
      lapTime += COMPOUND_PACE[c.compound];
      lapTime += Math.pow(c.wear / 100, 2) * 3.4 * track.tyreWear;
      lapTime += (track.laps - lap) * 0.046;
      if (c.dirty) lapTime += 0.22;
      if (wet) lapTime += 7.5 + (100 - e.wet) * 0.05;
      lapTime += rng.normal() * (0.34 - e.consistency * 0.0016);
      if (underSC) lapTime = track.baseLap * 1.55;

      c.lastLap = lapTime;
      c.time += lapTime;
      if (!underSC && lapTime < c.best) c.best = lapTime;

      // Il degrado dipende dalla mescola, dal tracciato e da quanto il pilota è dolce sulle gomme.
      const wearRate = COMPOUND_WEAR[c.compound] * track.tyreWear * (100 / (60 + e.tyres * 0.45));
      c.wear = Math.min(150, c.wear + (underSC ? wearRate * 0.3 : wearRate * 1.9));

      // Sosta ai box
      if (c.plan.includes(lap)) {
        const loss = (underSC ? 12 : BASE_PIT_LOSS) + (100 - e.pitCrew) * 0.022;
        c.time += loss;
        c.wear = 0;
        c.stops += 1;
        c.compound = c.compound === 'S' ? 'H' : track.tyreWear > 1.2 ? 'M' : 'S';
      }

      // Ritiro: affidabilità della macchina + errore del pilota
      const mech = ((100 - e.reliability) / 100) * 0.0109;
      const human = ((100 - e.consistency) / 100) * 0.0016 * (wet ? 2.4 : 1) * (c.wear > 100 ? 2 : 1);
      if (rng.chance(mech + human)) c.dnf = true;
    }

    // --- posizioni, aria sporca e sorpassi ---
    const running = cars.filter((c) => !c.dnf).sort((a, b) => a.time - b.time);
    for (let i = 1; i < running.length; i++) {
      const lead = running[i - 1]!;
      const fol = running[i]!;
      const gap = fol.time - lead.time;
      fol.dirty = gap < 1.0;
      if (gap >= MIN_GAP || underSC) continue;

      const paceDelta = lead.lastLap - fol.lastLap;
      const p = (paceDelta * 0.55 + 0.04) * track.overtaking;
      if (p > 0 && rng.chance(p)) {
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
