import type { AttributeKey, Driver } from './types.js';
import { clamp } from './curves.js';

/**
 * L'albero delle abilità del pilota.
 *
 * È il posto dove finisce quello che un pilota impara correndo, e che nessun
 * allenamento settimanale può dare: non punti in più ma **regole diverse**.
 * Un nodo alza un tetto, uno cambia il degrado delle gomme, uno rende un
 * sorpasso più probabile. È la stessa scelta di progetto dello staff
 * personale — «alza i tetti, non i punteggi» — applicata alla carriera.
 *
 * I rami sono sei e lineari: tre nodi in fila ciascuno. Un albero ramificato
 * starebbe bene su uno schermo grande, ma in 390 px di altezza diventerebbe
 * illeggibile, e la scelta vera resta comunque *quale ramo* percorrere prima.
 *
 * Il giocatore spende i punti a mano; l'IA li spende da sola sul ramo in cui
 * è già forte. Ogni decisione del giocatore ha una sua versione IA, o la
 * griglia si squilibrerebbe a favore di chi è controllato da una persona.
 */

export type BranchKey = 'pace' | 'tyres' | 'racecraft' | 'starts' | 'wet' | 'mind';

export interface SkillNode {
  id: string;
  branch: BranchKey;
  /** posizione nel ramo, 0-based: si sblocca solo dopo il precedente */
  tier: number;
  name: string;
  /** cosa cambia in pista, in una riga */
  effect: string;
  cost: number;
  bonus: Partial<SkillEffects>;
}

export interface SkillEffects {
  /** punti aggiunti al tetto di un attributo */
  caps: Partial<Record<AttributeKey, number>>;
  /** moltiplicatore della crescita settimanale */
  growth: number;
  /** moltiplicatore del degrado gomme: sotto 1 è un guadagno */
  tyreWear: number;
  /** punti di abilità in più quando si attacca (non quando si difende) */
  overtake: number;
  /** punti in più sulle partenze */
  start: number;
  /** bonus di guida sul bagnato, in punti di attributo effettivi */
  wet: number;
  /** punti di stanchezza recuperati in più ogni settimana */
  recovery: number;
}

export const NO_EFFECTS: SkillEffects = {
  caps: {}, growth: 1, tyreWear: 1, overtake: 0, start: 0, wet: 0, recovery: 0,
};

export const BRANCHES: { key: BranchKey; name: string; hint: string }[] = [
  { key: 'pace', name: 'Velocità', hint: 'Il giro secco' },
  { key: 'tyres', name: 'Gomme', hint: 'Far durare la mescola' },
  { key: 'racecraft', name: 'Sorpasso', hint: 'Prendere posizioni' },
  { key: 'starts', name: 'Partenze', hint: 'I primi duecento metri' },
  { key: 'wet', name: 'Bagnato', hint: 'Quando piove' },
  { key: 'mind', name: 'Testa', hint: 'Tenuta e metodo' },
];

/** Costi per livello: il terzo nodo di un ramo costa come i primi due insieme. */
const COST = [1, 2, 3];

export const SKILL_TREE: readonly SkillNode[] = [
  { id: 'pace1', branch: 'pace', tier: 0, name: 'Giro secco', cost: COST[0]!,
    effect: '+2 al tetto di velocità pura', bonus: { caps: { speed: 2 } } },
  { id: 'pace2', branch: 'pace', tier: 1, name: 'Lettura del cordolo', cost: COST[1]!,
    effect: '+2 al tetto, e la velocità cresce più in fretta',
    bonus: { caps: { speed: 2 }, growth: 1.06 } },
  { id: 'pace3', branch: 'pace', tier: 2, name: 'Fenomeno in qualifica', cost: COST[2]!,
    effect: '+3 al tetto di velocità e +2 di freddezza',
    bonus: { caps: { speed: 3, composure: 2 } } },

  { id: 'tyre1', branch: 'tyres', tier: 0, name: 'Mano leggera', cost: COST[0]!,
    effect: 'Degrado gomme −5%', bonus: { tyreWear: 0.95 } },
  { id: 'tyre2', branch: 'tyres', tier: 1, name: 'Finestra termica', cost: COST[1]!,
    effect: 'Degrado −6% e +2 al tetto di gestione gomme',
    bonus: { tyreWear: 0.94, caps: { tyres: 2 } } },
  { id: 'tyre3', branch: 'tyres', tier: 2, name: 'Stint lunghi', cost: COST[2]!,
    effect: 'Degrado −8% e +3 al tetto di gestione gomme',
    bonus: { tyreWear: 0.92, caps: { tyres: 3 } } },

  { id: 'race1', branch: 'racecraft', tier: 0, name: 'Staccata tardi', cost: COST[0]!,
    effect: 'Sorpassi più probabili', bonus: { overtake: 4 } },
  { id: 'race2', branch: 'racecraft', tier: 1, name: 'Uso della scia', cost: COST[1]!,
    effect: 'Sorpassi ancora più probabili', bonus: { overtake: 6 } },
  { id: 'race3', branch: 'racecraft', tier: 2, name: 'Ruota a ruota', cost: COST[2]!,
    effect: 'Sorpassi molto più probabili, +2 di freddezza',
    bonus: { overtake: 8, caps: { composure: 2 } } },

  { id: 'start1', branch: 'starts', tier: 0, name: 'Stacco di frizione', cost: COST[0]!,
    effect: '+3 al tetto di partenze', bonus: { caps: { starts: 3 } } },
  { id: 'start2', branch: 'starts', tier: 1, name: 'Riflessi al semaforo', cost: COST[1]!,
    effect: '+3 al tetto e più spunto al semaforo',
    bonus: { caps: { starts: 3 }, start: 2 } },
  { id: 'start3', branch: 'starts', tier: 2, name: 'Prima curva', cost: COST[2]!,
    effect: '+4 al tetto e molto più spunto al semaforo',
    bonus: { caps: { starts: 4 }, start: 4 } },

  { id: 'wet1', branch: 'wet', tier: 0, name: 'Sensibilità', cost: COST[0]!,
    effect: '+3 al tetto di guida sul bagnato', bonus: { caps: { wet: 3 } } },
  { id: 'wet2', branch: 'wet', tier: 1, name: 'Linea asciutta', cost: COST[1]!,
    effect: '+3 al tetto e più passo quando piove',
    bonus: { caps: { wet: 3 }, wet: 3 } },
  { id: 'wet3', branch: 'wet', tier: 2, name: 'Uomo pioggia', cost: COST[2]!,
    effect: '+4 al tetto e molto più passo quando piove',
    bonus: { caps: { wet: 4 }, wet: 5 } },

  { id: 'mind1', branch: 'mind', tier: 0, name: 'Recupero', cost: COST[0]!,
    effect: '2 punti di stanchezza in meno ogni settimana', bonus: { recovery: 2 } },
  { id: 'mind2', branch: 'mind', tier: 1, name: 'Metodo di lavoro', cost: COST[1]!,
    effect: 'Tutti gli attributi crescono più in fretta', bonus: { growth: 1.1 } },
  { id: 'mind3', branch: 'mind', tier: 2, name: 'Sangue freddo', cost: COST[2]!,
    effect: '+3 di freddezza e +3 di costanza',
    bonus: { caps: { composure: 3, consistency: 3 } } },
];

const BY_ID = new Map(SKILL_TREE.map((n) => [n.id, n]));

export function skillNode(id: string): SkillNode | undefined {
  return BY_ID.get(id);
}

/** Il nodo che precede questo nello stesso ramo, se c'è. */
export function prerequisiteOf(node: SkillNode): SkillNode | undefined {
  return SKILL_TREE.find((n) => n.branch === node.branch && n.tier === node.tier - 1);
}

export type UnlockRefusal = 'già sbloccata' | 'punti insufficienti' | 'manca il nodo precedente';

/** Perché non si può sbloccare, o `null` se si può. */
export function unlockRefusal(d: Driver, node: SkillNode): UnlockRefusal | null {
  if (d.perks.includes(node.id)) return 'già sbloccata';
  const before = prerequisiteOf(node);
  if (before && !d.perks.includes(before.id)) return 'manca il nodo precedente';
  if (d.skillPoints < node.cost) return 'punti insufficienti';
  return null;
}

export function unlockSkill(d: Driver, id: string): boolean {
  const node = BY_ID.get(id);
  if (!node || unlockRefusal(d, node) !== null) return false;
  d.skillPoints -= node.cost;
  d.perks.push(node.id);
  return true;
}

/**
 * La somma di quello che un pilota ha sbloccato.
 *
 * I moltiplicatori si moltiplicano fra loro e i bonus si sommano: due nodi
 * che riducono il degrado del 5% e del 6% lasciano l'89% del degrado, non
 * l'89% per caso ma perché è così che si compongono due miglioramenti
 * indipendenti.
 */
export function skillEffects(d: Driver): SkillEffects {
  const out: SkillEffects = { ...NO_EFFECTS, caps: {} };
  for (const id of d.perks) {
    const node = BY_ID.get(id);
    if (!node) continue;
    const b = node.bonus;
    for (const [key, value] of Object.entries(b.caps ?? {}) as [AttributeKey, number][]) {
      out.caps[key] = (out.caps[key] ?? 0) + value;
    }
    if (b.growth) out.growth *= b.growth;
    if (b.tyreWear) out.tyreWear *= b.tyreWear;
    out.overtake += b.overtake ?? 0;
    out.start += b.start ?? 0;
    out.wet += b.wet ?? 0;
    out.recovery += b.recovery ?? 0;
  }
  return out;
}

/** Il tetto effettivo di un attributo: quello di nascita più le abilità. */
export function effectiveCap(d: Driver, attr: AttributeKey, effects?: SkillEffects): number {
  const bonus = (effects ?? skillEffects(d)).caps[attr] ?? 0;
  return clamp(d.caps[attr] + bonus, 1, 99);
}

/**
 * I punti guadagnati da un weekend.
 *
 * Li dà il **mestiere**, non il palmarès: un punto ogni sei gare, uguale per
 * tutti. Legarli ai risultati sembrava giusto e invece innescava un ciclo —
 * chi vince prende più punti, sblocca più nodi, vince di più — che in una
 * simulazione da quarant'anni produceva una dinastia. Vincere paga già in
 * macchina migliore e contratti migliori: non deve pagare anche qui.
 *
 * Al ritmo di quattro punti a stagione un albero da trentasei si completa in
 * nove anni, cioè verso la fine di una carriera tipica.
 */
export function pointsForRace(startNumber: number): number {
  return startNumber % 6 === 0 ? 1 : 0;
}

/** I punti di fine stagione: il titolo vale quanto mezzo ramo. */
export const POINTS_FOR_TITLE = 3;

/**
 * Come li spende un pilota gestito dal computer.
 *
 * Sul ramo che rispecchia il suo punto di forza, dal basso verso l'alto: chi
 * è veloce diventa più veloce. Non è la strategia migliore possibile ed è
 * voluto — se l'IA giocasse l'albero meglio del giocatore, l'albero non
 * sarebbe una scelta ma un compito.
 */
const BRANCH_ATTRIBUTE: Record<BranchKey, AttributeKey> = {
  pace: 'speed', tyres: 'tyres', racecraft: 'composure',
  starts: 'starts', wet: 'wet', mind: 'consistency',
};

export function spendPointsAsAi(d: Driver): void {
  const ranked = BRANCHES
    .map((b) => ({ key: b.key, value: d.attrs[BRANCH_ATTRIBUTE[b.key]] }))
    .sort((a, b) => b.value - a.value);

  let spent = true;
  while (spent && d.skillPoints > 0) {
    spent = false;
    for (const branch of ranked) {
      const next = SKILL_TREE
        .filter((n) => n.branch === branch.key && !d.perks.includes(n.id))
        .sort((a, b) => a.tier - b.tier)[0];
      if (next && unlockRefusal(d, next) === null) {
        unlockSkill(d, next.id);
        spent = true;
        break;
      }
    }
  }
}
