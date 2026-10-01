import type { CarRating, World } from './types.js';
import { CAR_KEYS } from './types.js';
export { CAR_KEYS } from './types.js';
import { carPaceOn, NEUTRAL_MIX } from './layout.js';
import { clampToTier, reshuffleTiers, TIER_CAR } from './tiers.js';
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
 * Azzeramento tecnico: le fasce si rimescolano.
 *
 * ## Cos'era e perché non serve più
 *
 * Qui stava `CAR_ANCHOR`, il livello a cui il regolamento riportava tutte le
 * monoposto. Esisteva contro l'inflazione: ogni scuderia sviluppava, nessuna
 * regrediva, e in otto stagioni la media della griglia passava da 82 a 90
 * schiacciata contro il tetto di 99 — e una scuderia nuova inseguiva un
 * bersaglio che scappava più in fretta di quanto lei potesse correre.
 *
 * Con le fasce quel problema non si pone: i valori non possono uscire dalla
 * banda, quindi non c'è niente da ancorare. L'azzeramento torna a fare solo
 * quello che fa in Formula 1, cioè **rimescolare chi sta davanti**.
 *
 * ## Come si rimescola
 *
 * `reshuffleTiers` ridistribuisce le stesse fasce che ci sono — un regolamento
 * nuovo non crea scuderie di vertice dal nulla — pesando metà quanto si è
 * lavorato e metà la sorte. Un azzeramento che fosse puro caso renderebbe
 * inutile lo sviluppo degli anni precedenti; uno che non fosse affatto caso
 * non sarebbe un'occasione per nessuno.
 */
export function applyRegulationReset(world: World, rng: Rng): void {
  const teams = Object.values(world.teams);
  const moves = reshuffleTiers(teams, () => rng.normal());
  const to = new Map(moves.map((m) => [m.teamId, m.to]));

  for (const team of teams) {
    const was = team.tier;
    const offset: Record<string, number> = {};
    for (const k of CAR_KEYS) offset[k] = team.car[k] - TIER_CAR[was][k];

    team.tier = to.get(team.id) ?? was;
    // Della posizione nella banda resta metà: competenza e struttura non
    // svaniscono con un cambio di regolamento, ma metà del vantaggio sì.
    for (const k of CAR_KEYS) team.car[k] = TIER_CAR[team.tier][k] + offset[k]! * 0.5;
    team.car = clampToTier(team.car, team.tier);

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
