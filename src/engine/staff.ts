import type { Driver, StaffMember, StaffRole } from './types.js';
import { clamp, type Rng } from './rng.js';

/**
 * Lo staff personale compra tempo, non talento.
 *
 * Il tetto di ogni attributo è fissato alla nascita del pilota e nessun
 * ingaggio lo alza: lo staff cambia solo la velocità con cui ci si arriva.
 * Questo spezza l'anello soldi → crescita → risultati → soldi, che altrimenti
 * renderebbe il giocatore imbattibile entro la sesta stagione.
 */

/** Quanto pesa ogni ruolo sulla velocità di crescita. Il procuratore non incide: porta soldi. */
export const ROLE_GROWTH_WEIGHT: Record<StaffRole, number> = {
  coach: 0.20,
  trainer: 0.12,
  physio: 0.08,
  agent: 0,
};

export const MAX_GROWTH_MULTIPLIER = 1 + 0.20 + 0.12 + 0.08; // 1.40 con tutti a 100

/** Moltiplicatore di crescita derivato dallo staff sotto contratto: 1.00 → 1.40. */
export function staffGrowthMultiplier(d: Driver): number {
  let bonus = 0;
  const best: Partial<Record<StaffRole, number>> = {};
  for (const s of d.staff) {
    const cur = best[s.role];
    if (cur === undefined || s.quality > cur) best[s.role] = s.quality;
  }
  for (const [role, q] of Object.entries(best)) {
    bonus += ROLE_GROWTH_WEIGHT[role as StaffRole] * ((q ?? 0) / 100);
  }
  return 1 + bonus;
}

export function staffAnnualCost(d: Driver): number {
  return d.staff.reduce((sum, s) => {
    return sum + (s.salaryPct ? Math.round((d.salary * s.salaryPct) / 100) : s.cost);
  }, 0);
}

/** Il procuratore migliora le offerte contrattuali del pilota. */
export function agentBonus(d: Driver): number {
  const agent = d.staff.find((s) => s.role === 'agent');
  return agent ? 1 + (agent.quality / 100) * 0.45 : 1;
}

/**
 * Costo superlineare, effetto sublineare: raddoppiare la spesa non raddoppia
 * nulla. È il secondo freno all'anello dei soldi.
 */
export function staffPrice(role: StaffRole, quality: number): number {
  const base = { coach: 1.0, trainer: 0.62, physio: 0.42, agent: 0 }[role];
  return Math.round(base * 900_000 * Math.pow(quality / 100, 3.1));
}

const STAFF_FIRST = ['Elena', 'Marco', 'Piero', 'Jens', 'Sofia', 'Andrea', 'Lena', 'Gustav', 'Nadia', 'Ruben'];
const STAFF_LAST = ['Vaccaro', 'Teli', 'Nadin', 'Roeland', 'Brenner', 'Cossu', 'Falk', 'Moor', 'Aksoy', 'Prieto'];

let staffCounter = 0;

export function createStaffMember(rng: Rng, role: StaffRole, quality?: number): StaffMember {
  const q = clamp(quality ?? 45 + rng.normal() * 15 + rng.range(0, 20), 30, 96);
  staffCounter += 1;
  const isAgent = role === 'agent';
  return {
    id: `s${staffCounter.toString(36)}`,
    name: `${rng.pick(STAFF_FIRST)} ${rng.pick(STAFF_LAST)}`,
    role,
    quality: Math.round(q),
    cost: isAgent ? 0 : staffPrice(role, q),
    ...(isAgent ? { salaryPct: Math.round(5 + (q / 100) * 8) } : {}),
    // I professionisti migliori rifiutano un pilota sconosciuto, a qualunque cifra.
    minReputation: Math.max(0, Math.round((q - 55) * 1.6)),
  };
}

export function canHire(d: Driver, s: StaffMember): boolean {
  return d.reputation >= s.minReputation;
}
