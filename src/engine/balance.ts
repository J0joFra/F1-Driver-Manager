import type { World } from './types.js';
import { driverStandings } from './season.js';

/**
 * Metriche di bilanciamento.
 *
 * Servono a rispondere con un numero a domande che altrimenti si risolvono a
 * sensazione: "si sorpassa abbastanza?", "vince sempre la stessa squadra?",
 * "la griglia è troppo compatta?". Ogni metrica ha una banda obiettivo presa
 * dalla Formula 1 reale.
 *
 * Volutamente **non** c'è auto-taratura. Un sistema che si corregge da solo a
 * runtime nasconde lo sbilanciamento invece di mostrarlo, rende la
 * simulazione non riproducibile fra due sessioni e toglie il senso del seed.
 * I numeri si leggono, e i parametri si cambiano a mano nel codice.
 */

export interface BalanceTargets {
  min: number;
  max: number;
}

export const TARGETS: Record<string, BalanceTargets> = {
  overtakesPerRace: { min: 8, max: 45 },
  dnfRate: { min: 0.04, max: 0.18 },
  safetyCarRate: { min: 0.15, max: 0.55 },
  poleToWin: { min: 0.25, max: 0.7 },
  // Dentro una stagione una vettura dominante vince quasi tutto: è successo
  // davvero, e non è un difetto. Quello che non deve succedere è che vinca
  // sempre la stessa negli anni — lo dice `championTurnover`, non questo.
  topTeamWinRate: { min: 0, max: 0.88 },
  lapTimeSpread: { min: 0.8, max: 4.5 },
  // Calibrato sul modello, non desiderato: su dodici mondi da quarant'anni il
  // ricambio sta fra 0.10 e 0.17, cioè fra quattro e sette scuderie campioni
  // su otto. Pretendere 0.2 vorrebbe dire che in quarant'anni vincono tutte.
  championTurnover: { min: 0.09, max: 1 },
};

export interface SeasonMetrics {
  races: number;
  overtakesPerRace: number;
  dnfRate: number;
  safetyCarRate: number;
  /** quante pole si sono trasformate in vittoria */
  poleToWin: number;
  /** quota di vittorie della scuderia più vincente */
  topTeamWinRate: number;
  /** secondi fra il primo e l'ultimo in qualifica, mediana sulle gare */
  lapTimeSpread: number;
  /** punti dei piloti dal 5° al 12°: quanto è vivo il centro gruppo */
  midfieldSpread: number;
}

export function seasonMetrics(world: World): SeasonMetrics {
  const races = world.results.length;
  if (races === 0) {
    return {
      races: 0, overtakesPerRace: 0, dnfRate: 0, safetyCarRate: 0,
      poleToWin: 0, topTeamWinRate: 0, lapTimeSpread: 0, midfieldSpread: 0,
    };
  }

  let starts = 0;
  let dnf = 0;
  let safetyCars = 0;
  let poleWins = 0;
  let positionsGained = 0;
  const spreads: number[] = [];
  const winsByTeam = new Map<string, number>();

  for (const weekend of world.results) {
    safetyCars += weekend.safetyCars > 0 ? 1 : 0;
    const pole = weekend.qualifying[0]?.driverId;
    const winner = weekend.race.find((r) => r.position === 1 && !r.dnf);
    if (pole && winner?.driverId === pole) poleWins += 1;
    if (winner) {
      const teamId = world.drivers[winner.driverId]?.teamId ?? '?';
      winsByTeam.set(teamId, (winsByTeam.get(teamId) ?? 0) + 1);
    }

    const first = weekend.qualifying[0]?.lapTime;
    const last = weekend.qualifying[weekend.qualifying.length - 1]?.lapTime;
    if (first !== undefined && last !== undefined) spreads.push(last - first);

    for (const r of weekend.race) {
      starts += 1;
      if (r.dnf) dnf += 1;
      // Le posizioni guadagnate rispetto alla griglia sono la misura più
      // onesta dei sorpassi: contarli uno per uno premierebbe i doppiaggi.
      else if (r.grid > r.position) positionsGained += r.grid - r.position;
    }
  }

  const table = driverStandings(world);
  const midfield = table.slice(4, 12).map((r) => r.points);
  const midfieldSpread = midfield.length > 1
    ? (Math.max(...midfield) - Math.min(...midfield)) / Math.max(1, Math.max(...midfield))
    : 0;

  spreads.sort((a, b) => a - b);
  const totalWins = [...winsByTeam.values()].reduce((s, n) => s + n, 0) || 1;

  return {
    races,
    overtakesPerRace: positionsGained / races,
    dnfRate: starts > 0 ? dnf / starts : 0,
    safetyCarRate: safetyCars / races,
    poleToWin: poleWins / races,
    topTeamWinRate: Math.max(0, ...winsByTeam.values()) / totalWins,
    lapTimeSpread: spreads[Math.floor(spreads.length / 2)] ?? 0,
    midfieldSpread,
  };
}

export interface MetricCheck {
  name: string;
  value: number;
  target: BalanceTargets;
  ok: boolean;
}

/** Confronta le metriche con le bande obiettivo. */
export function checkBalance(m: SeasonMetrics): MetricCheck[] {
  const rows: [string, number][] = [
    ['overtakesPerRace', m.overtakesPerRace],
    ['dnfRate', m.dnfRate],
    ['safetyCarRate', m.safetyCarRate],
    ['poleToWin', m.poleToWin],
    ['topTeamWinRate', m.topTeamWinRate],
    ['lapTimeSpread', m.lapTimeSpread],
  ];
  return rows.map(([name, value]) => {
    const target = TARGETS[name]!;
    return { name, value, target, ok: value >= target.min && value <= target.max };
  });
}

/**
 * Ricambio dei campioni: scuderie diverse sul totale delle stagioni.
 *
 * È la metrica che dice se il mondo si è congelato. Un valore di 0.2 significa
 * una squadra campione ogni cinque stagioni — sotto, la gerarchia non si
 * muove più e il gioco è finito anche se le gare continuano.
 */
export function championTurnover(world: World): number {
  if (world.champions.length === 0) return 1;
  const teams = new Set(world.champions.map((c) => c.teamId));
  return teams.size / world.champions.length;
}

/** Media di più stagioni: una sola annata è troppo rumorosa per decidere. */
export function averageMetrics(all: SeasonMetrics[]): SeasonMetrics {
  const n = Math.max(1, all.length);
  const sum = (pick: (m: SeasonMetrics) => number) => all.reduce((s, m) => s + pick(m), 0) / n;
  return {
    races: sum((m) => m.races),
    overtakesPerRace: sum((m) => m.overtakesPerRace),
    dnfRate: sum((m) => m.dnfRate),
    safetyCarRate: sum((m) => m.safetyCarRate),
    poleToWin: sum((m) => m.poleToWin),
    topTeamWinRate: sum((m) => m.topTeamWinRate),
    lapTimeSpread: sum((m) => m.lapTimeSpread),
    midfieldSpread: sum((m) => m.midfieldSpread),
  };
}
