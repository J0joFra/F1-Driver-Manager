/**
 * La scuderia del giocatore, misurata su sedici stagioni.
 *
 * Verifica la promessa del gioco: si entra ultimi, e giocando bene si sale.
 * Non «si vince», che dipende anche dalla fortuna e dagli avversari — si
 * **sale**, in modo visibile, su entrambe le leve che il giocatore ha in
 * mano: la monoposto e i piloti.
 *
 *   npm run check:team
 */
import { advanceWeek, endSeason } from '../src/engine/world.js';
import {
  askingSalary, carStanding, playerTeam, renewalSalary, renewDriver,
  signDriver, signingRefusal, startTeam,
} from '../src/engine/team.js';
import { developmentBurn, PROJECT_SIZES, startProject } from '../src/engine/projects.js';
import {
  investorOffers, signInvestor, signSponsor, sponsorOffers,
} from '../src/engine/sponsors.js';
import { CAR_KEYS, type CarKey, type Team, type TrainingPlan, type World } from '../src/engine/types.js';
import { SEASON_WEEKS } from '../src/engine/calendar.js';
import { constructorStandings } from '../src/engine/season.js';
import { carPace } from '../src/engine/regulations.js';
import { overall, potentialOverall } from '../src/engine/driver.js';
import { spendPointsAsAi } from '../src/engine/skills.js';

const TEAMS = 10;
const SEASONS = 16;
/** Quanto è disposto a spendere per un pilota il giocatore di riferimento. */
const SALARY_CEILING = 24_000_000;

/**
 * Il giocatore di riferimento, e cosa rappresenta.
 *
 * Non gioca bene: gioca in modo **ragionevole**. Sviluppa dove è più indietro
 * rispetto alla griglia, tiene l'affidabilità sotto controllo solo quando
 * diventa il problema principale, rinnova i piloti che ha invece di
 * ricominciare da capo ogni due anni, e ruota l'allenamento sulle tre
 * categorie che allenano qualcosa.
 *
 * I limiti in fondo valgono per lui. Un giocatore migliore deve poter fare
 * meglio: se la sonda arrivasse al vertice, vorrebbe dire che le decisioni
 * non contano.
 */
function developLikeAPlayer(world: World, team: Team): void {
  const free = CAR_KEYS.filter((k) => !team.projects.some((p) => p.area === k));
  if (free.length === 0) return;

  const teams = Object.values(world.teams);
  const deficit = (k: CarKey) =>
    teams.reduce((t, x) => t + x.car[k], 0) / teams.length - team.car[k];

  // Il passo vive su motore, ala e telaio: l'affidabilità si tocca quando
  // diventa il buco più grosso, non prima.
  const pace = free.filter((k) => k !== 'reliability');
  const pool = pace.length > 0 && deficit('reliability') < 9 ? pace : free;
  const area = [...pool].sort((a, b) => deficit(b) - deficit(a))[0]!;

  const runway = team.cash - developmentBurn(team) * 6;
  for (const size of ['grande', 'medio', 'piccolo'] as const) {
    if (runway < PROJECT_SIZES[size].cost * 0.35) continue;
    startProject(team, area, size, world.year, world.week);
    return;
  }
}

/**
 * Sponsor e investitore, come li sceglierebbe una persona ragionevole.
 *
 * Non è un dettaglio della sonda: senza firmare, una scuderia incassa il 45%
 * degli sponsor, e la misura descriverebbe un giocatore che non ha mai aperto
 * il bilancio. Lo sponsor che rende di più sulla durata intera, e
 * l'investitore con l'obiettivo più vicino — la scelta prudente.
 */
function manageDeals(world: World, team: Team): void {
  if (!team.sponsor) {
    const best = sponsorOffers(world, team)
      .sort((a, b) => b.perSeason * b.seasons - a.perSeason * a.seasons)[0];
    if (best) signSponsor(team, best);
  }
  if (!team.investor) {
    const offer = investorOffers(world, team)[0];
    if (offer) signInvestor(team, offer);
  }
}

function manageContracts(world: World, team: Team): void {
  for (const id of [...team.driverIds]) {
    const d = world.drivers[id];
    if (!d || d.contractYears > 1) continue;
    const salary = renewalSalary(world, d, team, 'prima');
    if (salary <= SALARY_CEILING) renewDriver(world, id, { years: 3, salary, role: 'prima' });
  }

  while (team.driverIds.length < 2) {
    // Una squadra che si sta costruendo compra il potenziale, non il presente:
    // un ventenne da far crescere vale più di un trentenne già fatto, perché
    // l'allenamento è la leva veloce e il trentenne comincia a calare.
    const free = Object.values(world.drivers)
      .filter((d) => !d.retired && !d.teamId)
      .sort((a, b) => potentialOverall(b) - potentialOverall(a));
    let signed = false;
    for (const d of free) {
      const salary = askingSalary(world, d, team);
      if (salary > SALARY_CEILING) continue;
      const terms = { years: 2, salary, role: 'prima' as const };
      if (signingRefusal(world, d, team, terms) !== null) continue;
      signDriver(world, d.id, terms);
      signed = true;
      break;
    }
    if (!signed) break;
  }
}

const ROTATION = ['simulator', 'fitness', 'engineering'] as const;

const position: number[][] = Array.from({ length: SEASONS }, () => []);
const gap: number[][] = Array.from({ length: SEASONS }, () => []);
const standing: number[][] = Array.from({ length: SEASONS }, () => []);
const drivers: number[][] = Array.from({ length: SEASONS }, () => []);
const cash: number[][] = Array.from({ length: SEASONS }, () => []);

for (let i = 0; i < TEAMS; i++) {
  const world = startTeam({
    seed: 700 + i, name: 'Prova', short: 'PRV', colour: '#C8102E', budget: 'indipendente',
  });
  const team = playerTeam(world)!;

  for (let s = 0; s < SEASONS; s++) {
    manageDeals(world, team);
    manageContracts(world, team);

    while (world.week < SEASON_WEEKS) {
      developLikeAPlayer(world, team);
      const plans: Record<string, TrainingPlan> = {};
      team.driverIds.forEach((id, slot) => {
        const plan: TrainingPlan = { simulator: 0, fitness: 0, engineering: 0, media: 0 };
        plan[ROTATION[(world.week + slot) % ROTATION.length]!] = 4;
        plans[id] = plan;
      });
      advanceWeek(world, { plans });
      for (const id of team.driverIds) spendPointsAsAi(world.drivers[id]!);
    }

    const table = constructorStandings(world);
    const all = Object.values(world.teams);
    const mean = all.reduce((t, x) => t + carPace(x.car), 0) / all.length;

    position[s]!.push(table.findIndex((c) => c.teamId === team.id) + 1);
    gap[s]!.push(mean - carPace(team.car));
    standing[s]!.push(carStanding(world, team));
    cash[s]!.push(team.cash / 1_000_000);
    const ovr = team.driverIds.map((id) => overall(world.drivers[id]!.attrs));
    drivers[s]!.push(ovr.length > 0 ? ovr.reduce((a, b) => a + b, 0) / ovr.length : 0);

    endSeason(world);
  }
}

const avg = (a: number[]) => a.reduce((x, y) => x + y, 0) / a.length;
const at = (rows: number[][], s: number) => avg(rows[s - 1]!);

console.log(`${TEAMS} scuderie fondate da zero × ${SEASONS} stagioni\n`);
console.log('st   posizione   passo vs media   passo(0-1)   piloti   cassa M€');
for (let s = 0; s < SEASONS; s++) {
  console.log(
    ` ${String(s + 1).padStart(2)}      ${avg(position[s]!).toFixed(1)}` +
    `           ${avg(gap[s]!) >= 0 ? '−' : '+'}${Math.abs(avg(gap[s]!)).toFixed(1)}` +
    `            ${avg(standing[s]!).toFixed(2)}` +
    `        ${avg(drivers[s]!).toFixed(1)}     ${avg(cash[s]!).toFixed(0)}`,
  );
}
console.log('');

const problems: string[] = [];
const check = (ok: boolean, msg: string) => { if (!ok) problems.push(msg); };

// Si comincia ultimi: se al primo anno si è già a metà griglia, la scuderia
// nuova non è una scuderia nuova.
check(at(position, 1) >= 8, `al primo anno la squadra è ${at(position, 1).toFixed(1)}ª, troppo avanti`);

// E si sale. Questo è il punto di tutto.
check(at(position, 8) <= 7.4,
  `dopo otto stagioni è ancora ${at(position, 8).toFixed(1)}ª: giocare non serve`);
check(at(position, 16) < at(position, 8),
  `fra l'ottava e la sedicesima stagione non si sale più`);

// La monoposto è la leva lenta: deve arrivare quasi alla pari.
check(at(gap, 1) > 9, `si parte con solo ${at(gap, 1).toFixed(1)} punti di svantaggio: troppo pochi`);
check(at(gap, 8) < 7,
  `dopo otto stagioni la macchina è ancora ${at(gap, 8).toFixed(1)} punti sotto la media`);
check(at(gap, 16) < 3.5,
  `la macchina non arriva mai alla pari: ${at(gap, 16).toFixed(1)} punti sotto alla sedicesima`);

// I piloti sono la leva veloce: l'allenamento deve vedersi.
check(at(drivers, 8) - at(drivers, 1) >= 3.5,
  `in otto stagioni i piloti crescono di ${(at(drivers, 8) - at(drivers, 1)).toFixed(1)} punti soli`);

// E non si fallisce giocando in modo ragionevole.
for (let s = 1; s <= SEASONS; s++) {
  check(at(cash, s) > -8,
    `alla stagione ${s} la cassa media è ${at(cash, s).toFixed(0)} milioni: i conti non tornano`);
}

if (problems.length === 0) {
  console.log('ok — si entra ultimi e si sale, su entrambe le leve');
} else {
  for (const p of problems) console.log(`  ✗ ${p}`);
  process.exitCode = 1;
}
