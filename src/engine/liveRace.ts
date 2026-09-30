import type { Compound, EngineMode, RaceResult, Track } from './types.js';
import { clamp, type Rng } from './rng.js';
import {
  MIN_GAP, POINTS, lapTimeFor, overtakeChance, pitLossFor, pitStrategy,
  retirementChancePerLap, wearPerLap, type RaceEntry,
} from './race.js';
import { DRS_RANGE } from './overtaking.js';
import { breaksCompoundRule, COMPOUND_RULE_PENALTY } from './rules.js';
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
  /** le mescole già usate: la regola delle due vale anche qui */
  compounds: Compound[];
  stops: number;
  mode: EngineMode;
  /** mescola da montare alla prossima sosta; null = non si entra */
  pitArmed: Compound | null;
  /** secondi di simulazione in cui la vettura è ferma ai box */
  pitUntil: number;
  /** secondi di simulazione fino a cui la vettura sta attaccando */
  attackUntil: number;
  /**
   * La carica dell'ERS, da 0 a 100.
   *
   * È il budget con cui si compra velocità. Si scarica spingendo e
   * attaccando, si ricarica gestendo — e quando è a zero la modalità *push*
   * non spinge più, perché non c'è niente da spendere.
   */
  ers: number;
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
  /**
   * Le monoposto che comanda il giocatore.
   *
   * Sono due, non una: si gestisce una scuderia, e lasciare che il motore
   * chiamasse ai box la seconda vettura vorrebbe dire che metà della
   * strategia si decide da sola.
   */
  playerIds: readonly string[];
  rng: Rng;
}

export interface LiveRaceOptions {
  wet?: boolean;
  playerIds?: readonly string[];
  /** mescola di partenza delle vetture del giocatore */
  playerCompound?: Compound;
}

const ATTACK_DURATION = 12;
const PIT_STATIONARY = 2.4;

/**
 * La batteria: perché un budget e non un timer.
 *
 * Prima l'attacco si sbloccava dopo ventisei secondi di ricarica. Funzionava,
 * ma la decisione era una sola e sempre la stessa: *appena posso, attacco*.
 * Non c'era niente da amministrare, solo qualcosa da aspettare.
 *
 * Con una carica da spendere le domande diventano due, e valgono per tutta la
 * gara: **quanta** ne spendo adesso, e **quanta** me ne serve per il giro in
 * cui conta. Gestire non è più il tasto che non si preme mai: è il modo in cui
 * si ricarica.
 *
 * I numeri sono in unità al secondo di simulazione, e un giro dura attorno ai
 * novanta secondi: una carica piena vale un giro e mezzo di spinta piena, o
 * quattro attacchi.
 */
export const ERS_MAX = 100;

/** Quanto costa lanciare un attacco, oltre a quello che consuma mentre dura. */
export const ATTACK_COST = 25;

const ERS_RATE: Record<EngineMode, number> = {
  conserve: 0.90,
  normal: 0.22,
  push: -0.75,
};

/** Consumo aggiuntivo mentre l'attacco è in corso. */
const ERS_ATTACK_DRAIN = 1.1;

/**
 * La modalità che la vettura riesce davvero a tenere.
 *
 * A batteria scarica *push* non spinge: resta l'intenzione del giocatore —
 * così il pulsante non si spegne da solo sotto il dito — ma il modello la
 * legge come *standard*. È anche il motivo per cui la carica va mostrata: chi
 * la vede a zero capisce perché non sta guadagnando.
 */
export function effectiveMode(car: LiveCar): EngineMode {
  return car.mode === 'push' && car.ers <= 0 ? 'normal' : car.mode;
}

export function createLiveRace(
  track: Track,
  entries: readonly RaceEntry[],
  rng: Rng,
  opts: LiveRaceOptions = {},
): LiveRace {
  const wet = opts.wet ?? rng.chance(track.rain);

  const cars: LiveCar[] = entries.map((entry) => {
    const isPlayer = opts.playerIds?.includes(entry.driverId) ?? false;
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
      compounds: [],
      ers: ERS_MAX,
      finishedAt: null,
    };
  });

  const race: LiveRace = {
    track, cars, t: 0, lap: 1, wet,
    safetyCarUntil: 0, safetyCarsUsed: 0, finished: false,
    events: [], playerIds: opts.playerIds ?? [], rng,
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

/**
 * Quanti giri restano alla gomma prima del crollo.
 *
 * È la stessa informazione dell'usura, detta nel modo in cui serve. «80%» fa
 * fare un conto a mente — quanto consumo a giro, quanti ne mancano, ci arrivo?
 * — e quel conto nessuno lo fa mentre guarda una gara. «4.3 giri» risponde
 * alla domanda vera, che è una sola: **mi fermo adesso o al prossimo?**
 *
 * Il riferimento è il crollo a 70, non la fine a 150: oltre quella soglia la
 * gomma perde due secondi al giro e crescendo, quindi da lì in poi non si
 * corre, si arranca. Contare i giri fino a 150 direbbe che ce ne sono ancora
 * dieci, e sarebbe vero e inutile.
 */
export const TYRE_CLIFF = 70;

export function tyreLapsLeft(race: LiveRace, car: LiveCar): number {
  const perLap = wearPerLap(car.entry, car.tyre, race.track, effectiveMode(car), isAttacking(race, car));
  if (perLap <= 0) return 99;
  return Math.max(0, (TYRE_CLIFF - car.tyre.wear) / perLap);
}

/** Comandi del giocatore. */
export function setMode(car: LiveCar, mode: EngineMode): void {
  if (!car.dnf) car.mode = mode;
}

export function armPit(car: LiveCar, compound: Compound | null): void {
  car.pitArmed = compound;
}

/** Si può attaccare solo con la carica per farlo. */
export function canAttack(race: LiveRace, car: LiveCar): boolean {
  return !car.dnf && car.ers >= ATTACK_COST && !isAttacking(race, car);
}

export function startAttack(race: LiveRace, car: LiveCar): boolean {
  if (!canAttack(race, car)) return false;
  car.ers -= ATTACK_COST;
  car.attackUntil = race.t + ATTACK_DURATION;
  return true;
}

export function isAttacking(race: LiveRace, car: LiveCar): boolean {
  return race.t < car.attackUntil;
}

/**
 * Come le vetture del computer amministrano la carica.
 *
 * Si decide una volta a giro, sul traguardo, e non a ogni passo: una vettura
 * che cambiasse modalità dieci volte al giro non sarebbe più brava, sarebbe
 * solo più nervosa. La regola è quella che userebbe un muretto qualunque —
 * spingi quando hai qualcuno a tiro e la carica per farlo, gestisci quando sei
 * solo o a secco, e attacca se te lo puoi permettere.
 *
 * Senza questo il giocatore avrebbe una leva che il resto della griglia non
 * ha, e il campionato misurerebbe l'accesso a un pulsante invece che una
 * scuderia.
 */
function aiEnergy(race: LiveRace, car: LiveCar): void {
  if (race.playerIds.includes(car.entry.driverId) || car.dnf) return;

  const ahead = order(race).find((o) => o !== car && o.progress > car.progress);
  const gap = ahead ? gapBetween(race, ahead, car) : null;
  const close = gap !== null && gap < 1.6;

  if (close && car.ers > 35) {
    car.mode = 'push';
    if (gap !== null && gap < 1 && canAttack(race, car)) startAttack(race, car);
  } else if (car.ers < 25) {
    car.mode = 'conserve';
  } else {
    car.mode = 'normal';
  }
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
    const mode = effectiveMode(c);

    // La carica si muove prima del resto: quello che la vettura riesce a fare
    // in questo passo dipende da quanta ne aveva all'inizio.
    const drain = (ERS_RATE[c.mode] - (attacking ? ERS_ATTACK_DRAIN : 0))
      // Dietro la safety car si recupera comunque: si va piano e si ricarica.
      * (sc ? 0.4 : 1) + (sc ? 0.5 : 0);
    c.ers = clamp(c.ers + drain * dt, 0, ERS_MAX);

    const lapTime = lapTimeFor(c.entry, {
      track,
      lap: c.lap,
      tyre: c.tyre,
      wet: race.wet,
      dirtyAir: c.dirtyAir,
      mode,
      underSafetyCar: sc,
    }, rng);
    c.lastLap = lapTime;

    const p0 = c.progress;
    const before = Math.floor(p0);
    const fraction = dt / lapTime;
    c.progress += fraction;
    const push = sc ? 0.5 : attacking ? 1.35 : mode === 'push' ? 1.2 : mode === 'conserve' ? 0.85 : 1;
    c.tyre.wear = Math.min(
      150,
      c.tyre.wear + wearPerLap(c.entry, c.tyre, track, mode, attacking) * fraction * (sc ? 0.16 : 1),
    );
    c.tyre.age += fraction;
    c.tyre.temperature = updateTemperature(c.tyre, push, track.trackTemp, fraction);
    if (!sc && lapTime < c.bestLap) c.bestLap = lapTime;

    // Ritiro: la probabilità per giro, riscalata sulla frazione percorsa.
    if (rng.chance(retirementChancePerLap(c.entry, c.tyre, race.wet, 0, c.dirtyAir) * fraction)) {
      c.dnf = true;
      log(race, { kind: 'retire', drivers: [c.entry.driverId], key: race.playerIds.includes(c.entry.driverId) });
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
      aiEnergy(race, c);
      const planned = c.plan[c.stops] ?? Infinity;
      const worthIt = track.laps - c.lap >= 3;
      if (!race.playerIds.includes(c.entry.driverId) && c.pitArmed === null && !sc && worthIt) {
        if (c.lap >= planned || c.tyre.wear > 82) {
          c.pitArmed = c.tyre.compound === 'S' ? 'H' : track.tyreWear > 1.2 ? 'M' : 'S';
        }
      }
      if (c.pitArmed) {
        c.compounds.push(c.tyre.compound);
        const loss = pitLossFor(c.entry, sc);
        c.progress -= loss / track.baseLap;
        c.tyre = freshTyre(c.pitArmed);
        c.pitArmed = null;
        c.stops += 1;
        c.pitUntil = race.t + PIT_STATIONARY;
        log(race, {
          kind: 'pit', drivers: [c.entry.driverId], compound: c.tyre.compound,
          key: race.playerIds.includes(c.entry.driverId),
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
        key: race.playerIds.includes(fol.entry.driverId)
          || race.playerIds.includes(lead.entry.driverId),
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
      gap: clamp(gapOf(c), 0, 1e6)
        + (breaksCompoundRule([...c.compounds, c.tyre.compound], race.wet) ? COMPOUND_RULE_PENALTY : 0),
      penalised: breaksCompoundRule([...c.compounds, c.tyre.compound], race.wet),
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
