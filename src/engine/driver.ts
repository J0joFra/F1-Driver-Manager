import {
  ATTRIBUTE_KEYS, ATTRIBUTE_PROFILE, type AttributeKey, type Attributes, type Driver,
} from './types.js';
import { type Rng } from './rng.js';
import { clamp } from './curves.js';
import { FIRST_NAMES, LAST_NAMES, NATIONALITIES } from './data/names.js';

/** Peso di ogni attributo nel calcolo dell'overall. Somma = 1. */
const OVERALL_WEIGHTS: Record<AttributeKey, number> = {
  speed: 0.28, consistency: 0.20, tyres: 0.16, technical: 0.12,
  composure: 0.12, starts: 0.06, wet: 0.06,
};

export function overall(attrs: Attributes): number {
  let sum = 0;
  for (const k of ATTRIBUTE_KEYS) sum += attrs[k] * OVERALL_WEIGHTS[k];
  return sum;
}

/** Overall che il pilota raggiungerà se arriva al proprio tetto. */
export function potentialOverall(d: Driver): number {
  return overall(d.caps);
}

/**
 * Esperienza: cresce sempre, con rendimenti decrescenti, e non cala mai.
 * È ciò che tiene competitivo un veterano quando i riflessi se ne vanno.
 */
export function experienceGain(driver: Driver): number {
  return 8 * Math.exp(-driver.experience / 400);
}

/** Il vantaggio dell'esperienza sul passo gara: fino a circa otto centesimi. */
export function experienceBonus(driver: Driver): number {
  return (clamp(driver.experience, 0, 1000) / 1000) * 0.08;
}

/** Estrae un nome non ancora in uso; dopo qualche tentativo si arrende e accetta un omonimo. */
function pickName(rng: Rng, taken?: ReadonlySet<string>): string {
  let name = `${rng.pick(FIRST_NAMES)} ${rng.pick(LAST_NAMES)}`;
  for (let i = 0; taken?.has(name) && i < 12; i++) {
    name = `${rng.pick(FIRST_NAMES)} ${rng.pick(LAST_NAMES)}`;
  }
  return name;
}

let counter = 0;
function nextId(prefix: string): string {
  counter += 1;
  return `${prefix}${counter.toString(36)}`;
}

/** Azzera il contatore degli id: serve ai test per avere id riproducibili. */
export function resetIdCounter(): void {
  counter = 0;
}

export interface NewgenOptions {
  /** overall-obiettivo del potenziale, prima della varianza individuale */
  potentialAnchor: number;
  ageMin?: number;
  ageMax?: number;
  /**
   * Id esplicito. Il mondo ne passa sempre uno derivato dal proprio stato:
   * un contatore globale renderebbe i salvataggi non riproducibili fra processi.
   */
  id?: string;
  /** nomi già in uso nel mondo: due piloti omonimi in griglia confondono e basta */
  taken?: ReadonlySet<string>;
}

/**
 * Genera un giovane pilota.
 *
 * `potentialAnchor` è il perno anti-inflazione: il mondo lo corregge ogni anno
 * in base al livello medio della griglia, così dopo 40 stagioni i record del
 * 2031 valgono ancora quanto quelli del 2071.
 */
export function createNewgen(rng: Rng, opts: NewgenOptions): Driver {
  const age = rng.int(opts.ageMin ?? 18, opts.ageMax ?? 21);
  // Il talento individuale è una coda: pochi fenomeni, molti onesti mestieranti.
  const spread = rng.normal() * 7 + (rng.chance(0.06) ? rng.range(6, 13) : 0);
  const targetPotential = clamp(opts.potentialAnchor + spread, 48, 97);

  const caps = {} as Attributes;
  const attrs = {} as Attributes;
  for (const k of ATTRIBUTE_KEYS) {
    caps[k] = clamp(targetPotential + rng.normal() * 6, 40, 99);
    // Un diciottenne parte fra il 62% e il 78% del proprio tetto.
    attrs[k] = clamp(caps[k] * rng.range(0.62, 0.78), 30, 95);
  }

  return {
    id: opts.id ?? nextId('d'),
    name: pickName(rng, opts.taken),
    nationality: rng.pick(NATIONALITIES),
    age,
    attrs,
    caps,
    reputation: clamp(8 + rng.normal() * 4, 1, 30),
    form: 50 + rng.normal() * 8,
    morale: 60,
    fatigue: 0,
    skillPoints: 0,
    perks: [],
    experience: 0,
    teamId: null,
    contractYears: 0,
    salary: 0,
    money: 0,
    staff: [],
    retired: false,
    isPlayer: false,
    history: [],
    career: { starts: 0, points: 0, wins: 0, podiums: 0, poles: 0, titles: 0, bestFinish: 99 },
  };
}

/** Crea un pilota già formato, per popolare la griglia al primo anno. */
export function createVeteran(
  rng: Rng, potentialAnchor: number, age: number, id?: string, taken?: ReadonlySet<string>,
): Driver {
  const d = createNewgen(rng, {
    potentialAnchor, ageMin: age, ageMax: age,
    ...(id ? { id } : {}), ...(taken ? { taken } : {}),
  });
  const maturity = clamp((age - 18) / 8, 0, 1);
  for (const k of ATTRIBUTE_KEYS) {
    d.attrs[k] = clamp(d.caps[k] * (0.7 + 0.3 * maturity) + rng.normal() * 2, 30, d.caps[k]);
  }
  d.reputation = clamp(overall(d.attrs) - 20 + rng.normal() * 6, 5, 95);
  return d;
}

/**
 * Probabilità di ritiro a fine stagione. Cresce con l'età e con l'essere senza
 * sedile; a 40 anni è certa.
 */
export function retirementChance(d: Driver): number {
  if (d.age >= 40) return 1;
  let p = d.age >= 33 ? (d.age - 32) * 0.2 : 0;
  if (!d.teamId && d.age > 26) p += 0.45;
  if (!d.teamId && d.age <= 26) p += 0.12;
  return clamp(p, 0, 1);
}

/**
 * Invecchiamento di fine stagione.
 *
 * Ogni attributo ha il proprio picco: i riflessi se ne vanno a ventisei anni,
 * il feedback tecnico continua a crescere fino a trentatré. Un trentaquattrenne
 * non è un ventiseienne peggiore — è un pilota diverso.
 */
export function applyAging(d: Driver, rng: Rng): void {
  d.age += 1;

  for (const k of ATTRIBUTE_KEYS) {
    const profile = ATTRIBUTE_PROFILE[k];
    if (!profile.physical || d.age <= profile.peakAge) continue;
    const yearsPast = d.age - profile.peakAge;
    // Il calo accelera, ma con calma: a trentatré anni un pilota deve essere
    // ancora in griglia, altrimenti la carriera dura otto stagioni e il
    // campionato non ha memoria.
    const decline = (0.5 + yearsPast * 0.22) * (0.85 + rng.next() * 0.3);
    d.attrs[k] = clamp(d.attrs[k] - decline, 25, 99);
  }

  d.experience = clamp(d.experience + experienceGain(d) * 24, 0, 1000);
  // Una stagione lascia il segno, ma l'inverno serve a questo.
  d.fatigue = clamp(d.fatigue * 0.35, 0, 100);
}
