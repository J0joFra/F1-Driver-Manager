import type { Compound, EngineMode, RaceResult, Track } from './types.js';
import { clamp, type Rng } from './rng.js';
import {
  MIN_GAP, POINTS, lapTimeFor, overtakeChance, pitLossFor, pitStrategy,
  retirementChancePerLap, wearPerLap, type RaceEntry,
} from './race.js';
import { DRS_RANGE } from './overtaking.js';
import { safetyCarChancePerLap } from './incidents.js';
import { freshTyre, updateTemperature, type TyreState } from './tyres.js';

/**
 * La gara che il giocatore guarda.
 *
 * Stesse formule di `simulateRace` — importate da `race.ts`, non riscritte —
 * ma avanzate a piccoli passi invece che un giro alla volta, così le vetture
 * si muovono sul tracciato e le decisioni di strategia hanno effetto nel
 * momento in cui le prendi.
 *
 * La posizione è tenuta come `progress` (giri completati più frazione di giro)
 * invece che come tempo accumulato: è ciò che serve a disegnare un puntino nel
 * punto giusto del circuito, e i distacchi si ricavano dalla differenza di
 * progress moltiplicata per il tempo sul giro di riferimento.
 */

export interface LiveCar {
  entry: RaceEntry;
  progress: number;
  lap: number;
  lastLap: number;
  bestLap: number;
  /** stato del treno di gomme montato: mescola, usura, temperatura, giri */
  tyre: TyreState;
  stops: number;
  mode: EngineMode;
  /** mescola da montare alla prossima sosta; null = non si entra */
  pitArmed: Compound | null;
  /** secondi di simulazione in cui la vettura è ferma ai box */
  pitUntil: number;
  /** secondi di simulazione fino a cui la vettura sta attaccando */
  attackUntil: number;
  dirtyAir: boolean;
  dnf: boolean;
  /** giri in cui l'IA ha programmato la sosta */
  plan: number[];
  finishedAt: number | null;
}

/**
 * Gli eventi sono dati, non frasi: il motore non conosce i nomi dei piloti né
 * la lingua dell'interfaccia. È quest'ultima a comporre il testo.
 */
export type RaceEventKind = 'start' | 'pit' | 'overtake' | 'retire' | 'safetyCarOut' | 'safetyCarIn';

export interface RaceEvent {
  t: number;
  lap: number;
  kind: RaceEventKind;
  /** i piloti coinvolti: per un sorpasso, prima chi passa e poi chi è passato */
  drivers: string[];
  compound?: Compound;
  /** riguarda il giocatore */
  key: boolean;
}

export interface LiveRace {
  track: Track;
  cars: LiveCar[];
  /** secondi di simulazione trascorsi */
  t: number;
  /** giro del leader */
  lap: number;
  wet: boolean;
  safetyCarUntil: number;
  safetyCarsUsed: number;
  finished: boolean;
  events: RaceEvent[];
  playerId: string | null;
  rng: Rng;
}

export interface LiveRaceOptions {
  wet?: boolean;
  playerId?: string;
  /** mescola di partenza del giocatore */
  playerCompound?: Compound;
}

const ATTACK_DURATION = 12;
export const ATTACK_COOLDOWN = 26;
const PIT_STATIONARY = 2.4;

export function createLiveRace(
  track: Track,
  entries: readonly RaceEntry[],
  rng: Rng,
  opts: LiveRaceOptions = {},
): LiveRace {
  const wet = opts.wet ?? rng.chance(track.rain);

  const cars: LiveCar[] = entries.map((entry) => {
    const isPlayer = entry.driverId === opts.playerId;
    const startCompound: Compound = isPlayer && opts.playerCompound
      ? opts.playerCompound
      : track.tyreWear > 1.2 ? 'M' : rng.chance(0.4) ? 'S' : 'M';
    return {
      entry,
      // La griglia è distanziata come nella realtà: la prima fila parte davanti.
      progress: -(entry.grid * 0.28) / track.baseLap,
      lap: 1,
      lastLap: track.baseLap,
      bestLap: Infinity,
      tyre: freshTyre(startCompound),
      stops: 0,
      mode: 'normal',
      pitArmed: null,
      pitUntil: 0,
      attackUntil: 0,
      dirtyAir: false,
      dnf: false,
      plan: pitStrategy(track, rng),
      finishedAt: null,
    };
  });

  const race: LiveRace = {
    track, cars, t: 0, lap: 1, wet,
    safetyCarUntil: 0, safetyCarsUsed: 0, finished: false,
    events: [], playerId: opts.playerId ?? null, rng,
  };

  // Il via: qui contano le partenze, non la macchina.
  for (const c of cars) {
    const launch = ((c.entry.starts - 70) / 100) * rng.range(0.6, 1.8);
    c.progress += (launch * 0.9 - rng.normal() * 0.55 - (wet ? rng.normal() * 0.4 : 0)) / track.baseLap;
  }
  log(race, { kind: 'start', drivers: [], key: true });
  return race;
}

function log(race: LiveRace, e: Omit<RaceEvent, 't' | 'lap'>): void {
  race.events.unshift({ t: race.t, lap: race.lap, ...e });
  if (race.events.length > 40) race.events.pop();
}

export function underSafetyCar(race: LiveRace): boolean {
  return race.t < race.safetyCarUntil;
}

/** Classifica attuale: chi ha percorso più strada è davanti. */
export function order(race: LiveRace): LiveCar[] {
  return race.cars.filter((c) => !c.dnf).sort((a, b) => {
    // Chi ha già tagliato il traguardo precede chi è ancora in pista, in ordine
    // di arrivo. Confrontare direttamente due `finishedAt` nulli darebbe
    // Infinity - Infinity, cioè NaN, e l'ordinamento diventerebbe indefinito.
    const af = a.finishedAt;
    const bf = b.finishedAt;
    if (af !== null && bf !== null) return af - bf;
    if (af !== null) return -1;
    if (bf !== null) return 1;
    return b.progress - a.progress;
  });
}

/** Distacco in secondi fra due vetture, stimato sul tempo sul giro di riferimento. */
export function gapBetween(race: LiveRace, ahead: LiveCar, behind: LiveCar): number {
  return (ahead.progress - behind.progress) * race.track.baseLap;
}

export function positionOf(race: LiveRace, driverId: string): number {
  return order(race).findIndex((c) => c.entry.driverId === driverId) + 1;
}

export function carOf(race: LiveRace, driverId: string): LiveCar | undefined {
  return race.cars.find((c) => c.entry.driverId === driverId);
}

/** Comandi del giocatore. */
export function setMode(car: LiveCar, mode: EngineMode): void {
  if (!car.dnf) car.mode = mode;
}

export function armPit(car: LiveCar, compound: Compound | null): void {
  car.pitArmed = compound;
}

export function startAttack(race: LiveRace, car: LiveCar): void {
  car.attackUntil = race.t + ATTACK_DURATION;
}

export function isAttacking(race: LiveRace, car: LiveCar): boolean {
  return race.t < car.attackUntil;
}

/**
 * Avanza la gara di `dt` secondi di simulazione.
 *
 * `dt` può essere piccolo (vista live) o grande (salta alla fine): il modello è
 * lo stesso, cambia solo quanto spesso si ricampionano gli eventi.
 */
export function stepRace(race: LiveRace, dt: number): void {
  if (race.finished) return;
  const { track, rng } = race;
  const sc = underSafetyCar(race);

  for (const c of race.cars) {
    if (c.dnf || c.finishedAt !== null) continue;

    if (race.t < c.pitUntil) continue;

    const attacking = isAttacking(race, c);
    const lapTime = lapTimeFor(c.entry, {
      track,
      lap: c.lap,
      tyre: c.tyre,
      wet: race.wet,
      dirtyAir: c.dirtyAir,
      mode: c.mode,
      underSafetyCar: sc,
    }, rng);
    c.lastLap = lapTime;

    const p0 = c.progress;
    const before = Math.floor(p0);
    const fraction = dt / lapTime;
    c.progress += fraction;
    const push = sc ? 0.5 : attacking ? 1.35 : c.mode === 'push' ? 1.2 : c.mode === 'conserve' ? 0.85 : 1;
    c.tyre.wear = Math.min(
      150,
      c.tyre.wear + wearPerLap(c.entry, c.tyre, track, c.mode, attacking) * fraction * (sc ? 0.16 : 1),
    );
    c.tyre.age += fraction;
    c.tyre.temperature = updateTemperature(c.tyre, push, track.trackTemp, fraction);
    if (!sc && lapTime < c.bestLap) c.bestLap = lapTime;

    // Ritiro: la probabilità per giro, riscalata sulla frazione percorsa.
    if (rng.chance(retirementChancePerLap(c.entry, c.tyre, race.wet, 0, c.dirtyAir) * fraction)) {
      c.dnf = true;
      log(race, { kind: 'retire', drivers: [c.entry.driverId], key: c.entry.driverId === race.playerId });
      continue;
    }

    /*
     * Bandiera a scacchi.
     *
     * La distanza percorsa è la verità, non un contatore di giri. Il contatore
     * si scollava dalla distanza a ogni sosta: la penalità del pit stop fa
     * arretrare `progress` sotto la linea appena superata, quindi il giro
     * veniva contato una seconda volta alla passata successiva, ma il
     * contatore non tornava indietro. Risultato: chi si fermava una volta
     * tagliava dopo 67 giri veri, chi si fermava due dopo 66, e i distacchi
     * finali erano multipli di un giro intero.
     */
    if (c.progress >= track.laps) {
      // Il momento in cui ha tagliato, non la fine del passo: `fastForward`
      // avanza a quattro secondi per volta, e senza questo ogni distacco
      // sarebbe arrotondato a multipli del passo.
      const crossed = fraction > 0 ? clamp((track.laps - p0) / fraction, 0, 1) : 1;
      c.finishedAt = race.t + dt * crossed;
      c.progress = track.laps;
      c.lap = track.laps;
      continue;
    }

    // Passaggio sulla linea del traguardo
    const after = Math.floor(c.progress);
    if (after > before && c.progress > 0) {
      // Il giro in corso si legge dalla distanza, così una sosta non lo
      // fa più avanzare due volte.
      c.lap = after + 1;
      /*
       * L'IA decide da sé quando fermarsi; il giocatore arma la sosta a mano.
       *
       * Il piano si consuma per indice, una voce per sosta. Prima veniva
       * letto solo `plan[0]` con la condizione `stops === 0`, quindi una
       * vettura si fermava **una volta sola** per tutta la gara: sui circuiti
       * ad alto degrado, dove `pitStrategy` prevede due soste, il secondo
       * stint finiva oltre il crollo delle gomme e la gara durava un terzo di
       * più. Il percorso veloce esegue tutte le soste del piano: le due
       * cadenze dello stesso modello devono decidere allo stesso modo.
       */
      const planned = c.plan[c.stops] ?? Infinity;
      const worthIt = track.laps - c.lap >= 3;
      if (c.entry.driverId !== race.playerId && c.pitArmed === null && !sc && worthIt) {
        if (c.lap >= planned || c.tyre.wear > 82) {
          c.pitArmed = c.tyre.compound === 'S' ? 'H' : track.tyreWear > 1.2 ? 'M' : 'S';
        }
      }
      if (c.pitArmed) {
        const loss = pitLossFor(c.entry, sc);
        c.progress -= loss / track.baseLap;
        c.tyre = freshTyre(c.pitArmed);
        c.pitArmed = null;
        c.stops += 1;
        c.pitUntil = race.t + PIT_STATIONARY;
        log(race, {
          kind: 'pit', drivers: [c.entry.driverId], compound: c.tyre.compound,
          key: c.entry.driverId === race.playerId,
        });
      }
    }
  }

  // Aria sporca e sorpassi
  const running = order(race).filter((c) => c.finishedAt === null && race.t >= c.pitUntil);
  for (let i = 1; i < running.length; i++) {
    const lead = running[i - 1]!;
    const fol = running[i]!;
    const gap = gapBetween(race, lead, fol);
    fol.dirtyAir = gap < 1.0;
    if (gap >= MIN_GAP || sc) continue;

    const p = overtakeChance(track, {
      gap,
      attackSkill: fol.entry.speed + fol.entry.composure + (fol.entry.overtakeMod ?? 0),
      defenceSkill: lead.entry.speed + lead.entry.consistency,
      paceDelta: lead.lastLap - fol.lastLap,
      tyreAdvantage: lead.tyre.wear - fol.tyre.wear,
      drs: gap < DRS_RANGE,
      attacking: isAttacking(race, fol),
    });
    if (p > 0 && rng.chance(p * dt)) {
      fol.progress = lead.progress + 0.3 / track.baseLap;
      lead.progress -= 0.3 / track.baseLap;
      log(race, {
        kind: 'overtake',
        drivers: [fol.entry.driverId, lead.entry.driverId],
        key: fol.entry.driverId === race.playerId || lead.entry.driverId === race.playerId,
      });
    } else {
      fol.progress = lead.progress - MIN_GAP / track.baseLap;
    }
  }

  // Safety car
  if (sc && race.t + dt >= race.safetyCarUntil) log(race, { kind: 'safetyCarIn', drivers: [], key: false });
  else if (!sc && race.safetyCarsUsed === 0 && race.lap > 3 && race.lap < track.laps - 3) {
    if (rng.chance(safetyCarChancePerLap(track, race.wet ? 1 : 0) * (dt / track.baseLap))) {
      race.safetyCarUntil = race.t + 50;
      race.safetyCarsUsed += 1;
      log(race, { kind: 'safetyCarOut', drivers: [], key: true });
    }
  }

  race.t += dt;
  const leader = order(race)[0];
  // Il giro di gara non torna mai indietro: quando il leader va ai box passa in
  // testa chi non ha ancora tagliato la linea, e il suo contatore è più basso.
  if (leader) race.lap = Math.max(race.lap, Math.min(track.laps, leader.lap));

  const active = race.cars.filter((c) => !c.dnf && c.finishedAt === null);
  if (active.length === 0) race.finished = true;
}

/** Porta la gara alla fine senza mostrarla: passi grossi, stesso modello. */
export function fastForward(race: LiveRace, step = 4): void {
  // Il limite non è un numero tondo ma la durata attesa della gara con
  // abbondanza: con un limite fisso un passo fine finiva i giri prima del
  // traguardo, le vetture restavano senza tempo d'arrivo e i distacchi
  // venivano stimati sulla distanza residua — centinaia di secondi.
  const maxSteps = Math.ceil((race.track.laps * race.track.baseLap * 3) / step) + 1000;
  let guard = 0;
  while (!race.finished && guard++ < maxSteps) stepRace(race, step);
  race.finished = true;
}

/** Converte lo stato finale nel risultato che il mondo sa registrare. */
export function liveResults(race: LiveRace): RaceResult[] {
  const finishers = race.cars
    .filter((c) => !c.dnf)
    .sort((a, b) => (a.finishedAt ?? Infinity) - (b.finishedAt ?? Infinity) || b.progress - a.progress);
  const retired = race.cars.filter((c) => c.dnf);

  let fastest: LiveCar | undefined;
  for (const c of finishers) if (!fastest || c.bestLap < fastest.bestLap) fastest = c;

  const leader = finishers[0];
  const leaderFinish = leader?.finishedAt ?? null;
  const leaderProgress = leader?.progress ?? 0;

  /**
   * Il distacco si misura sul tempo di arrivo, non sul progress: dopo la
   * bandiera a scacchi il progress si congela dove capita, quindi userebbe
   * numeri che non crescono con la posizione. Il progress resta solo per le
   * vetture ancora in pista quando la gara viene chiusa.
   */
  const gapOf = (c: LiveCar): number => {
    if (leaderFinish !== null && c.finishedAt !== null) return c.finishedAt - leaderFinish;
    return (leaderProgress - c.progress) * race.track.baseLap;
  };

  const results: RaceResult[] = finishers.map((c, i) => {
    const position = i + 1;
    let points = POINTS[i] ?? 0;
    if (fastest === c && position <= 10) points += 1;
    return {
      driverId: c.entry.driverId,
      position,
      grid: c.entry.grid,
      points,
      dnf: false,
      gap: clamp(gapOf(c), 0, 1e6),
      stops: c.stops,
      fastestLap: fastest === c,
    };
  });

  retired.forEach((c, i) => {
    results.push({
      driverId: c.entry.driverId,
      position: finishers.length + i + 1,
      grid: c.entry.grid,
      points: 0,
      dnf: true,
      gap: null,
      stops: c.stops,
      fastestLap: false,
    });
  });

  return results;
}
