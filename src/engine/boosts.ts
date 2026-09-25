import type { Driver, Project, Team } from './types.js';
import { canAfford, spend, type Wallet } from './wallet.js';
import { weeklyCost } from './projects.js';

/**
 * Dove finiscono le valute, e quanto possono spostare.
 *
 * ## Il problema, detto chiaro
 *
 * Questo è un gioco per una persona sola, e una valuta che si compra con soldi
 * veri in un gioco per una persona sola è per definizione una scorciatoia:
 * non toglie niente a nessun altro, ma toglie qualcosa a chi la usa. Il
 * bilanciamento della carriera è tarato su una scuderia che **non spende un
 * gettone** — è quello che misura `npm run check:team` — e ogni cosa qui
 * dentro è un modo di arrivarci prima, non di arrivare più in alto.
 *
 * Da qui i tre limiti, che non sono pudore ma ingegneria: senza, la curva
 * misurata non descriverebbe più nessuno.
 *
 * 1. **I crediti entrano in cassa, non nel bilancio.** Comprano settimane di
 *    sviluppo, che è la risorsa lenta. Non alzano il premio di classifica né
 *    gli sponsor, quindi non cambiano quanto la scuderia guadagna da sola.
 * 2. **I gettoni abilità danno punti, non nodi.** Un punto vale come cinque
 *    gran premi corsi; i nodi restano da sbloccare in ordine, e il tetto degli
 *    attributi non si muove.
 * 3. **I gettoni ricerca tolgono settimane, non costi.** Il progetto va
 *    pagato lo stesso, fino all'ultimo euro: quello che si compra è il tempo,
 *    e non si può far consegnare un progetto il giorno in cui si apre.
 */

/** Quanti crediti servono per un milione in cassa. Uno a uno: è un euro. */
export function creditInjection(credits: number): number {
  return Math.max(0, Math.floor(credits));
}

/**
 * Versa crediti nella cassa della scuderia.
 *
 * Il taglio minimo esiste perché un versamento da centomila euro non è una
 * decisione, è un clic: con un milione alla volta la scelta è se valga la pena
 * adesso o fra due settimane.
 */
export const MIN_INJECTION = 1_000_000;

export function injectCash(wallet: Wallet, team: Team, credits: number): boolean {
  const amount = creditInjection(credits);
  if (amount < MIN_INJECTION) return false;
  if (!spend(wallet, { credits: amount })) return false;
  team.cash += amount;
  return true;
}

/**
 * Quanto vale un gettone abilità, in punti.
 *
 * Uno. Un punto abilità si guadagna correndo cinque gran premi, quindi un
 * gettone vale un mese e mezzo di stagione — abbastanza da sentirsi, poco
 * abbastanza da non rendere inutile il correre.
 */
export const POINTS_PER_SKILL_TOKEN = 1;

export function convertSkillTokens(wallet: Wallet, driver: Driver, tokens: number): boolean {
  const n = Math.max(0, Math.floor(tokens));
  if (n === 0 || !spend(wallet, { skill: n })) return false;
  driver.skillPoints += n * POINTS_PER_SKILL_TOKEN;
  return true;
}

/**
 * Quante settimane toglie un gettone ricerca.
 *
 * Due, e mai fino a zero: un progetto deve restare aperto almeno una
 * settimana dopo che gli hai buttato addosso tutti i gettoni che hai. È il
 * limite che impedisce di comprare un progetto maggiore e vederlo consegnato
 * lo stesso pomeriggio, che è esattamente il momento in cui il giocatore
 * smette di avere qualcosa da decidere.
 */
export const WEEKS_PER_RESEARCH_TOKEN = 2;

/** Quanti gettoni può accettare ancora questo progetto. */
export function researchRoom(project: Project): number {
  return Math.max(0, Math.floor((project.weeksLeft - 1) / WEEKS_PER_RESEARCH_TOKEN));
}

/**
 * Quanto costa in euro accorciare, oltre ai gettoni.
 *
 * Le settimane saltate si pagano subito. È la parte che rende vera la frase
 * «il gettone compra tempo, non lavoro»: senza, tagliare le settimane
 * taglierebbe anche le rate, e un progetto maggiore accorciato costerebbe la
 * metà di uno portato a termine. Sarebbe uno sconto travestito da fretta.
 */
export function rushCost(project: Project, tokens: number): number {
  const weeks = Math.min(
    Math.max(0, Math.floor(tokens)) * WEEKS_PER_RESEARCH_TOKEN,
    Math.max(0, project.weeksLeft - 1),
  );
  return Math.round(weeklyCost(project) * weeks);
}

export function rushRefusal(
  wallet: Wallet, team: Team, project: Project, tokens: number,
): string | null {
  const n = Math.max(0, Math.floor(tokens));
  if (n === 0) return 'Nessun gettone da usare';
  if (researchRoom(project) === 0) return 'Il progetto è troppo vicino alla consegna';
  if (n > researchRoom(project)) return `Al massimo ${researchRoom(project)} su questo progetto`;
  if (!canAfford(wallet, { research: n })) return 'Non hai abbastanza gettoni ricerca';
  const cost = rushCost(project, n);
  if (team.cash < cost) {
    return `Servono anche ${(cost / 1_000_000).toFixed(1)} milioni in cassa`;
  }
  return null;
}

/**
 * Accorcia un progetto. Il lavoro saltato si paga subito, per intero: il
 * gettone compra tempo, non lavoro.
 */
export function rushProject(
  wallet: Wallet, team: Team, project: Project, tokens: number,
): boolean {
  if (rushRefusal(wallet, team, project, tokens) !== null) return false;
  const n = Math.floor(tokens);
  const cost = rushCost(project, n);
  spend(wallet, { research: n });
  team.cash -= cost;
  project.spent += cost;
  project.weeksLeft = Math.max(1, project.weeksLeft - n * WEEKS_PER_RESEARCH_TOKEN);
  return true;
}
