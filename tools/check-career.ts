/**
 * La carriera del giocatore, misurata contro i campionati veri.
 *
 * Simula sessanta carriere di otto stagioni e confronta la curva che ne esce
 * con i limiti di `careerCurve.ts`, che vengono dallo storico dei mondiali.
 * Serve a tenere ferma una promessa precisa: chi comincia una carriera non
 * resta in coda per sempre, e l'allenamento e l'esperienza si vedono.
 *
 *   npm run check:career
 */
import { advanceWeek, endSeason, takeOffer } from '../src/engine/world.js';
import { overall, potentialOverall } from '../src/engine/driver.js';
import { startCareer } from '../src/engine/career.js';
import { SEASON_WEEKS } from '../src/engine/calendar.js';
import { driverStandings } from '../src/engine/season.js';
import { spendPointsAsAi } from '../src/engine/skills.js';
import { CAREER_BOUNDS, CAREER_PERCENTILE } from '../src/engine/careerCurve.js';
import type { TrainingCategory, TrainingPlan } from '../src/engine/types.js';

const CAREERS = 60;
const SEASONS = 8;

/**
 * Il giocatore di riferimento: ruota le tre categorie che allenano attributi.
 *
 * Non è un dettaglio della sonda. Un piano fisso su una sola categoria lascia
 * fermo il 34% dell'overall — gomme, freddezza, partenze, bagnato non si
 * allenano al simulatore — e misurarlo così faceva sembrare la crescita
 * bloccata quando invece era solo squilibrata.
 */
const ROTATION: readonly TrainingCategory[] = ['simulator', 'fitness', 'engineering'];

const pct: number[][] = Array.from({ length: SEASONS }, () => []);
const prestige: number[][] = Array.from({ length: SEASONS }, () => []);
const ovr: number[][] = Array.from({ length: SEASONS }, () => []);
const tail: number[][] = Array.from({ length: SEASONS }, () => []);
const start: number[] = [];
const potential: number[] = [];

for (let i = 0; i < CAREERS; i++) {
  const world = startCareer({
    seed: 1000 + i, name: 'Prova', nationality: 'ITA',
  });
  const id = world.seat.mode === 'pilota' ? world.seat.driverId : '';
  start.push(overall(world.drivers[id]!.attrs));
  potential.push(potentialOverall(world.drivers[id]!));

  for (let s = 0; s < SEASONS; s++) {
    while (world.week < SEASON_WEEKS) {
      const plan: TrainingPlan = { simulator: 0, fitness: 0, engineering: 0, media: 0 };
      plan[ROTATION[world.week % ROTATION.length]!] = 4;
      advanceWeek(world, { plan });
    }
    // Il giocatore spende i punti abilità come li spendono i piloti IA:
    // misurare un giocatore che non usa l'albero misura un altro gioco.
    spendPointsAsAi(world.drivers[id]!);

    const table = driverStandings(world);
    const pos = table.findIndex((r) => r.driverId === id) + 1;
    const me = world.drivers[id]!;
    if (pos > 0) {
      pct[s]!.push(pos / table.length);
      tail[s]!.push(pos >= table.length - 1 ? 1 : 0);
    }
    prestige[s]!.push(me.teamId ? world.teams[me.teamId]!.prestige : 0);
    ovr[s]!.push(overall(me.attrs));

    endSeason(world);
    // Firma per la squadra migliore fra quelle che lo vogliono: le offerte
    // arrivano ordinate per interesse, e l'interesse è massimo proprio dove
    // il prestigio è minimo.
    const best = [...(world.offers ?? [])]
      .sort((a, b) => world.teams[b.teamId]!.prestige - world.teams[a.teamId]!.prestige)[0];
    if (best) takeOffer(world, best.teamId);
  }
}

const avg = (a: number[]) => (a.length ? a.reduce((x, y) => x + y, 0) / a.length : NaN);

const improvement: number[] = [];
for (let s = 1; s < SEASONS; s++) {
  let better = 0;
  const n = Math.min(pct[s]!.length, pct[s - 1]!.length);
  for (let i = 0; i < n; i++) if (pct[s]![i]! < pct[s - 1]![i]!) better += 1;
  improvement.push(n > 0 ? better / n : NaN);
}

console.log(`${CAREERS} carriere × ${SEASONS} stagioni`);
console.log('');
console.log('st   gioco   reale   prestigio   overall   ultimi due');
for (let s = 0; s < SEASONS; s++) {
  console.log(
    ` ${s + 1}   ${avg(pct[s]!).toFixed(3)}   ${CAREER_PERCENTILE[s]!.toFixed(3)}` +
    `       ${avg(prestige[s]!).toFixed(0)}      ${avg(ovr[s]!).toFixed(1)}` +
    `        ${(100 * avg(tail[s]!)).toFixed(0)}%`,
  );
}
console.log('');
console.log(`overall alla partenza ${avg(start).toFixed(1)} → ${avg(ovr[SEASONS - 1]!).toFixed(1)}` +
  `  (potenziale ${avg(potential).toFixed(1)})`);
console.log(`si migliora nel ${(100 * avg(improvement)).toFixed(0)}% dei passaggi di stagione` +
  ` (reale: 52%, primo passaggio 63%)`);
console.log('');

const problems: string[] = [];
const check = (ok: boolean, msg: string) => { if (!ok) problems.push(msg); };

const s1 = avg(pct[0]!);
const s8 = avg(pct[SEASONS - 1]!);
check(s1 >= CAREER_BOUNDS.season1[0] && s1 <= CAREER_BOUNDS.season1[1],
  `prima stagione ${s1.toFixed(3)} fuori da ${CAREER_BOUNDS.season1.join('–')}`);
check(s8 >= CAREER_BOUNDS.season8[0] && s8 <= CAREER_BOUNDS.season8[1],
  `ottava stagione ${s8.toFixed(3)} fuori da ${CAREER_BOUNDS.season8.join('–')}`);
check(s1 - avg(pct[1]!) >= CAREER_BOUNDS.minFirstStep,
  `il gradino fra prima e seconda stagione è ${(s1 - avg(pct[1]!)).toFixed(3)},` +
  ` sotto ${CAREER_BOUNDS.minFirstStep}`);

const gain = avg(ovr[SEASONS - 1]!) - avg(start);
check(gain >= CAREER_BOUNDS.minOverallGain,
  `l'overall cresce di ${gain.toFixed(1)} punti, sotto ${CAREER_BOUNDS.minOverallGain}`);

const rate = avg(improvement);
check(rate >= CAREER_BOUNDS.improvementRate[0] && rate <= CAREER_BOUNDS.improvementRate[1],
  `si migliora nel ${(100 * rate).toFixed(0)}% dei passaggi,` +
  ` fuori da ${CAREER_BOUNDS.improvementRate.map((x) => `${100 * x}%`).join('–')}`);

for (let s = 1; s < SEASONS; s++) {
  check(avg(tail[s]!) <= CAREER_BOUNDS.maxTailRate,
    `alla stagione ${s + 1} si chiude negli ultimi due posti nel` +
    ` ${(100 * avg(tail[s]!)).toFixed(0)}% dei casi`);
}

// La carriera deve migliorare, non oscillare: dalla seconda stagione in poi
// nessuna deve essere peggiore di due stagioni prima.
for (let s = 3; s < SEASONS; s++) {
  check(avg(pct[s]!) <= avg(pct[s - 2]!),
    `la stagione ${s + 1} (${avg(pct[s]!).toFixed(3)}) va peggio della` +
    ` ${s - 1} (${avg(pct[s - 2]!).toFixed(3)})`);
}

if (problems.length === 0) {
  console.log('ok — la curva di carriera sta dentro i limiti misurati sui mondiali veri');
} else {
  for (const p of problems) console.log(`  ✗ ${p}`);
  process.exitCode = 1;
}
