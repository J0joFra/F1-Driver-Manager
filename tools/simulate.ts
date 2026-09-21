/**
 * Simula N stagioni da riga di comando, senza interfaccia.
 *
 *   npm run sim -- --seasons 40 --seed 20260921 --verbose
 *
 * Serve a rispondere alle domande che una schermata non può rispondere:
 * la griglia resta viva dopo 40 anni? i rookie crescono? il mercato si muove?
 * gli attributi si gonfiano col tempo?
 */
import { createWorld, endSeason, advanceWeek, SEASON_WEEKS } from '../src/engine/index.js';
import { driverStandings, constructorStandings } from '../src/engine/season.js';
import { overall, potentialOverall } from '../src/engine/driver.js';
import type { World } from '../src/engine/types.js';

function arg(name: string, fallback: number): number {
  const i = process.argv.indexOf(`--${name}`);
  return i >= 0 && process.argv[i + 1] ? Number(process.argv[i + 1]) : fallback;
}
const VERBOSE = process.argv.includes('--verbose');

const seasons = arg('seasons', 40);
const seed = arg('seed', 20260921);

const world = createWorld({ seed });
const startYear = world.year;

interface Snapshot {
  year: number;
  champion: string;
  championTeam: string;
  points: number;
  gridOverall: number;
  gridPotential: number;
  meanAge: number;
  dnfRate: number;
  reset: boolean;
  activeDrivers: number;
  topTeam: string;
}

const log: Snapshot[] = [];
const titlesByTeam = new Map<string, number>();
const t0 = performance.now();

function gridStats(w: World) {
  const active = Object.values(w.drivers).filter((d) => !d.retired && d.teamId);
  const n = Math.max(1, active.length);
  return {
    overall: active.reduce((s, d) => s + overall(d.attrs), 0) / n,
    potential: active.reduce((s, d) => s + potentialOverall(d), 0) / n,
    age: active.reduce((s, d) => s + d.age, 0) / n,
    count: active.length,
  };
}

for (let i = 0; i < seasons; i++) {
  while (world.week < SEASON_WEEKS) advanceWeek(world);

  const stats = gridStats(world);
  const standings = driverStandings(world);
  const cons = constructorStandings(world);
  const races = world.results.length;
  const dnfs = world.results.reduce((s, w) => s + w.race.filter((r) => r.dnf).length, 0);
  const starts = world.results.reduce((s, w) => s + w.race.length, 0);
  const championId = standings[0]?.driverId ?? '';
  const champion = world.drivers[championId];
  const topTeamId = cons[0]?.teamId ?? '';

  const summary = endSeason(world);
  titlesByTeam.set(summary.championTeamId, (titlesByTeam.get(summary.championTeamId) ?? 0) + 1);

  log.push({
    year: summary.year,
    champion: champion?.name ?? '—',
    championTeam: world.teams[summary.championTeamId]?.name ?? '—',
    points: standings[0]?.points ?? 0,
    gridOverall: stats.overall,
    gridPotential: stats.potential,
    meanAge: stats.age,
    dnfRate: starts > 0 ? dnfs / starts : 0,
    reset: summary.regulationReset,
    activeDrivers: stats.count,
    topTeam: world.teams[topTeamId]?.name ?? '—',
  });

  if (VERBOSE) {
    const r = log[log.length - 1]!;
    console.log(
      `${r.year}  ${r.champion.padEnd(22)} ${r.championTeam.padEnd(17)} ${String(r.points).padStart(3)} pt` +
      `   overall ${r.gridOverall.toFixed(1)}  pot ${r.gridPotential.toFixed(1)}  età ${r.meanAge.toFixed(1)}` +
      `  DNF ${(r.dnfRate * 100).toFixed(1)}%  ${races} gare${r.reset ? '   ← NUOVO REGOLAMENTO' : ''}`,
    );
  }
}

const ms = performance.now() - t0;
const first = log[0]!;
const last = log[log.length - 1]!;
// Le prime stagioni sono un transitorio: la griglia di partenza converge verso
// il proprio livello di regime. L'inflazione vera è quella che viene dopo.
const settleIdx = Math.min(log.length - 1, 9);
const settled = log[settleIdx]!;
const drift = last.gridPotential - settled.gridPotential;
const champions = new Set(log.map((l) => l.champion));
const championTeams = new Set(log.map((l) => l.championTeam));
const avgDnf = log.reduce((s, l) => s + l.dnfRate, 0) / log.length;

console.log(`\n${'='.repeat(74)}`);
console.log(`${seasons} stagioni simulate (${startYear}–${last.year}) in ${ms.toFixed(0)} ms — seed ${seed}`);
console.log('='.repeat(74));
console.log(`Piloti diversi campioni ............ ${champions.size} su ${seasons} stagioni`);
console.log(`Scuderie diverse campioni .......... ${championTeams.size} su ${Object.keys(world.teams).length}`);
console.log(`Deriva a regime (dal ${settled.year}) ......... ${drift >= 0 ? '+' : ''}${drift.toFixed(2)} punti in ${last.year - settled.year} anni`);
console.log(`Transitorio iniziale ............... ${(settled.gridPotential - first.gridPotential >= 0 ? '+' : '')}${(settled.gridPotential - first.gridPotential).toFixed(2)} punti`);
console.log(`Overall medio griglia .............. ${first.gridOverall.toFixed(1)} → ${last.gridOverall.toFixed(1)}`);
console.log(`Età media della griglia ............ ${first.meanAge.toFixed(1)} → ${last.meanAge.toFixed(1)}`);
console.log(`Piloti attivi ...................... ${first.activeDrivers} → ${last.activeDrivers}`);
console.log(`Ritiri per gara .................... ${(avgDnf * 100).toFixed(1)}%`);
console.log(`Azzeramenti regolamentari .......... ${log.filter((l) => l.reset).length}`);
console.log('\nTitoli per scuderia:');
for (const [teamId, n] of [...titlesByTeam].sort((a, b) => b[1] - a[1])) {
  const name = world.teams[teamId]?.name ?? teamId;
  console.log(`  ${name.padEnd(18)} ${'█'.repeat(n)} ${n}`);
}
console.log();
