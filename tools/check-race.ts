/**
 * Quanto è spalmata la griglia all'arrivo.
 *
 * Nessuno sorvegliava questo numero, e infatti era rotto. In una gara su Port
 * Haven il distacco fra il primo e l'ultimo era di **sette giri e mezzo**: il
 * campo non correva, si disperdeva. Una scuderia nuova non gareggiava contro
 * nessuno — veniva doppiata da tutti, in ogni gara, e la classifica finale
 * misurava chi aveva azzeccato la finestra di sosta invece di chi era più
 * veloce.
 *
 * Le altre sonde non potevano vederlo: `check:team` guarda la posizione in
 * campionato, `sim` guarda i campioni e il ricambio. Il **distacco** non lo
 * guardava nessuno, ed è la cosa che il giocatore vede per prima.
 *
 *   npm run check:race
 */
import {
  askingSalary, playerTeam, signDriver, signingRefusal, startTeam,
} from '../src/engine/team.js';
import { prepareWeekend } from '../src/engine/season.js';
import { simulateRace } from '../src/engine/race.js';
import { marketValue } from '../src/engine/market.js';

const WORLDS = 12;
const RACES_PER_WORLD = 5;

const lastGap: number[] = [];
const midGap: number[] = [];
const playerGap: number[] = [];
const playerPos: number[] = [];
let lapped = 0;

for (let seed = 0; seed < WORLDS; seed++) {
  const world = startTeam({
    seed: 400 + seed, name: 'Prova', short: 'PRV', colour: '#D21E1E', budget: 'indipendente',
  });
  const team = playerTeam(world)!;

  // Una scuderia nuova ingaggia i due migliori che accettano: è il caso
  // migliore per il giocatore, e quindi il limite inferiore del suo distacco.
  for (let slot = 0; slot < 2; slot++) {
    const free = Object.values(world.drivers)
      .filter((d) => !d.retired && !d.teamId)
      .sort((a, b) => marketValue(b) - marketValue(a));
    for (const d of free) {
      const terms = { years: 2, salary: askingSalary(world, d, team), role: 'prima' as const };
      if (signingRefusal(world, d, team, terms) !== null) continue;
      signDriver(world, d.id, terms);
      break;
    }
  }

  for (const week of world.schedule.filter((s) => s.trackId).slice(0, RACES_PER_WORLD)) {
    const prepared = prepareWeekend(world, week.trackId!);
    const { results } = simulateRace(prepared.track, prepared.entries, prepared.raceRng, {
      wet: prepared.wet,
    });
    // Il distacco si misura in **giri**, non in secondi: un minuto vuol dire
    // cose diverse a Monaco e a Spa.
    const laps = (gap: number) => gap / prepared.track.baseLap;

    const finishers = results.filter((r) => !r.dnf && r.gap !== null);
    if (finishers.length < 10) continue;
    lastGap.push(laps(finishers.at(-1)!.gap!));
    midGap.push(laps(finishers[Math.floor(finishers.length / 2)]!.gap!));

    for (const id of team.driverIds) {
      const r = results.find((x) => x.driverId === id);
      if (!r) continue;
      playerPos.push(r.position);
      if (r.dnf || r.gap === null) continue;
      playerGap.push(laps(r.gap));
      if (r.gap! > prepared.track.baseLap) lapped += 1;
    }
  }
}

const avg = (a: number[]) => a.reduce((x, y) => x + y, 0) / a.length;
const pct = (a: number[], p: number) => [...a].sort((x, y) => x - y)[Math.floor(a.length * p)]!;
const lappedShare = lapped / Math.max(1, playerGap.length);

console.log(`${lastGap.length} gare, ${WORLDS} scuderie fondate da zero\n`);
console.log(`ultimo classificato   ${avg(lastGap).toFixed(2)} giri   (peggiore ${pct(lastGap, 0.9).toFixed(2)})`);
console.log(`metà gruppo           ${avg(midGap).toFixed(2)} giri`);
console.log(`le tue monoposto      ${avg(playerGap).toFixed(2)} giri, posizione media P${avg(playerPos).toFixed(1)}`);
console.log(`doppiate              ${Math.round(100 * lappedShare)}%\n`);

const problems: string[] = [];
const check = (ok: boolean, msg: string) => { if (!ok) problems.push(msg); };

// Il gruppo deve restare un gruppo.
check(avg(midGap) < 0.9,
  `metà gruppo chiude a ${avg(midGap).toFixed(2)} giri dal vincitore: il campo si disperde`);
check(avg(lastGap) < 1.7,
  `l'ultimo classificato è a ${avg(lastGap).toFixed(2)} giri: la gara non è una gara`);
check(pct(lastGap, 0.9) < 2.6,
  `nel dieci per cento peggiore l'ultimo è a ${pct(lastGap, 0.9).toFixed(2)} giri`);

// Ma deve restare una gara, non una processione: se l'ultimo arriva attaccato
// al primo, la monoposto non conta più niente e sviluppare è inutile.
check(avg(lastGap) > 0.5,
  `l'ultimo classificato è a soli ${avg(lastGap).toFixed(2)} giri: la macchina non conta più`);

// Una scuderia al primo anno sta dietro, ma corre contro qualcuno.
check(avg(playerPos) > 11,
  `al primo anno la scuderia nuova è già P${avg(playerPos).toFixed(1)}: troppo avanti`);
check(avg(playerGap) < 1.5,
  `le monoposto nuove chiudono a ${avg(playerGap).toFixed(2)} giri: non corrono contro nessuno`);
check(lappedShare < 0.75,
  `le monoposto nuove vengono doppiate nel ${Math.round(100 * lappedShare)}% dei casi`);

if (problems.length === 0) {
  console.log('ok — il gruppo resta un gruppo, e chi comincia corre contro qualcuno');
} else {
  for (const p of problems) console.log(`  ✗ ${p}`);
  process.exitCode = 1;
}
