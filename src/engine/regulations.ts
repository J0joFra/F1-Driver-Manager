import type { CarRating, World } from './types.js';
import { skillEffects } from './skills.js';
import { clamp, type Rng } from './rng.js';

/**
 * Sviluppo delle monoposto e azzeramenti regolamentari.
 *
 * Senza un reset periodico, dopo dieci stagioni la scuderia più ricca ha vinto
 * tutto e la gerarchia si congela: è il modo più comune in cui un gestionale
 * sportivo muore. Il regolamento che cambia ogni 4–6 anni rimescola le carte,
 * ed è anche ciò che succede davvero in Formula 1.
 */

export const CAR_KEYS = ['aero', 'engine', 'chassis', 'reliability'] as const;

export function carPace(car: CarRating): number {
  return car.aero * 0.38 + car.engine * 0.34 + car.chassis * 0.28;
}

function meanCarPace(world: World): number {
  const teams = Object.values(world.teams);
  return teams.reduce((s, t) => s + carPace(t.car), 0) / teams.length;
}

/**
 * Sviluppo annuale.
 *
 * `standingOrder` è la classifica costruttori dell'anno appena chiuso, dal primo
 * all'ultimo. Chi ha vinto sviluppa di meno: è la contromisura al congelamento
 * della griglia, ed è anche ciò che fa davvero la Formula 1 con le ore di
 * galleria del vento assegnate al contrario della classifica.
 */
export function developCars(world: World, rng: Rng, standingOrder: string[] = []): void {
  const mean = meanCarPace(world);
  const teamCount = Object.keys(world.teams).length;
  for (const team of Object.values(world.teams)) {
    const rank = standingOrder.indexOf(team.id);
    // Primo in classifica ≈ 0.72×, ultimo ≈ 1.34×.
    const handicap = rank < 0 ? 1 : clamp(0.72 + (rank / Math.max(1, teamCount - 1)) * 0.62, 0.7, 1.4);
    const spendRatio = team.budget / 135_000_000;
    const efficiency = team.crew.technical / 100;
    // Chi è indietro recupera un po' più in fretta: senza questo la griglia si blocca.
    const catchUp = clamp(1 + (mean - carPace(team.car)) * 0.030, 0.75, 1.35);
    // Un pilota che sa dire agli ingegneri cosa fa la macchina vale mesi di
    // galleria del vento: il riscontro migliore fra i due piloti conta.
    const feedback = team.driverIds.reduce((best, id) => {
      const d = world.drivers[id];
      return d ? Math.max(best, skillEffects(d).development) : best;
    }, 0);
    const points = spendRatio * efficiency * catchUp * handicap * rng.range(2.4, 5.2)
      * (1 - team.futureFocus * 0.5) * (1 + feedback * 0.06);

    // Ogni scuderia ha una priorità di sviluppo, e non sempre è quella giusta.
    const weights = { aero: rng.range(0.2, 0.5), engine: rng.range(0.1, 0.35), chassis: rng.range(0.15, 0.4), reliability: rng.range(0.1, 0.3) };
    const total = weights.aero + weights.engine + weights.chassis + weights.reliability;

    for (const k of CAR_KEYS) {
      const share = weights[k] / total;
      // Rendimenti calanti: più sei vicino a 99, meno rende ogni euro.
      const headroom = (99 - team.car[k]) / 40;
      team.car[k] = clamp(team.car[k] + points * share * clamp(headroom, 0.30, 1.2), 40, 99);
    }
  }
}

/** Azzeramento tecnico: le monoposto convergono verso la media e si rimescolano. */
export function applyRegulationReset(world: World, rng: Rng): void {
  const mean = meanCarPace(world);
  for (const team of Object.values(world.teams)) {
    for (const k of CAR_KEYS) {
      // Convergenza forte più una scossa: dopo un reset la gerarchia va riletta da zero.
      const pull = (mean - team.car[k]) * 0.42;
      team.car[k] = clamp(team.car[k] + pull + rng.normal() * 7.5, 45, 97);
    }
  }
  world.regulations.lastResetYear = world.year;
  world.regulations.nextResetYear = world.year + rng.int(4, 6);
}

export function maybeReset(world: World, rng: Rng): boolean {
  if (world.year < world.regulations.nextResetYear) return false;
  applyRegulationReset(world, rng);
  return true;
}

/**
 * Il prestigio segue i risultati: una scuderia che vince attira i piloti
 * migliori, una che perde smette di attirarli. Senza questo il mercato
 * premierebbe per sempre chi era forte alla creazione del mondo.
 */
export function updatePrestige(world: World, standingOrder: string[]): void {
  const n = Math.max(1, standingOrder.length - 1);
  for (const team of Object.values(world.teams)) {
    const rank = standingOrder.indexOf(team.id);
    if (rank < 0) continue;
    const target = 95 - (rank / n) * 55;
    team.prestige = clamp(team.prestige * 0.78 + target * 0.22, 20, 99);
  }
}

/** Tetto di spesa comune a tutte le scuderie, come in Formula 1 dal 2021. */
export const BUDGET_CAP = 135_000_000;

/**
 * Budget e staff tecnico seguono i risultati, entro limiti stretti.
 *
 * Il budget cap comprime le differenze economiche: quello che resta è il
 * premio in denaro, che vale pochi punti percentuali. Senza questa convergenza
 * la scuderia ricca al primo anno resta ricca per sempre e vince sempre —
 * cosa che il simulatore ha mostrato al primo tentativo.
 */
export function updateTeamResources(world: World, standingOrder: string[]): void {
  for (const team of Object.values(world.teams)) {
    const rank = standingOrder.indexOf(team.id);
    if (rank < 0) continue;
    team.budget = Math.round(BUDGET_CAP * (0.84 + (team.prestige / 100) * 0.16));
    // Il personale migliore va dove si vince, ma si muove lentamente.
    const target = 52 + team.prestige * 0.4;
    team.crew.technical = clamp(team.crew.technical * 0.86 + target * 0.14, 35, 97);
    team.crew.trackEngineer = clamp(team.crew.trackEngineer * 0.88 + target * 0.12, 35, 97);
    team.crew.pitCrew = clamp(team.crew.pitCrew * 0.88 + target * 0.12, 35, 97);
  }
}
