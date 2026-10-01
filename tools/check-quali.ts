/**
 * Le scelte del sabato devono costare qualcosa alla domenica.
 *
 * La qualifica offre tre decisioni — quando uscire, che gomma, come scaldarla —
 * e da quando l'usura del giro di lancio si porta in gara ognuna ha un prezzo
 * differito. Il rischio è sempre lo stesso: che una delle combinazioni vinca su
 * entrambi i tavoli, e allora non è una scelta, è la risposta.
 *
 * Qui si corrono le stesse qualifiche e le stesse gare, con gli stessi semi,
 * cambiando solo il piano delle due monoposto del giocatore, e si guarda dove
 * partono **e** dove arrivano.
 */
import { startTeam, playerTeam, askingSalary, signDriver, signingRefusal } from '../src/engine/team.js';
import { prepareWeekend } from '../src/engine/season.js';
import { createLiveRace, order, fastForward, carOf } from '../src/engine/liveRace.js';
import { marketValue } from '../src/engine/market.js';
import type { QualifyingPlan } from '../src/engine/qualifying.js';

const PLANS: Record<string, QualifyingPlan> = {
  prudente: { timing: 'meta', compound: 'M', outLap: 'scarico' },
  equilibrato: { timing: 'meta', compound: 'S', outLap: 'standard' },
  aggressivo: { timing: 'tardi', compound: 'S', outLap: 'spinto' },
};

const avg = (a: number[]) => a.reduce((x, y) => x + y, 0) / a.length;
const names = Object.keys(PLANS);
const bag = () => Object.fromEntries(names.map((k) => [k, [] as number[]]));
const grid = bag();
const finish = bag();
const wear = bag();

for (let seed = 0; seed < 12; seed++) {
  const w = startTeam({ seed: 400 + seed, name: 'P', short: 'P', colour: '#D21E1E', budget: 'indipendente' });
  const team = playerTeam(w)!;
  for (let slot = 0; slot < 2; slot++) {
    const free = Object.values(w.drivers).filter((d) => !d.retired && !d.teamId)
      .sort((a, b) => marketValue(b) - marketValue(a));
    for (const d of free) {
      const terms = { years: 2, salary: askingSalary(w, d, team), role: 'prima' as const };
      if (signingRefusal(w, d, team, terms) === null) { signDriver(w, d.id, terms); break; }
    }
  }
  for (const week of w.schedule.filter((s) => s.trackId).slice(0, 5)) {
    for (const [name, plan] of Object.entries(PLANS)) {
      w.qualifyingPlans = Object.fromEntries(team.driverIds.map((d) => [d, plan]));
      const prep = prepareWeekend(w, week.trackId!);
      for (const d of team.driverIds) {
        const q = prep.qualifying.find((x) => x.driverId === d);
        if (q) { grid[name]!.push(q.position); wear[name]!.push(q.startWear ?? 0); }
      }
      const race = createLiveRace(prep.track, prep.entries, prep.raceRng.fork('l'), {
        wet: prep.wet, playerIds: team.driverIds,
      });
      fastForward(race);
      const flag = order(race);
      for (const d of team.driverIds) {
        const car = carOf(race, d);
        if (car && !car.dnf) finish[name]!.push(flag.indexOf(car) + 1);
      }
    }
  }
}

console.log('\npiano         griglia   arrivo   usura al via');
for (const name of Object.keys(PLANS)) {
  console.log(`${name.padEnd(13)} P${avg(grid[name]!).toFixed(2).padStart(5)}   P${
    avg(finish[name]!).toFixed(2).padStart(5)}   ${avg(wear[name]!).toFixed(1).padStart(5)}`);
}

const problems: string[] = [];
const check = (ok: boolean, msg: string) => { if (!ok) problems.push(msg); };

// Le soglie sono rapporti e non posizioni.
//
// Erano posizioni assolute — «meno di 1,2 all'arrivo» — tarate su una griglia
// di diciotto monoposto. Con ventidue le stesse identiche scelte producono
// scarti più grandi senza che nessuna formula sia cambiata, e la soglia
// bocciava la crescita del gruppo invece del bilanciamento.
const gridSpread = Math.max(...names.map((n) => avg(grid[n]!))) - Math.min(...names.map((n) => avg(grid[n]!)));

// Osare deve pagare dove si paga: in griglia, e non per un'inezia.
check(gridSpread > 2,
  `fra il piano più prudente e il più aggressivo ci sono ${gridSpread.toFixed(2)} posizioni in griglia: rischiare non serve`);

// E deve costare dove costa: in gara. Nessuno dei due deve vincere su entrambi
// i tavoli, altrimenti la domanda del sabato ha una risposta sola.
const best = names.reduce((a, b) => (avg(finish[a]!) <= avg(finish[b]!) ? a : b));
const bestGrid = names.reduce((a, b) => (avg(grid[a]!) <= avg(grid[b]!) ? a : b));
check(best !== bestGrid,
  `«${best}» è il migliore sia in griglia sia all'arrivo: non è una scelta, è la risposta`);

// Ma la domenica deve disfare la gran parte di quello che il sabato ha deciso,
// o la qualifica diventa una tassa e tanto varrebbe non giocarla. Il confronto
// è fra i due scarti, non con un numero di posizioni: così regge su qualunque
// griglia.
const spread = Math.max(...names.map((n) => avg(finish[n]!))) - Math.min(...names.map((n) => avg(finish[n]!)));
check(spread < gridSpread * 0.45,
  `all'arrivo resta il ${Math.round(100 * spread / gridSpread)}% di quello che la qualifica aveva deciso (${spread.toFixed(2)} posizioni su ${gridSpread.toFixed(2)}): la qualifica decide la gara da sola`);

if (problems.length === 0) {
  console.log('\nok — il sabato si paga la domenica, ma non la decide');
} else {
  console.log('');
  for (const p of problems) console.log(`  ✗ ${p}`);
  process.exitCode = 1;
}
