import type { Attributes, AttributeKey, Driver } from './types.js';
import { clamp } from './curves.js';

/**
 * Quanto un pilota vale in ciascun mestiere del weekend.
 *
 * È l'equivalente F1 delle stelle di ruolo dei manageriali di calcio: un
 * overall unico dice se un pilota è forte, questo dice *a cosa* è forte. Un
 * pilota da 74 che vale cinque stelle sul bagnato e due in qualifica è una
 * storia; un 74 e basta non lo è.
 *
 * I pesi non sono opinioni: pescano dagli stessi attributi che il motore di
 * gara usa per quella fase. Il qualificatore pesa la velocità pura perché è
 * quella che `simulateQualifying` legge; l'uomo gara pesa gomme e costanza
 * perché sono quelle che decidono un long run.
 */
export type RoleKey = 'qualifier' | 'racer' | 'wet' | 'starter' | 'engineer';

export interface Role {
  key: RoleKey;
  label: string;
  /** cosa cambia in pista, in una riga */
  hint: string;
  weights: Partial<Record<AttributeKey, number>>;
}

export const ROLES: readonly Role[] = [
  {
    key: 'qualifier', label: 'Qualificatore', hint: 'Il giro secco',
    weights: { speed: 0.6, composure: 0.2, technical: 0.2 },
  },
  {
    key: 'racer', label: 'Uomo gara', hint: 'Passo lungo, gomme al limite',
    weights: { tyres: 0.4, consistency: 0.35, composure: 0.25 },
  },
  {
    key: 'wet', label: 'Specialista bagnato', hint: 'Pista senza riferimenti',
    weights: { wet: 0.6, composure: 0.25, consistency: 0.15 },
  },
  {
    key: 'starter', label: 'Partente', hint: 'I primi duecento metri',
    weights: { starts: 0.65, composure: 0.2, speed: 0.15 },
  },
  {
    key: 'engineer', label: 'Collaudatore', hint: "Assetto nella direzione giusta",
    weights: { technical: 0.6, consistency: 0.25, tyres: 0.15 },
  },
];

/**
 * Il voto di un ruolo, 0–5 con i mezzi punti.
 *
 * La scala non è lineare sul punteggio grezzo: un attributo da 50 è la media
 * della griglia, non metà di un campione. Cinque stelle partono da 88, che in
 * un mondo ancorato a 76 di potenziale medio è un vertice raro.
 */
export function roleRating(attrs: Attributes, role: Role): number {
  let score = 0;
  let total = 0;
  for (const [key, weight] of Object.entries(role.weights) as [AttributeKey, number][]) {
    score += attrs[key] * weight;
    total += weight;
  }
  const raw = total > 0 ? score / total : 0;
  // 45 → nessuna stella, 88 → cinque. Sotto i 45 un pilota non è da Formula 1.
  return clamp(Math.round(((raw - 45) / 43) * 10) / 2, 0, 5);
}

export interface RatedRole extends Role {
  rating: number;
  /** il voto che avrebbe al massimo del suo potenziale */
  potential: number;
}

/** Tutti i ruoli, dal più adatto al meno. */
export function ratedRoles(d: Driver): RatedRole[] {
  return ROLES
    .map((role) => ({
      ...role,
      rating: roleRating(d.attrs, role),
      potential: roleRating(d.caps, role),
    }))
    .sort((a, b) => b.rating - a.rating || b.potential - a.potential);
}
