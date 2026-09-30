/**
 * Le tre strategie devono essere tre scelte.
 *
 * La misura che ha giustificato questo strumento: con la morbida a 1,46s dalla
 * dura, l'aggressiva arrivava P12,0 contro P13,5 dell'equilibrata **e** perdeva
 * meno posizioni al via. Vinceva su ogni asse. Una strategia che vince su ogni
 * asse non è una strategia: è la risposta, e le altre due sono decorazione.
 *
 * Qui si corrono le stesse gare, con gli stessi semi, cambiando solo la
 * strategia delle due monoposto del giocatore, e si controlla che l'arrivo medio
 * resti vicino — il compromesso deve essere un compromesso — mentre il
 * comportamento al via resta diverso, perché è lì che la scelta si vede.
 */
import { startTeam, playerTeam, askingSalary, signDriver, signingRefusal } from '../src/engine/team.js';
import { prepareWeekend } from '../src/engine/season.js';
import { createLiveRace, order, fastForward, carOf, stepRace } from '../src/engine/liveRace.js';
import { marketValue } from '../src/engine/market.js';
import { breaksCompoundRule } from '../src/engine/rules.js';
import { STRATEGY_IDS, strategyFor, type RaceStrategy, type StrategyId } from '../src/engine/strategy.js';

const avg = (a: number[]) => a.reduce((x, y) => x + y, 0) / a.length;
const finish: Record<StrategyId, number[]> = { conservativa: [], equilibrata: [], aggressiva: [] };
const early: Record<StrategyId, number[]> = { conservativa: [], equilibrata: [], aggressiva: [] };
const stops: Record<StrategyId, number[]> = { conservativa: [], equilibrata: [], aggressiva: [] };
let penalties = 0;
let races = 0;

for (let seed = 0; seed < 12; seed++) {
  const w = startTeam({ seed: 900 + seed, name: 'P', short: 'P', colour: '#D21E1E', budget: 'indipendente' });
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
    races++;
    for (const id of STRATEGY_IDS) {
      const prep = prepareWeekend(w, week.trackId!);
      const playerStrategies: Record<string, RaceStrategy> = {};
      for (const d of team.driverIds) {
        const e = prep.entries.find((x) => x.driverId === d);
        playerStrategies[d] = strategyFor(prep.track, id, e?.tyres ?? 70);
      }
      const race = createLiveRace(prep.track, prep.entries, prep.raceRng.fork('l'), {
        wet: prep.wet, playerIds: team.driverIds, playerStrategies,
      });
      // Come si esce dalle prime curve.
      while (race.lap <= 3 && !race.finished) stepRace(race, 2);
      const outOfTurnOne = order(race);
      for (const d of team.driverIds) {
        const car = carOf(race, d);
        if (car) early[id].push(outOfTurnOne.indexOf(car) + 1 - car.entry.grid);
      }
      // E come si arriva.
      fastForward(race);
      const flag = order(race);
      for (const d of team.driverIds) {
        const car = carOf(race, d);
        if (!car || car.dnf) continue;
        finish[id].push(flag.indexOf(car) + 1);
        stops[id].push(car.stops);
        if (breaksCompoundRule([...car.compounds, car.tyre.compound], race.wet)) penalties++;
      }
    }
  }
}

console.log(`\n${races} gare, ciascuna corsa tre volte con la stessa griglia\n`);
for (const id of STRATEGY_IDS) {
  console.log(`${id.padEnd(13)} arrivo P${avg(finish[id]).toFixed(2)}   primi 3 giri ${
    avg(early[id]) >= 0 ? '+' : ''}${avg(early[id]).toFixed(2)}   soste ${avg(stops[id]).toFixed(2)}`);
}

const problems: string[] = [];
const check = (ok: boolean, msg: string) => { if (!ok) problems.push(msg); };

const means = STRATEGY_IDS.map((id) => avg(finish[id]));
const spread = Math.max(...means) - Math.min(...means);
check(spread < 1.0,
  `fra la strategia migliore e la peggiore ci sono ${spread.toFixed(2)} posizioni: una domina`);

// Ma devono restare distinguibili: se al via si comportano uguale, la scelta
// non si vede e tanto valeva non farla fare.
check(avg(early.conservativa) - avg(early.aggressiva) > 1.5,
  'al via conservativa e aggressiva si comportano allo stesso modo: la scelta non si vede');
check(avg(stops.aggressiva) > avg(stops.conservativa) + 0.5,
  "l'aggressiva non si ferma più volte della conservativa: le soste non seguono la scelta");

// Nessuna deve portare alla penalità delle due mescole.
check(penalties === 0,
  `${penalties} arrivi con la penalità delle due mescole: una strategia non deve tendere agguati`);

if (problems.length === 0) {
  console.log('\nok — tre strategie, tre compromessi, nessuna risposta giusta');
} else {
  console.log('');
  for (const p of problems) console.log(`  ✗ ${p}`);
  process.exitCode = 1;
}
