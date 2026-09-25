import type { Team, World } from './types.js';
import { clamp, createRng, hashSeed, type Rng } from './rng.js';
import { carPace } from './regulations.js';
import { constructorStandings } from './season.js';

/**
 * Sponsor e investitori: le due entrate che si scelgono.
 *
 * Prima gli sponsor erano una funzione del prestigio — un numero che arrivava
 * e basta. Funzionava, ma non era una decisione: il giocatore non poteva né
 * sbagliarla né azzeccarla. Adesso sono **contratti**, con durata e
 * scaglionamento, e ogni tanto scadono e se ne firma un altro.
 *
 * ## Due forme diverse, di proposito
 *
 * - Lo **sponsor** paga e basta. Sceglierlo è un compromesso fra quanto paga
 *   e per quanto tempo ti lega: tre stagioni al valore di oggi sono un
 *   affare se stai per salire, una zavorra se stai per crollare.
 * - L'**investitore** versa subito una somma e ne promette un'altra **se**
 *   centri un obiettivo entro la scadenza. È l'unica entrata del gioco che
 *   si può fallire, ed è quello che la rende una scommessa invece di un
 *   incasso.
 *
 * ## Perché resta una base automatica
 *
 * Senza sponsor firmato una scuderia incassa comunque `BASE_SHARE` di quello
 * che incasserebbe: sono gli sponsor minori, quelli che non si negoziano. È
 * una rete, e serve a una cosa precisa — un giocatore che non apre mai il
 * bilancio non deve trovarsi in bancarotta per una schermata che non ha
 * visto. Il contratto firmato vale molto di più, e quello è l'incentivo.
 */

/** Quanto incassa chi non ha firmato niente, in frazione del valore pieno. */
export const BASE_SHARE = 0.45;

/** Il valore di riferimento degli sponsor di una scuderia, per stagione. */
export function sponsorValue(prestige: number): number {
  return Math.round((clamp(prestige, 0, 100) / 100) * 24_000_000);
}

export interface SponsorDeal {
  id: string;
  name: string;
  /** durata in stagioni */
  seasons: number;
  /** quanto paga per stagione */
  perSeason: number;
  /** stagioni ancora da incassare; a zero il contratto è finito */
  seasonsLeft: number;
}

/** I marchi che compaiono come sponsor. Inventati, come tutto il resto. */
const SPONSOR_NAMES = [
  'Meridiana Energia', 'Kortek Systems', 'Vallebruna Group', 'Arcadia Tyres',
  'Nordlys Bank', 'Ferrovia Sud', 'Okada Precision', 'Lumen Telecom',
  'Aurum Assicurazioni', 'Praxis Logistica', 'Sentinella Sicurezza', 'Bosco Verde',
];

/**
 * Le offerte sul tavolo.
 *
 * Deterministiche: dipendono da scuderia e anno, non da quando si apre la
 * schermata. Rigenerarle a ogni apertura vorrebbe dire che basta chiudere e
 * riaprire finché non esce l'offerta buona, e a quel punto la scelta non
 * esiste più.
 *
 * Il compromesso è costruito apposta: chi paga di più lega per meno tempo, e
 * viceversa. Un contratto lungo al valore di oggi è un affare se stai per
 * salire e una zavorra se stai per crollare — ed è il giocatore a doverlo
 * indovinare.
 */
export function sponsorOffers(world: World, team: Team): SponsorDeal[] {
  const rng = createRng(hashSeed(`sponsor:${team.id}:${world.year}`, world.seed));
  const base = sponsorValue(team.prestige);

  return [1, 2, 3].map((seasons, i) => {
    // Un anno solo paga il 20% in più, tre anni il 15% in meno.
    const premium = [1.2, 1.0, 0.85][i]!;
    const luck = rng.range(0.9, 1.12);
    return {
      id: `${team.id}-${world.year}-${seasons}`,
      name: SPONSOR_NAMES[rng.int(0, SPONSOR_NAMES.length - 1)]!,
      seasons,
      perSeason: Math.round(base * premium * luck),
      seasonsLeft: seasons,
    };
  });
}

export function signSponsor(team: Team, deal: SponsorDeal): void {
  team.sponsor = { ...deal, seasonsLeft: deal.seasons };
}

/** Quanto incassa in sponsor questa stagione. */
export function sponsorIncome(team: Team): number {
  if (team.sponsor && team.sponsor.seasonsLeft > 0) return team.sponsor.perSeason;
  return Math.round(sponsorValue(team.prestige) * BASE_SHARE);
}

/* ------------------------------------------------------------------ */
/* Investitori                                                         */
/* ------------------------------------------------------------------ */

export type InvestorGoal =
  | { kind: 'posizione'; target: number }
  | { kind: 'passo'; target: number }
  | { kind: 'vittorie'; target: number }
  | { kind: 'punti'; target: number };

export interface InvestorDeal {
  id: string;
  name: string;
  /** versato subito, alla firma */
  upfront: number;
  goal: InvestorGoal;
  /** pagato a fine stagione se l'obiettivo è centrato */
  bonus: number;
  /** anno in cui si tirano le somme */
  year: number;
  status: 'aperto' | 'riuscito' | 'fallito';
}

const INVESTOR_NAMES = [
  'Kalder Capital', 'Monteverde Holding', 'Arclight Partners',
  'Fondo Tramontana', 'Osprey Ventures', 'Caldera Invest',
];

export function goalText(goal: InvestorGoal): string {
  switch (goal.kind) {
    case 'posizione': return `Chiudi la stagione fra le prime ${goal.target} scuderie.`;
    case 'passo': return `Porta il passo della monoposto a ${goal.target}.`;
    case 'vittorie': return `Vinci ${goal.target} gran ${goal.target === 1 ? 'premio' : 'premi'}.`;
    case 'punti': return `Somma ${goal.target} punti nel campionato costruttori.`;
  }
}

/**
 * Le proposte degli investitori.
 *
 * Gli obiettivi sono tarati su dove la scuderia sta **adesso**: chiedere il
 * podio a chi è nono non è una scommessa, è un no. Tre proposte con difficoltà
 * crescente, e il bonus cresce con la difficoltà — la scelta è quanto ti fidi
 * di te stesso.
 */
export function investorOffers(world: World, team: Team): InvestorDeal[] {
  const rng = createRng(hashSeed(`investitore:${team.id}:${world.year}`, world.seed));
  const teams = Object.values(world.teams);
  const table = constructorStandings(world);
  const rank = table.findIndex((c) => c.teamId === team.id) + 1;
  const here = rank > 0 ? rank : teams.length;
  const pace = carPace(team.car);
  const scale = 1 + team.prestige / 100;

  const goals: InvestorGoal[] = [
    { kind: 'posizione', target: Math.max(1, here - 1) },
    { kind: 'passo', target: Math.round(pace + 2) },
    here <= 5
      ? { kind: 'vittorie', target: 1 }
      : { kind: 'punti', target: Math.max(10, Math.round(here * 6)) },
  ];

  return goals.map((goal, i) => ({
    id: `${team.id}-${world.year}-inv${i}`,
    name: INVESTOR_NAMES[rng.int(0, INVESTOR_NAMES.length - 1)]!,
    upfront: Math.round(2_500_000 * scale * rng.range(0.85, 1.15)),
    goal,
    // Più l'obiettivo è lontano, più vale.
    bonus: Math.round(4_000_000 * scale * (1 + i * 0.45) * rng.range(0.9, 1.1)),
    year: world.year,
    status: 'aperto',
  }));
}

/** Firma: il versamento iniziale entra subito in cassa. */
export function signInvestor(team: Team, deal: InvestorDeal): void {
  team.investor = { ...deal, status: 'aperto' };
  team.cash += deal.upfront;
}

/** L'obiettivo è stato centrato? Si valuta a stagione chiusa. */
export function goalMet(world: World, team: Team, goal: InvestorGoal): boolean {
  switch (goal.kind) {
    case 'posizione': {
      const rank = constructorStandings(world).findIndex((c) => c.teamId === team.id) + 1;
      return rank > 0 && rank <= goal.target;
    }
    case 'passo':
      return carPace(team.car) >= goal.target;
    case 'vittorie': {
      let wins = 0;
      for (const weekend of world.results) {
        const winner = weekend.race.find((r) => !r.dnf && r.position === 1);
        if (winner && team.driverIds.includes(winner.driverId)) wins += 1;
      }
      return wins >= goal.target;
    }
    case 'punti':
      return (world.constructorStandings[team.id] ?? 0) >= goal.target;
  }
}

export interface InvestorOutcome {
  met: boolean;
  bonus: number;
}

/**
 * Chiude i conti con l'investitore, a fine stagione.
 *
 * Fallire non costa niente oltre al bonus mancato. È una scelta: una penale
 * renderebbe l'investitore una cosa da evitare, e una cosa da evitare non è
 * una decisione — è una trappola.
 */
export function settleInvestor(world: World, team: Team): InvestorOutcome | null {
  const deal = team.investor;
  if (!deal || deal.status !== 'aperto') return null;

  const met = goalMet(world, team, deal.goal);
  deal.status = met ? 'riuscito' : 'fallito';
  if (met) team.cash += deal.bonus;
  return { met, bonus: met ? deal.bonus : 0 };
}

/** Scala di una stagione i contratti in corso, e chiude quelli finiti. */
export function ageDeals(team: Team): void {
  if (team.sponsor) {
    team.sponsor.seasonsLeft -= 1;
    if (team.sponsor.seasonsLeft <= 0) team.sponsor = null;
  }
  // L'investitore dura una stagione: chiuso il conto, il posto torna libero.
  if (team.investor && team.investor.status !== 'aperto') team.investor = null;
}

/**
 * Cosa firma una scuderia gestita dal computer.
 *
 * Prende lo sponsor che rende di più sulla durata intera e l'investitore con
 * l'obiettivo più vicino — che è la scelta prudente, e va bene così: se l'IA
 * scommettesse meglio del giocatore, scommettere non varrebbe la pena.
 */
export function aiSignDeals(world: World, team: Team, rng: Rng): void {
  if (!team.sponsor) {
    const best = sponsorOffers(world, team)
      .sort((a, b) => b.perSeason * b.seasons - a.perSeason * a.seasons)[0];
    if (best) signSponsor(team, best);
  }
  if (!team.investor) {
    const offers = investorOffers(world, team);
    // Non tutte firmano, e non tutte lo stesso anno: una griglia in cui ogni
    // scuderia ha sempre un investitore è una griglia senza scelte.
    if (rng.chance(0.65) && offers[0]) signInvestor(team, offers[0]);
  }
}
