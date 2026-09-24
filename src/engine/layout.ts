import type { CarRating } from './types.js';
import type { RaceEntry } from './race.js';
import { clamp } from './curves.js';

/**
 * La forma di un circuito.
 *
 * In Formula 1 non esiste «la macchina più veloce»: esiste la macchina più
 * veloce *su quel tracciato*. Monza premia la potenza, Monaco la trazione e
 * il carico meccanico, Silverstone il carico aerodinamico. Finché il passo
 * della monoposto era un numero solo, una scuderia che sviluppava l'ala
 * andava forte ovunque, e il campionato perdeva la cosa che lo rende
 * interessante — che certi circuiti stanno a pennello a certe macchine.
 *
 * Un tracciato è quindi descritto da come si spende un giro: quanta parte in
 * rettilineo, quanta nelle curve lente, medie e veloci. Le quattro frazioni
 * sommano a uno, e da lì discendono il passo della monoposto, quello del
 * pilota, la difficoltà dei sorpassi e il consumo delle gomme. Sono quattro
 * numeri che descrivono un posto, non quattro manopole di bilanciamento.
 */

export interface SectorMix {
  /** rettilinei e curve in pieno: dove conta la potenza */
  straight: number;
  /** tornanti e chicane: trazione, staccata, carico meccanico */
  slow: number;
  /** curve di raccordo: equilibrio generale */
  medium: number;
  /** curvoni in appoggio: carico aerodinamico e coraggio */
  fast: number;
}

export function mixTotal(m: SectorMix): number {
  return m.straight + m.slow + m.medium + m.fast;
}

/**
 * Quanto pesano potenza, aerodinamica e telaio su un tracciato.
 *
 * Ogni tipo di settore ha il suo profilo — il rettilineo è quasi tutto
 * motore, la curva veloce quasi tutta ala, la lenta soprattutto telaio — e il
 * peso complessivo è la media pesata sui settori del giro. I tre valori
 * sommano sempre a uno, quindi un tracciato non rende le macchine più veloci
 * in assoluto: cambia solo *quale* macchina è veloce.
 */
const SECTOR_PROFILE: Record<keyof SectorMix, { engine: number; aero: number; chassis: number }> = {
  straight: { engine: 0.72, aero: 0.10, chassis: 0.18 },
  slow:     { engine: 0.14, aero: 0.24, chassis: 0.62 },
  medium:   { engine: 0.26, aero: 0.40, chassis: 0.34 },
  fast:     { engine: 0.16, aero: 0.66, chassis: 0.18 },
};

export interface CarWeights { engine: number; aero: number; chassis: number }

export function carWeights(mix: SectorMix): CarWeights {
  const total = mixTotal(mix) || 1;
  const out = { engine: 0, aero: 0, chassis: 0 };
  for (const key of Object.keys(SECTOR_PROFILE) as (keyof SectorMix)[]) {
    const share = mix[key] / total;
    const profile = SECTOR_PROFILE[key];
    out.engine += profile.engine * share;
    out.aero += profile.aero * share;
    out.chassis += profile.chassis * share;
  }
  return out;
}

/**
 * Un tracciato medio: la forma su cui si misura «quanto è buona» una
 * monoposto in assoluto, per le classifiche e lo sviluppo. Non esiste in
 * calendario, ma serve perché «passo» resti una parola con un significato.
 */
export const NEUTRAL_MIX: SectorMix = { straight: 0.33, slow: 0.22, medium: 0.27, fast: 0.18 };

/** Il passo della monoposto **su questo tracciato**, 0–100. */
export function carPaceOn(car: CarRating, mix: SectorMix): number {
  const w = carWeights(mix);
  return car.engine * w.engine + car.aero * w.aero + car.chassis * w.chassis;
}

/**
 * Quanto pesano le qualità del pilota su un tracciato.
 *
 * Il talento puro conta ovunque, ma non allo stesso modo: in un tornante si
 * guadagna con la sensibilità e la freddezza in staccata, in un curvone si
 * guadagna con il coraggio di tenere il piede giù, e su un rettilineo non si
 * guadagna quasi niente — è la macchina che va.
 */
const DRIVER_PROFILE: Record<keyof SectorMix, { speed: number; technical: number; composure: number }> = {
  straight: { speed: 0.70, technical: 0.18, composure: 0.12 },
  slow:     { speed: 0.52, technical: 0.26, composure: 0.22 },
  medium:   { speed: 0.64, technical: 0.18, composure: 0.18 },
  fast:     { speed: 0.66, technical: 0.10, composure: 0.24 },
};

/**
 * Quanto del giro è in mano al pilota.
 *
 * Su un tracciato tutto rettilinei la differenza fra un campione e un
 * esordiente si assottiglia; fra i muretti si allarga. È il motivo per cui in
 * certi posti un pilota fa la differenza e in altri no.
 */
export function driverInfluence(mix: SectorMix): number {
  const total = mixTotal(mix) || 1;
  // Il rettilineo vale poco, la curva lenta molto: 0.72× a Monza, 1.3× a Monaco.
  const weighted =
    mix.straight * 0.62 + mix.medium * 1.0 + mix.fast * 1.12 + mix.slow * 1.34;
  return weighted / total;
}

/** L'abilità del pilota che conta su questo tracciato, 0–100. */
export function driverSkillOn(e: RaceEntry, mix: SectorMix, wet: boolean): number {
  const total = mixTotal(mix) || 1;
  let speed = 0, technical = 0, composure = 0;
  for (const key of Object.keys(DRIVER_PROFILE) as (keyof SectorMix)[]) {
    const share = mix[key] / total;
    const profile = DRIVER_PROFILE[key];
    speed += profile.speed * share;
    technical += profile.technical * share;
    composure += profile.composure * share;
  }
  /*
   * La costanza e le gomme pesano ovunque allo stesso modo: non dipendono
   * dalla forma del tracciato ma dal saperci stare per settanta giri.
   *
   * Il peso della velocità pura resta alto di proposito. Al primo tentativo
   * l'avevo diluita fra sensibilità e freddezza, che nella griglia si
   * assomigliano molto più di quanto si assomigli la velocità: i piloti
   * finivano per valere tutti uguale, decideva solo la macchina, e in
   * quarant'anni una scuderia vinceva trentasei titoli su quaranta. La forma
   * del tracciato deve spostare il peso, non appiattire le differenze.
   */
  const shaped = e.speed * speed + e.technical * technical + e.composure * composure;
  return shaped * 0.78 + e.consistency * 0.12 + e.tyres * 0.10
    + (wet ? (e.wet - 50) * 0.12 : 0);
}

/**
 * Quanto è facile passare, 0 (impossibile) – 1 (autostrada).
 *
 * Non è più un numero scritto a mano per ogni circuito: discende dalla forma.
 * Si passa in fondo ai rettilinei, dopo una staccata: servono metri per
 * affiancarsi e un punto di frenata dove provarci. Un tracciato di curve
 * medie in sequenza non offre né gli uni né l'altro.
 */
export function overtakingFrom(mix: SectorMix, width: number, drsZones: number): number {
  const total = mixTotal(mix) || 1;
  const straight = mix.straight / total;
  const slow = mix.slow / total;
  const medium = mix.medium / total;
  const fast = mix.fast / total;
  // Il rettilineo dà la scia e la staccata; le curve medie in sequenza sono
  // il veleno, perché non c'è mai un punto di frenata dove affiancarsi.
  const shape = straight * 0.92 + slow * 0.22 - medium * 0.34 - fast * 0.22
    + Math.min(drsZones, 3) * 0.045;
  // La larghezza è un moltiplicatore, non un addendo: fra i muretti anche il
  // rettilineo più lungo non basta, perché non c'è dove mettere la macchina.
  return clamp(shape * (0.42 + clamp(width, 0, 1) * 0.78) + 0.1, 0.15, 0.68);
}

/**
 * Quanto consuma le gomme, come moltiplicatore.
 *
 * Le curve veloci sono quelle che scaldano e distruggono: il carico laterale
 * prolungato è ciò che consuma, non la staccata. Un tracciato di rettilinei
 * è gentile con le gomme anche se le velocità sono altissime.
 */
export function tyreWearFrom(mix: SectorMix, trackTemp: number): number {
  const total = mixTotal(mix) || 1;
  const load = (mix.fast * 2.05 + mix.medium * 1.35 + mix.slow * 1.02 + mix.straight * 0.52) / total;
  // L'asfalto caldo aggiunge, ma pesa molto meno della forma.
  return clamp(load * (1 + (trackTemp - 32) * 0.008), 0.62, 1.5);
}

/**
 * Velocità media sul giro, in km/h.
 *
 * Un giro è lungo quanto è lungo e si percorre alla velocità che la sua forma
 * permette: i rettilinei e i curvoni alzano la media, i tornanti la
 * abbassano. Deriva da qui il tempo sul giro, che prima era un terzo numero
 * scritto a mano — e poteva contraddire gli altri due, come un tracciato da
 * sette chilometri percorso a 308 km/h di media.
 */
export function averageSpeed(mix: SectorMix): number {
  const total = mixTotal(mix) || 1;
  return 150 + (mix.straight / total) * 150 + (mix.fast / total) * 120;
}

/** Il tempo sul giro di riferimento, in secondi. */
export function baseLapFrom(lengthKm: number, mix: SectorMix): number {
  return Math.round((lengthKm / averageSpeed(mix)) * 3600 * 10) / 10;
}

/** Descrizione in una parola, per l'interfaccia. */
export function layoutName(mix: SectorMix): string {
  const total = mixTotal(mix) || 1;
  const s = mix.straight / total;
  const slow = mix.slow / total;
  const fast = mix.fast / total;
  if (s >= 0.42) return 'Potenza';
  if (slow >= 0.32) return 'Guidato';
  if (fast >= 0.30) return 'Carico aerodinamico';
  return 'Equilibrato';
}
