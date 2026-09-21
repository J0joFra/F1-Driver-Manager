import type { Driver, World } from './types.js';
import { clamp, type Rng } from './rng.js';
import { createNewgen, overall, potentialOverall } from './driver.js';
import { agentBonus, staffAnnualCost } from './staff.js';

/**
 * Mercato piloti e conti correnti.
 *
 * Tutte le scuderie del mondo firmano piloti ogni anno, anche quando il
 * giocatore è solo uno dei venti in griglia: la Modalità Scuderia non aggiunge
 * sistemi, toglie solo l'IA da uno slot.
 */

/** Livello medio di potenziale a cui il mondo resta ancorato. */
export const POTENTIAL_ANCHOR = 76;

export const SEATS_PER_TEAM = 2;

/** Quanto vale un pilota sul mercato: risultati, fama e margine di crescita. */
export function marketValue(d: Driver): number {
  const now = overall(d.attrs);
  const headroom = Math.max(0, potentialOverall(d) - now);
  const youth = clamp((30 - d.age) / 12, -0.4, 1);
  return now * 0.62 + d.reputation * 0.22 + headroom * youth * 0.9;
}

/** Ingaggio proposto, in euro. Un buon procuratore lo alza sensibilmente. */
export function offeredSalary(d: Driver, teamBudget: number, rng: Rng): number {
  const v = marketValue(d);
  const scale = clamp((v - 50) / 45, 0.02, 1);
  const cap = teamBudget * 0.22;
  const base = cap * Math.pow(scale, 2.1);
  return Math.round(clamp(base * agentBonus(d) * rng.range(0.9, 1.15), 250_000, 30_000_000));
}

/**
 * Anti-inflazione: se la griglia si è alzata troppo, i nuovi arrivano un po'
 * più deboli, e viceversa. Senza questo, dopo 40 stagioni i record delle prime
 * annate sembrerebbero ridicoli.
 */
/**
 * Correzione anti-inflazione, a controllo integrale.
 *
 * Una correzione proporzionale (guardo quanto la griglia si è alzata e genero
 * i nuovi altrettanto più deboli) lascia sempre un errore residuo: al volante
 * arrivano i migliori del bacino, quindi la media di chi corre sta
 * stabilmente sopra il livello a cui i piloti vengono generati, e la
 * correzione insegue senza mai raggiungere. Accumulando la correzione anno
 * dopo anno in `world.talentAnchor`, l'errore residuo si annulla.
 */
export function updateTalentAnchor(world: World): number {
  const active = Object.values(world.drivers).filter((d) => !d.retired && d.teamId);
  if (active.length === 0) return world.talentAnchor;
  const mean = active.reduce((s, d) => s + potentialOverall(d), 0) / active.length;
  const corrected = world.talentAnchor - (mean - POTENTIAL_ANCHOR) * 0.5;
  world.talentAnchor = clamp(corrected, POTENTIAL_ANCHOR - 12, POTENTIAL_ANCHOR + 12);
  return world.talentAnchor;
}

/** Nuova leva: giovani che entrano nell'academy e aspettano un sedile. */
export function intakeNewgens(world: World, rng: Rng, count: number): void {
  const anchor = updateTalentAnchor(world);
  const base = Object.keys(world.drivers).length;
  const taken = new Set(Object.values(world.drivers).filter((d) => !d.retired).map((d) => d.name));
  for (let i = 0; i < count; i++) {
    const d = createNewgen(rng, {
      potentialAnchor: anchor, id: `d${world.year}x${base + i}`, taken,
    });
    taken.add(d.name);
    world.drivers[d.id] = d;
    world.academy.push(d.id);
  }
}

/** Conti di fine stagione del pilota: ingaggio, bonus, staff, spese fisse. */
export function settleFinances(d: Driver, pointsThisYear: number, podiums: number, wins: number): number {
  const bonuses = pointsThisYear * 15_000 + podiums * 150_000 + wins * 400_000;
  const sponsors = Math.round(d.reputation * 12_000);
  const income = d.salary + bonuses + sponsors;
  const costs = staffAnnualCost(d) + Math.round(income * 0.15);
  const net = income - costs;
  d.money += net;
  return net;
}

/**
 * Mercato di fine stagione: i contratti scadono, le scuderie scelgono in ordine
 * di prestigio, i piloti scelgono l'offerta migliore fra quelle ricevute.
 */
export function runTransferMarket(world: World, rng: Rng): void {
  for (const d of Object.values(world.drivers)) {
    if (d.retired) continue;
    d.contractYears -= 1;
    if (d.contractYears <= 0 && d.teamId) {
      const team = world.teams[d.teamId];
      if (team) team.driverIds = team.driverIds.filter((id) => id !== d.id);
      d.teamId = null;
      d.contractYears = 0;
    }
  }

  const available = Object.values(world.drivers)
    .filter((d) => !d.retired && !d.teamId)
    .sort((a, b) => marketValue(b) - marketValue(a));

  // Il prestigio decide chi sceglie per primo, ma non da solo: un progetto
  // ambizioso, i soldi o la promessa di essere prima guida spostano le scelte.
  const teams = Object.values(world.teams)
    .map((t) => ({ t, rank: t.prestige + rng.normal() * 14 }))
    .sort((a, b) => b.rank - a.rank)
    .map((x) => x.t);
  for (const team of teams) {
    while (team.driverIds.length < SEATS_PER_TEAM) {
      const idx = available.findIndex((d) => {
        // Una scuderia di coda non convince un top driver, e viceversa.
        const v = marketValue(d);
        return v <= team.prestige * 0.55 + 45 || team.prestige > 70;
      });
      const pick = idx >= 0 ? available.splice(idx, 1)[0] : available.shift();
      if (!pick) break;
      pick.teamId = team.id;
      pick.contractYears = rng.int(1, 3);
      pick.salary = offeredSalary(pick, team.budget, rng);
      team.driverIds.push(pick.id);
    }
  }

  world.academy = world.academy.filter((id) => {
    const d = world.drivers[id];
    return !!d && !d.retired && !d.teamId;
  });
}
