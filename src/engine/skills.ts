import type { AttributeKey, Driver } from './types.js';
import { clamp } from './curves.js';

/**
 * L'albero delle abilità del pilota.
 *
 * È il posto dove finisce quello che un pilota impara correndo, e che nessun
 * allenamento settimanale può dare: non punti in più ma **regole diverse**.
 * Un nodo alza un tetto, uno cambia il degrado delle gomme, uno rende un
 * sorpasso più probabile, uno fa sì che il muretto ascolti quando parli.
 *
 * Quattro aree. Tre riguardano la guida — il passo, la macchina, la testa — e
 * una riguarda il mestiere fuori dall'abitacolo: stampa, sponsor, rapporto
 * con gli ingegneri. Un pilota non è solo uno che guida, e un albero che
 * dimenticasse quella metà racconterebbe metà carriera.
 *
 * Ogni area è un grafo, non una fila: dal nodo di base partono due strade, e
 * in fondo un nodo chiede di aver percorso **entrambi** i rami interni. È la
 * forma che rende la scelta costosa — puoi prendere in fretta la punta di un
 * ramo, o andare largo e arrivare al nodo finale molto più tardi.
 *
 * Il giocatore spende i punti a mano; l'IA li spende da sola. Ogni decisione
 * del giocatore ha una sua versione IA, o la griglia resterebbe indietro
 * rispetto a chi è al volante di una persona.
 */

export type BranchKey = 'pace' | 'car' | 'mind' | 'career';

export interface SkillNode {
  id: string;
  branch: BranchKey;
  name: string;
  /** cosa cambia, in una riga */
  effect: string;
  cost: number;
  /** tutti questi vanno sbloccati prima; vuoto per il nodo di base */
  requires: string[];
  /** posizione nel grafo dell'area: colonna 0–3 (anche a metà), riga 0–3 */
  col: number;
  row: number;
  bonus: Partial<SkillEffects>;
}

export interface SkillEffects {
  /** punti aggiunti al tetto di un attributo */
  caps: Partial<Record<AttributeKey, number>>;
  /** moltiplicatore della crescita settimanale */
  growth: number;
  /** moltiplicatore del degrado gomme: sotto 1 è un guadagno */
  tyreWear: number;
  /** punti di abilità in più quando si attacca, non quando si difende */
  overtake: number;
  /** punti in più al via */
  start: number;
  /** punti in più di guida sul bagnato */
  wet: number;
  /** punti di stanchezza recuperati in più ogni settimana */
  recovery: number;
  /** moltiplicatore sulla reputazione guadagnata */
  reputation: number;
  /** moltiplicatore sull'ingaggio che ti offrono */
  salary: number;
  /** moltiplicatore sulle entrate da sponsor */
  sponsors: number;
  /** quanto il tuo riscontro accelera lo sviluppo della monoposto */
  development: number;
}

export const NO_EFFECTS: SkillEffects = {
  caps: {}, growth: 1, tyreWear: 1, overtake: 0, start: 0, wet: 0, recovery: 0,
  reputation: 1, salary: 1, sponsors: 1, development: 0,
};

export const BRANCHES: { key: BranchKey; name: string; hint: string }[] = [
  { key: 'pace', name: 'Passo', hint: 'Il giro secco e il sorpasso' },
  { key: 'car', name: 'Macchina', hint: 'Gomme, acqua, assetto' },
  { key: 'mind', name: 'Testa', hint: 'Riflessi, freddezza, tenuta' },
  { key: 'career', name: 'Carriera', hint: 'Stampa, sponsor, muretto' },
];

/** Colonne del grafo di un'area: serve a disegnare i fili. */
export const GRID_COLS = 4;

export const SKILL_TREE: readonly SkillNode[] = [
  // ── Passo ────────────────────────────────────────────────────────────────
  { id: 'pace0', branch: 'pace', name: 'Fondamentali', cost: 1, requires: [], col: 1.5, row: 0,
    effect: '+1 di velocità e +1 di costanza al tetto',
    bonus: { caps: { speed: 1, consistency: 1 } } },
  { id: 'pace1', branch: 'pace', name: 'Giro secco', cost: 2, requires: ['pace0'], col: 0.5, row: 1,
    effect: '+2 al tetto di velocità pura', bonus: { caps: { speed: 2 } } },
  { id: 'pace2', branch: 'pace', name: 'Staccata tardi', cost: 2, requires: ['pace0'], col: 2.5, row: 1,
    effect: 'Sorpassi più probabili', bonus: { overtake: 4 } },
  { id: 'pace3', branch: 'pace', name: 'Lettura del cordolo', cost: 2, requires: ['pace1'], col: 0, row: 2,
    effect: 'Tutti gli attributi crescono un po' + "'" + ' più in fretta', bonus: { growth: 1.05 } },
  { id: 'pace4', branch: 'pace', name: 'Fenomeno in qualifica', cost: 3, requires: ['pace1'], col: 1, row: 2,
    effect: '+3 al tetto di velocità pura', bonus: { caps: { speed: 3 } } },
  { id: 'pace5', branch: 'pace', name: 'Uso della scia', cost: 2, requires: ['pace2'], col: 2, row: 2,
    effect: 'Sorpassi ancora più probabili', bonus: { overtake: 5 } },
  { id: 'pace6', branch: 'pace', name: 'Ruota a ruota', cost: 3, requires: ['pace2'], col: 3, row: 2,
    effect: 'Sorpassi molto più probabili, +2 di freddezza',
    bonus: { overtake: 6, caps: { composure: 2 } } },
  { id: 'pace7', branch: 'pace', name: 'Fuoriclasse', cost: 4, requires: ['pace4', 'pace6'], col: 1.5, row: 3,
    effect: '+3 di velocità e +2 di freddezza al tetto',
    bonus: { caps: { speed: 3, composure: 2 } } },

  // ── Macchina ─────────────────────────────────────────────────────────────
  { id: 'car0', branch: 'car', name: 'Sensibilità meccanica', cost: 1, requires: [], col: 1.5, row: 0,
    effect: '+1 di gestione gomme e +1 di feedback tecnico',
    bonus: { caps: { tyres: 1, technical: 1 } } },
  { id: 'car1', branch: 'car', name: 'Mano leggera', cost: 2, requires: ['car0'], col: 0.5, row: 1,
    effect: 'Degrado gomme −5%', bonus: { tyreWear: 0.95 } },
  { id: 'car2', branch: 'car', name: "Sensibilità all'acqua", cost: 2, requires: ['car0'], col: 2.5, row: 1,
    effect: '+3 al tetto di guida sul bagnato', bonus: { caps: { wet: 3 } } },
  { id: 'car3', branch: 'car', name: 'Finestra termica', cost: 2, requires: ['car1'], col: 0, row: 2,
    effect: 'Degrado −5% e +2 di gestione gomme',
    bonus: { tyreWear: 0.95, caps: { tyres: 2 } } },
  { id: 'car4', branch: 'car', name: 'Stint lunghi', cost: 3, requires: ['car1'], col: 1, row: 2,
    effect: 'Degrado −7% e +3 di gestione gomme',
    bonus: { tyreWear: 0.93, caps: { tyres: 3 } } },
  { id: 'car5', branch: 'car', name: 'Linea asciutta', cost: 2, requires: ['car2'], col: 2, row: 2,
    effect: 'Più passo quando piove', bonus: { wet: 3 } },
  { id: 'car6', branch: 'car', name: 'Uomo pioggia', cost: 3, requires: ['car2'], col: 3, row: 2,
    effect: 'Molto più passo quando piove, +3 al tetto',
    bonus: { wet: 5, caps: { wet: 3 } } },
  { id: 'car7', branch: 'car', name: 'Gestione del weekend', cost: 3, requires: ['car4', 'car5'], col: 1.5, row: 3,
    effect: 'Degrado −4% e +3 di feedback tecnico',
    bonus: { tyreWear: 0.96, caps: { technical: 3 } } },

  // ── Testa ────────────────────────────────────────────────────────────────
  { id: 'mind0', branch: 'mind', name: 'Concentrazione', cost: 1, requires: [], col: 1.5, row: 0,
    effect: '+1 di freddezza e +1 di costanza al tetto',
    bonus: { caps: { composure: 1, consistency: 1 } } },
  { id: 'mind1', branch: 'mind', name: 'Riflessi al semaforo', cost: 2, requires: ['mind0'], col: 0.5, row: 1,
    effect: '+3 al tetto di partenze', bonus: { caps: { starts: 3 } } },
  { id: 'mind2', branch: 'mind', name: 'Sangue freddo', cost: 2, requires: ['mind0'], col: 2.5, row: 1,
    effect: '+3 al tetto di freddezza', bonus: { caps: { composure: 3 } } },
  { id: 'mind3', branch: 'mind', name: 'Prima curva', cost: 3, requires: ['mind1'], col: 0, row: 2,
    effect: '+4 al tetto e molto più spunto al via',
    bonus: { caps: { starts: 4 }, start: 3 } },
  { id: 'mind4', branch: 'mind', name: 'Recupero', cost: 2, requires: ['mind1'], col: 1, row: 2,
    effect: '3 punti di stanchezza in meno ogni settimana', bonus: { recovery: 3 } },
  { id: 'mind5', branch: 'mind', name: 'Gestione della pressione', cost: 2, requires: ['mind2'], col: 2, row: 2,
    effect: '+3 al tetto di costanza', bonus: { caps: { consistency: 3 } } },
  { id: 'mind6', branch: 'mind', name: 'Nervi saldi', cost: 3, requires: ['mind2'], col: 3, row: 2,
    effect: '+4 al tetto di freddezza', bonus: { caps: { composure: 4 } } },
  { id: 'mind7', branch: 'mind', name: 'Metodo di lavoro', cost: 3, requires: ['mind4', 'mind5'], col: 1.5, row: 3,
    effect: 'Tutti gli attributi crescono molto più in fretta', bonus: { growth: 1.12 } },

  // ── Carriera ─────────────────────────────────────────────────────────────
  { id: 'career0', branch: 'career', name: 'Presenza', cost: 1, requires: [], col: 1.5, row: 0,
    effect: 'Costruisci reputazione più in fretta', bonus: { reputation: 1.15 } },
  { id: 'career1', branch: 'career', name: 'Davanti alle telecamere', cost: 2, requires: ['career0'], col: 0.5, row: 1,
    effect: 'Reputazione ancora più in fretta', bonus: { reputation: 1.2 } },
  { id: 'career2', branch: 'career', name: 'Rapporto col muretto', cost: 2, requires: ['career0'], col: 2.5, row: 1,
    effect: '+3 al tetto di feedback tecnico', bonus: { caps: { technical: 3 } } },
  { id: 'career3', branch: 'career', name: 'Sponsor personali', cost: 2, requires: ['career1'], col: 0, row: 2,
    effect: 'Entrate da sponsor +30%', bonus: { sponsors: 1.3 } },
  { id: 'career4', branch: 'career', name: 'Icona', cost: 3, requires: ['career1'], col: 1, row: 2,
    effect: 'Reputazione +25% e ingaggi più ricchi',
    bonus: { reputation: 1.25, salary: 1.15 } },
  { id: 'career5', branch: 'career', name: 'Riscontro che serve', cost: 2, requires: ['career2'], col: 2, row: 2,
    effect: 'La tua scuderia sviluppa la monoposto più in fretta',
    bonus: { development: 0.6 } },
  { id: 'career6', branch: 'career', name: 'Leader tecnico', cost: 3, requires: ['career2'], col: 3, row: 2,
    effect: 'Sviluppo molto più rapido, +3 di feedback tecnico',
    bonus: { development: 1, caps: { technical: 3 } } },
  { id: 'career7', branch: 'career', name: 'Uomo squadra', cost: 4, requires: ['career4', 'career5'], col: 1.5, row: 3,
    effect: 'Ingaggi +20% e sviluppo più rapido',
    bonus: { salary: 1.2, development: 0.8 } },
];

const BY_ID = new Map(SKILL_TREE.map((n) => [n.id, n]));

export function skillNode(id: string): SkillNode | undefined {
  return BY_ID.get(id);
}

/** I nodi che questo richiede, risolti. */
export function prerequisitesOf(node: SkillNode): SkillNode[] {
  return node.requires.map((id) => BY_ID.get(id)).filter((n): n is SkillNode => !!n);
}

export type UnlockRefusal = 'già sbloccata' | 'punti insufficienti' | 'mancano i nodi richiesti';

/** Perché non si può sbloccare, o `null` se si può. */
export function unlockRefusal(d: Driver, node: SkillNode): UnlockRefusal | null {
  if (d.perks.includes(node.id)) return 'già sbloccata';
  if (!node.requires.every((id) => d.perks.includes(id))) return 'mancano i nodi richiesti';
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
 * I moltiplicatori si moltiplicano fra loro e i bonus si sommano: due nodi che
 * riducono il degrado del 5% e del 7% lasciano l'88% del degrado, perché è
 * così che si compongono due miglioramenti indipendenti.
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
    if (b.reputation) out.reputation *= b.reputation;
    if (b.salary) out.salary *= b.salary;
    if (b.sponsors) out.sponsors *= b.sponsors;
    out.overtake += b.overtake ?? 0;
    out.start += b.start ?? 0;
    out.wet += b.wet ?? 0;
    out.recovery += b.recovery ?? 0;
    out.development += b.development ?? 0;
  }
  return out;
}

/** Il tetto effettivo di un attributo: quello di nascita più le abilità. */
export function effectiveCap(d: Driver, attr: AttributeKey, effects?: SkillEffects): number {
  const bonus = (effects ?? skillEffects(d)).caps[attr] ?? 0;
  return clamp(d.caps[attr] + bonus, 1, 99);
}

/** Il costo di tutto l'albero: serve a dire quanto manca. */
export const TOTAL_COST = SKILL_TREE.reduce((s, n) => s + n.cost, 0);

/**
 * I punti guadagnati da un weekend.
 *
 * Li dà il **mestiere**, non il palmarès: uno ogni cinque gare, uguale per
 * tutti. Legarli ai risultati sembrava giusto e invece innescava un ciclo —
 * chi vince prende più punti, sblocca più nodi, vince di più — che in una
 * simulazione da quarant'anni produceva una dinastia. Vincere paga già in
 * macchina migliore e contratti migliori: non deve pagare anche qui.
 *
 * A questo ritmo una carriera lunga arriva a completare l'albero, ma solo
 * quella: chi smette a trent'anni deve scegliere che pilota diventare.
 */
export function pointsForRace(startNumber: number): number {
  return startNumber % 5 === 0 ? 1 : 0;
}

/** I punti di fine stagione: il titolo vale quanto un ramo interno. */
export const POINTS_FOR_TITLE = 3;

/**
 * Come li spende un pilota gestito dal computer.
 *
 * Sceglie l'area che rispecchia il suo punto di forza e dentro quella prende
 * sempre il nodo disponibile più economico. Non è la strategia migliore
 * possibile ed è voluto: se l'IA giocasse l'albero meglio del giocatore,
 * l'albero non sarebbe una scelta ma un compito.
 */
const BRANCH_ATTRIBUTE: Record<BranchKey, AttributeKey> = {
  pace: 'speed', car: 'tyres', mind: 'composure', career: 'technical',
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
        .filter((n) => n.branch === branch.key && unlockRefusal(d, n) === null)
        .sort((a, b) => a.cost - b.cost || a.row - b.row)[0];
      if (next) {
        unlockSkill(d, next.id);
        spent = true;
        break;
      }
    }
  }
}
