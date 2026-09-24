import type { Driver, Team, World } from './types.js';
import { CAR_KEYS } from './types.js';
import { clamp, createRng, hashSeed, type Rng } from './rng.js';
import { createWorld } from './world.js';
import { marketScale, marketValue, rankIn, SEATS_PER_TEAM } from './market.js';
import { BUDGET_CAP } from './regulations.js';
import { constructorStandings } from './season.js';
import { entourageEfficiency } from './staff.js';

/**
 * Fondare una scuderia, e tenerla in piedi.
 *
 * Il gioco ha una modalità sola: si entra in Formula 1 da ultimi, con una
 * macchina che non va, nessun pilota sotto contratto e i soldi che si hanno.
 * Tutto il resto — chi ingaggi, quali reparti mandi al lavoro, quanto ti puoi
 * permettere di aspettare — discende da lì.
 */

/**
 * La monoposto con cui si comincia.
 *
 * Sei punti sotto l'ultima della griglia. Non è cattiveria: è il punto di
 * partenza che rende leggibile tutto il resto, perché la prima cosa che il
 * giocatore vede succedere è la macchina che sale. L'affidabilità parte meno
 * indietro — un telaio nuovo è lento, non fragile, e ritirarsi ogni domenica
 * non insegnerebbe niente.
 *
 * Dodici punti sotto, che era il primo valore, non funzionava: il bilancio di
 * una scuderia ultima classificata compra due aggiornamenti all'anno, e con
 * quelli non si recuperano dodici punti su una griglia che si muove. La sonda
 * mostrava otto stagioni tutte al nono posto.
 */
export const ROOKIE_CAR = { aero: 64, engine: 65, chassis: 63, reliability: 70 } as const;

/** Il reparto tecnico di una squadra che si è appena formata. */
export const ROOKIE_CREW = { technical: 44, trackEngineer: 42, pitCrew: 40 } as const;

/** Nessuno ti conosce. Il prestigio è la prima cosa da costruire. */
export const ROOKIE_PRESTIGE = 14;

/**
 * La cassa di partenza, che è anche la difficoltà.
 *
 * Non è un moltiplicatore nascosto: è il numero di settimane di sviluppo che
 * puoi permetterti prima che comincino a entrare i premi di fine stagione. A
 * quaranta milioni si compra un progetto maggiore e poco altro; a centoventi
 * si tengono due reparti al lavoro per tutto il primo anno.
 */
export const START_CASH = {
  garage: 40_000_000,
  indipendente: 75_000_000,
  costruttore: 120_000_000,
} as const;

export type StartBudget = keyof typeof START_CASH;

export interface StartTeamOptions {
  seed: number;
  name: string;
  short: string;
  colour: string;
  budget: StartBudget;
  year?: number;
  races?: number;
}

export const PLAYER_TEAM_ID = 'player';

/** Crea il mondo e ci aggiunge la scuderia del giocatore, nona in griglia. */
export function startTeam(opts: StartTeamOptions): World {
  const world = createWorld({
    seed: opts.seed,
    ...(opts.year !== undefined ? { year: opts.year } : {}),
    ...(opts.races !== undefined ? { races: opts.races } : {}),
  });

  const name = opts.name.trim() || 'Nuova Scuderia';
  const team: Team = {
    id: PLAYER_TEAM_ID,
    name,
    short: (opts.short.trim() || name).slice(0, 10),
    colour: opts.colour,
    car: { ...ROOKIE_CAR },
    budget: Math.round(BUDGET_CAP * 0.84),
    cash: START_CASH[opts.budget],
    prestige: ROOKIE_PRESTIGE,
    crew: { ...ROOKIE_CREW },
    driverIds: [],
    projects: [],
    founded: true,
  };

  world.teams[team.id] = team;
  world.constructorStandings[team.id] = 0;
  world.seat = { mode: 'scuderia', teamId: team.id };
  return world;
}

/** La scuderia del giocatore, se c'è. */
export function playerTeam(world: World): Team | null {
  return world.seat.mode === 'scuderia' ? world.teams[world.seat.teamId] ?? null : null;
}

export function isPlayerTeam(world: World, teamId: string | null | undefined): boolean {
  return world.seat.mode === 'scuderia' && world.seat.teamId === teamId;
}

/**
 * Chi segue i piloti di una scuderia.
 *
 * In Modalità Pilota erano allenatore, preparatore e fisioterapista assunti
 * dal pilota stesso. Adesso che si gestisce una squadra è la squadra a
 * metterceli: il prestigio porta i professionisti, il reparto tecnico li fa
 * lavorare bene. È anche il motivo per cui un giovane cresce più in fretta in
 * una scuderia strutturata — e quindi perché vale la pena costruirsela.
 */
export function teamCoaching(team: Team): number {
  return entourageEfficiency(team.prestige) * (0.88 + (team.crew.technical / 100) * 0.26);
}

/* ------------------------------------------------------------------ */
/* Il mercato, dal lato di chi ingaggia                                */
/* ------------------------------------------------------------------ */

export interface Terms {
  years: number;
  salary: number;
  role: 'prima' | 'seconda';
}

/**
 * Quanto chiede un pilota per guidare **per questa** scuderia.
 *
 * Due pezzi. Il primo è quanto vale sul mercato, e non dipende da chi offre.
 * Il secondo è il sovrapprezzo: un pilota che in griglia sta più in alto della
 * squadra che lo chiama vuole essere pagato per scendere, e più è ampio il
 * salto più costa. È il motivo per cui una scuderia nuova può comunque
 * ingaggiare qualcuno di buono — pagandolo — e il motivo per cui conviene
 * prima costruirsi un prestigio.
 */
export function askingSalary(world: World, driver: Driver, team: Team): number {
  const scale = marketScale(world);
  const value = clamp((marketValue(driver) - 42) / 46, 0, 1);
  const base = 300_000 + Math.pow(value, 2.0) * 24_000_000;

  const step = rankIn(scale.values, marketValue(driver)) - rankIn(scale.prestiges, team.prestige);
  return Math.round(base * clamp(1 + Math.max(0, step) * 1.8, 1, 3.4));
}

/**
 * Oltre questo salto nessuna cifra basta.
 *
 * Un pilota da primi posti non firma per una squadra che non ha mai corso,
 * qualunque assegno gli si metta davanti. Senza un limite duro, la cassa
 * iniziale comprerebbe subito il miglior pilota della griglia e il primo anno
 * non sarebbe più il primo anno di nessuno.
 */
export const UNREACHABLE_STEP = 0.5;

/** Essere il numero uno vale uno sconto: è metà del motivo per cui si accetta. */
export const FIRST_DRIVER_DISCOUNT = 0.88;

/** Chi è già in casa sconta ancora un po': conosce la squadra. */
export const LOYALTY = 0.92;

/**
 * L'ingaggio da mettere sul contratto perché una richiesta sia soddisfatta.
 *
 * Arrotonda **per eccesso**, e non è un dettaglio: la schermata dell'offerta
 * calcolava lo sconto con `Math.round`, che a volte scende di mezzo euro
 * sotto la richiesta, e il motore rifiutava una firma che l'interfaccia
 * mostrava come accettabile. Un pulsante che non fa niente e non dice perché
 * è il peggior difetto che un mercato possa avere, ed è stato trovato solo
 * perché la cattura delle schermate non riusciva a ingaggiare nessuno.
 */
export function offerFor(asking: number, role: Terms['role']): number {
  return Math.ceil(asking * (role === 'prima' ? FIRST_DRIVER_DISCOUNT : 1));
}

/**
 * Perché un pilota direbbe di no. `null` quando firmerebbe.
 *
 * Tutte le ragioni sono leggibili prima di fare l'offerta: un mercato in cui
 * si scopre il rifiuto dopo averlo mandato è un mercato che si gioca a
 * tentativi.
 */
export function signingRefusal(
  world: World, driver: Driver, team: Team, terms: Terms,
): string | null {
  if (driver.retired) return 'Si è ritirato';
  if (driver.teamId) return 'È sotto contratto con un’altra scuderia';
  if (team.driverIds.length >= SEATS_PER_TEAM) return 'Non hai un sedile libero';

  const scale = marketScale(world);
  const step = rankIn(scale.values, marketValue(driver))
    - rankIn(scale.prestiges, team.prestige);
  if (step > UNREACHABLE_STEP) return 'Non guiderebbe per voi a nessuna cifra';

  const wanted = offerFor(askingSalary(world, driver, team), terms.role);
  if (terms.salary < wanted) {
    return `Chiede almeno ${(wanted / 1_000_000).toFixed(2)} milioni`;
  }
  if (terms.years < 1 || terms.years > 4) return 'Il contratto va da uno a quattro anni';
  if (team.cash < terms.salary) return 'Non hai in cassa il primo anno di ingaggio';
  return null;
}

/** Ingaggia un pilota. Restituisce il motivo del rifiuto, o `null` se ha firmato. */
export function signDriver(
  world: World, driverId: string, terms: Terms,
): string | null {
  const team = playerTeam(world);
  const driver = world.drivers[driverId];
  if (!team || !driver) return 'Pilota non disponibile';

  const refusal = signingRefusal(world, driver, team, terms);
  if (refusal) return refusal;

  driver.teamId = team.id;
  driver.contractYears = terms.years;
  driver.salary = terms.salary;
  team.driverIds.push(driver.id);
  world.academy = world.academy.filter((id) => id !== driver.id);
  return null;
}

/**
 * Rinnova prima della scadenza.
 *
 * È la decisione più importante del mercato e all'inizio non c'era: un
 * contratto arrivava a scadenza, il pilota finiva sul mercato generale e una
 * scuderia più grande se lo prendeva. La sonda lo mostrava come un difetto di
 * crescita — i piloti della squadra restavano fermi a 71 di overall per otto
 * stagioni — mentre era un difetto di mercato: **non erano gli stessi
 * piloti.** Ogni due anni ricominciava da capo con qualcun altro.
 *
 * Rinnovare costa il prezzo di adesso, non quello di quando l'avevi preso: un
 * giovane che è cresciuto va pagato per quello che è diventato, ed è il conto
 * che si presenta a chi ha lavorato bene.
 */
export function renewDriver(world: World, driverId: string, terms: Terms): string | null {
  const team = playerTeam(world);
  const driver = world.drivers[driverId];
  if (!team || !driver || driver.teamId !== team.id) return 'Non è un tuo pilota';

  const wanted = renewalSalary(world, driver, team, terms.role);
  if (terms.salary < wanted) {
    return `Chiede almeno ${(wanted / 1_000_000).toFixed(2)} milioni`;
  }
  if (terms.years < 1 || terms.years > 4) return 'Il contratto va da uno a quattro anni';
  driver.contractYears = terms.years;
  driver.salary = terms.salary;
  return null;
}

/** Quanto chiede per rinnovare, scontato della fedeltà. */
export function renewalSalary(world: World, driver: Driver, team: Team, role: Terms['role']): number {
  return Math.ceil(offerFor(askingSalary(world, driver, team), role) * LOYALTY);
}

/**
 * Rescinde un contratto.
 *
 * Costa gli anni che restano, per intero: è quello che impedisce di usare il
 * mercato come una lista della spesa da rifare ogni volta che passa qualcuno
 * di meglio.
 */
export function releaseCost(driver: Driver): number {
  return Math.round(driver.salary * Math.max(0, driver.contractYears));
}

export function releaseDriver(world: World, driverId: string): string | null {
  const team = playerTeam(world);
  const driver = world.drivers[driverId];
  if (!team || !driver || driver.teamId !== team.id) return 'Non è un tuo pilota';

  const cost = releaseCost(driver);
  if (team.cash < cost) {
    return `Servono ${Math.round(cost / 100_000) / 10} milioni di buonuscita`;
  }
  team.cash -= cost;
  team.driverIds = team.driverIds.filter((id) => id !== driver.id);
  driver.teamId = null;
  driver.contractYears = 0;
  world.academy.push(driver.id);
  return null;
}

/* ------------------------------------------------------------------ */
/* I conti della scuderia                                              */
/* ------------------------------------------------------------------ */

/**
 * Premio in denaro di fine stagione.
 *
 * Il grosso lo prende chi vince, ma la base conta più del grosso: in Formula 1
 * esserci vale già, ed è quello che tiene in vita una squadra piccola mentre
 * si costruisce.
 *
 * I primi numeri che avevo messo — 26 di base, 88 al vincitore — rendevano il
 * gioco impossibile, e la sonda lo ha mostrato subito: una scuderia nuova
 * incassava 32 milioni e ne spendeva 40 solo per esistere, quindi chiudeva il
 * primo anno in rosso, il secondo peggio, e dal terzo non poteva più nemmeno
 * pagare un pilota. Non era difficoltà, era una sottrazione senza uscita.
 *
 * Adesso la base è quasi il doppio e la forbice è più stretta: l'ultimo
 * chiude in attivo di una ventina di milioni, che è circa due aggiornamenti
 * all'anno. Pochi, e questo è il punto — ma sono suoi, e crescono con lui.
 */
export const PRIZE_BASE = 62_000_000;
export const PRIZE_TOP = 52_000_000;

export function prizeMoney(rank: number, teamCount: number): number {
  if (rank < 0) return PRIZE_BASE;
  const share = 1 - rank / Math.max(1, teamCount - 1);
  return Math.round(PRIZE_BASE + share * PRIZE_TOP);
}

/** Gli sponsor seguono il prestigio, non i punti: si firmano a gennaio. */
export function sponsorIncome(team: Team): number {
  return Math.round((team.prestige / 100) * 30_000_000);
}

/**
 * Quanto costa far correre la squadra per un anno, ingaggi esclusi.
 *
 * Cresce con la qualità del personale: gli ingegneri bravi costano, ed è la
 * ragione per cui non si può semplicemente assumere i migliori e basta.
 */
export function operatingCost(team: Team): number {
  const staff = (team.crew.technical + team.crew.trackEngineer + team.crew.pitCrew) / 300;
  return Math.round(10_000_000 + staff * 46_000_000);
}

export function salaryBill(world: World, team: Team): number {
  return team.driverIds.reduce((s, id) => s + (world.drivers[id]?.salary ?? 0), 0);
}

export interface Ledger {
  prize: number;
  sponsors: number;
  salaries: number;
  operating: number;
  net: number;
}

/**
 * I conti di fine stagione, per tutte le scuderie.
 *
 * Lo sviluppo non compare: i progetti si pagano settimana per settimana, ed è
 * proprio quello che rende la cassa una cosa da guardare durante l'anno
 * invece che a dicembre.
 */
export function settleTeamSeason(world: World, team: Team, standingOrder: string[]): Ledger {
  const prize = prizeMoney(standingOrder.indexOf(team.id), Object.keys(world.teams).length);
  const sponsors = sponsorIncome(team);
  const salaries = salaryBill(world, team);
  const operating = operatingCost(team);
  const net = prize + sponsors - salaries - operating;
  team.cash = Math.round(team.cash + net);
  return { prize, sponsors, salaries, operating, net };
}

export function settleAllTeams(world: World): void {
  const order = constructorStandings(world).map((c) => c.teamId);
  for (const team of Object.values(world.teams)) settleTeamSeason(world, team, order);
}

/** Quanto è forte la monoposto rispetto alla griglia: 0 ultima, 1 prima. */
export function carStanding(world: World, team: Team): number {
  const score = (t: Team) => CAR_KEYS.reduce((s, k) => s + t.car[k], 0);
  const all = Object.values(world.teams).map(score).sort((a, b) => a - b);
  return rankIn(all, score(team));
}

/** Un generatore legato alla squadra e alla settimana, per le scelte dell'IA. */
export function rngForTeam(world: World, team: Team, label: string): Rng {
  return createRng(hashSeed(`${label}:${team.id}:${world.year}:${world.week}`, world.seed));
}
