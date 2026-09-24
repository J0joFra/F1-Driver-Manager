import type { CarRating, World } from './types.js';
import { CAR_KEYS } from './types.js';
export { CAR_KEYS } from './types.js';
import { carPaceOn, NEUTRAL_MIX } from './layout.js';
import { clamp, type Rng } from './rng.js';

/**
 * Sviluppo delle monoposto e azzeramenti regolamentari.
 *
 * Senza un reset periodico, dopo dieci stagioni la scuderia più ricca ha vinto
 * tutto e la gerarchia si congela: è il modo più comune in cui un gestionale
 * sportivo muore. Il regolamento che cambia ogni 4–6 anni rimescola le carte,
 * ed è anche ciò che succede davvero in Formula 1.
 */

/**
 * Quanto vale una monoposto in generale: il suo passo su un tracciato medio.
 *
 * Serve alle classifiche, allo sviluppo e all'interfaccia, dove «passo» deve
 * restare un numero solo. In gara non si usa mai: lì conta `carPaceOn`, che
 * pesa motore, ala e telaio secondo la forma del circuito.
 */
export function carPace(car: CarRating): number {
  return carPaceOn(car, NEUTRAL_MIX);
}

function meanCarPace(world: World): number {
  const teams = Object.values(world.teams);
  return teams.reduce((s, t) => s + carPace(t.car), 0) / teams.length;
}

/**
 * La cassa con cui una scuderia gestita dal computer comincia il mondo.
 *
 * Proporzionata al prestigio, perché è il prestigio a decidere quanto
 * incasserà. Partire tutte uguali regalerebbe alla squadra di coda un anno di
 * sviluppo che non potrà permettersi mai più, e la griglia del primo anno
 * direbbe il falso.
 */
export function initialCash(prestige: number): number {
  return Math.round(34_000_000 + (prestige / 100) * 96_000_000);
}

/**
 * Il livello assoluto a cui il regolamento riporta le monoposto.
 *
 * È l'equivalente di `talentAnchor` per le macchine, e serve allo stesso
 * scopo. Senza, i rating si gonfiano e basta: ogni scuderia sviluppa, nessuna
 * regredisce, e in otto stagioni la media della griglia passava da 82 a 90,
 * schiacciata contro il tetto di 99. L'azzeramento che si limitava a far
 * convergere verso la media di allora non lo impediva — spostava tutti nello
 * stesso punto, sempre più in alto.
 *
 * Il danno peggiore non era l'inflazione in sé ma cosa faceva al gioco: una
 * scuderia nuova insegue un bersaglio che scappa più in fretta di quanto lei
 * possa correre, e non raggiunge mai il gruppo per quanto bene giochi.
 */
export const CAR_ANCHOR = 78;

/**
 * Azzeramento tecnico: le monoposto tornano al livello di riferimento e si
 * rimescolano.
 *
 * Della gerarchia precedente resta metà: chi era avanti riparte un po' avanti
 * — competenza e struttura non svaniscono con un cambio di regolamento — ma
 * metà del vantaggio sì, ed è quello che rende l'azzeramento un'occasione
 * vera per chi insegue.
 */
export function applyRegulationReset(world: World, rng: Rng): void {
  const mean = meanCarPace(world);
  for (const team of Object.values(world.teams)) {
    for (const k of CAR_KEYS) {
      const edge = (team.car[k] - mean) * 0.5;
      team.car[k] = clamp(CAR_ANCHOR + edge + rng.normal() * 6.5, 45, 97);
    }
    // Un regolamento nuovo azzera anche i cantieri: quello che era in
    // costruzione era costruito sulle regole di prima.
    team.projects = [];
  }
  world.regulations.lastResetYear = world.year;
  world.regulations.nextResetYear = world.year + rng.int(4, 6);
}

export function maybeReset(world: World, rng: Rng): boolean {
  if (world.year < world.regulations.nextResetYear) return false;
  applyRegulationReset(world, rng);
  return true;
}

/**
 * Il prestigio segue i risultati: una scuderia che vince attira i piloti
 * migliori, una che perde smette di attirarli. Senza questo il mercato
 * premierebbe per sempre chi era forte alla creazione del mondo.
 */
export function updatePrestige(world: World, standingOrder: string[]): void {
  const n = Math.max(1, standingOrder.length - 1);
  for (const team of Object.values(world.teams)) {
    const rank = standingOrder.indexOf(team.id);
    if (rank < 0) continue;
    const target = 95 - (rank / n) * 55;
    team.prestige = clamp(team.prestige * 0.78 + target * 0.22, 20, 99);
  }
}

/** Tetto di spesa comune a tutte le scuderie, come in Formula 1 dal 2021. */
export const BUDGET_CAP = 135_000_000;

/**
 * Budget e staff tecnico seguono i risultati, entro limiti stretti.
 *
 * Il budget cap comprime le differenze economiche: quello che resta è il
 * premio in denaro, che vale pochi punti percentuali. Senza questa convergenza
 * la scuderia ricca al primo anno resta ricca per sempre e vince sempre —
 * cosa che il simulatore ha mostrato al primo tentativo.
 */
export function updateTeamResources(world: World, standingOrder: string[]): void {
  for (const team of Object.values(world.teams)) {
    const rank = standingOrder.indexOf(team.id);
    if (rank < 0) continue;
    team.budget = Math.round(BUDGET_CAP * (0.84 + (team.prestige / 100) * 0.16));
    // Il personale migliore va dove si vince, ma si muove lentamente.
    const target = 52 + team.prestige * 0.4;
    team.crew.technical = clamp(team.crew.technical * 0.86 + target * 0.14, 35, 97);
    team.crew.trackEngineer = clamp(team.crew.trackEngineer * 0.88 + target * 0.12, 35, 97);
    team.crew.pitCrew = clamp(team.crew.pitCrew * 0.88 + target * 0.12, 35, 97);
  }
}
