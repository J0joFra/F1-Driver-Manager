/**
 * La carriera di un pilota, misurata contro i campionati veri.
 *
 * Il gioco non ha più una Modalità Pilota, ma i piloti crescono ancora — è
 * metà di quello che una scuderia compra quando ingaggia un giovane. Questa
 * sonda verifica che la forma di una carriera nel mondo simulato assomigli a
 * quella dei mondiali veri, con lo **stesso metodo** con cui i dati sono stati
 * estratti da Supabase: una coorte fissa di piloti che hanno corso almeno otto
 * stagioni, seguiti uno per uno.
 *
 * Seguire una coorte fissa è il punto. La media di tutti i piloti migliora da
 * sola perché i peggiori smettono, e misurarla vorrebbe dire scambiare la
 * selezione per crescita — l'errore che i dati veri mostravano e che qui
 * sarebbe altrettanto facile ripetere.
 *
 *   npm run check:career
 */
import { createWorld, endSeason } from '../src/engine/world.js';
import { SEASON_WEEKS } from '../src/engine/calendar.js';
import { advanceWeek } from '../src/engine/world.js';
import { driverStandings } from '../src/engine/season.js';
import { overall } from '../src/engine/driver.js';
import { CAREER_BOUNDS, CAREER_PERCENTILE } from '../src/engine/careerCurve.js';

const WORLDS = 6;
const YEARS = 16;
/** Quante stagioni deve aver corso un pilota per entrare nella coorte. */
const MIN_SEASONS = 8;

const percentile: number[][] = Array.from({ length: MIN_SEASONS }, () => []);
const ability: number[][] = Array.from({ length: MIN_SEASONS }, () => []);
const improved: number[][] = Array.from({ length: MIN_SEASONS - 1 }, () => []);

for (let w = 0; w < WORLDS; w++) {
  const world = createWorld({ seed: 4000 + w });

  /** id → percentile e overall di ogni sua stagione, in ordine. */
  const career = new Map<string, { pct: number; ovr: number }[]>();

  for (let year = 0; year < YEARS; year++) {
    while (world.week < SEASON_WEEKS) advanceWeek(world);

    const table = driverStandings(world);
    for (const row of table) {
      const d = world.drivers[row.driverId];
      // Chi non ha corso non ha una stagione da registrare: a fine anno il
      // sedile ce l'ha solo chi era in griglia.
      if (!d || !d.teamId || d.retired) continue;
      const seasons = career.get(d.id) ?? [];
      seasons.push({ pct: row.position / table.length, ovr: overall(d.attrs) });
      career.set(d.id, seasons);
    }

    endSeason(world);
  }

  // La coorte: solo chi è arrivato a otto stagioni, e solo le sue prime otto.
  for (const seasons of career.values()) {
    if (seasons.length < MIN_SEASONS) continue;
    for (let s = 0; s < MIN_SEASONS; s++) {
      percentile[s]!.push(seasons[s]!.pct);
      ability[s]!.push(seasons[s]!.ovr);
      if (s > 0) improved[s - 1]!.push(seasons[s]!.pct < seasons[s - 1]!.pct ? 1 : 0);
    }
  }
}

const avg = (a: number[]) => (a.length > 0 ? a.reduce((x, y) => x + y, 0) / a.length : NaN);
const at = (rows: number[][], s: number) => avg(rows[s - 1]!);

const cohort = percentile[0]!.length;
console.log(`${WORLDS} mondi × ${YEARS} stagioni — coorte di ${cohort} piloti con almeno ${MIN_SEASONS} stagioni\n`);
console.log('st   gioco   reale   overall   migliora');
for (let s = 0; s < MIN_SEASONS; s++) {
  const rate = s > 0 ? `${(100 * avg(improved[s - 1]!)).toFixed(0)}%` : '—';
  console.log(
    ` ${s + 1}   ${avg(percentile[s]!).toFixed(3)}   ${CAREER_PERCENTILE[s]!.toFixed(3)}` +
    `    ${avg(ability[s]!).toFixed(1)}      ${rate}`,
  );
}
console.log('');

const problems: string[] = [];
const check = (ok: boolean, msg: string) => { if (!ok) problems.push(msg); };

check(cohort >= 20, `la coorte è di soli ${cohort} piloti: la misura non è affidabile`);

// Il gradino più grande è il primo: è il fatto più netto dei dati veri, il
// 63% di piloti che migliorano fra la prima e la seconda stagione contro il
// 52% di tutte le altre.
const firstStep = at(percentile, 1) - at(percentile, 2);
check(firstStep >= CAREER_BOUNDS.minFirstStep,
  `il gradino fra prima e seconda stagione è ${firstStep.toFixed(3)},` +
  ` sotto ${CAREER_BOUNDS.minFirstStep}`);
// Il vincolo vero: il primo gradino è il più grande di tutti.
const steps = Array.from({ length: MIN_SEASONS - 1 },
  (_, i) => at(percentile, i + 1) - at(percentile, i + 2));
check(steps.every((step, i) => i === 0 || step <= steps[0]!),
  'il gradino fra prima e seconda stagione non è il più grande della carriera');
check(at(improved, 1) > at(improved, 4),
  'migliorare alla seconda stagione non è più probabile che a metà carriera');

// Si migliora, e poi si smette: il picco dei dati veri è alla sesta stagione.
check(at(percentile, 6) < at(percentile, 1),
  'alla sesta stagione un pilota non è andato avanti rispetto al debutto');

// L'abilità cresce in modo affidabile, la posizione no. È la regola di
// progetto del gioco, ed è quella che va verificata per prima.
for (let s = 2; s <= MIN_SEASONS; s++) {
  check(at(ability, s) >= at(ability, s - 1) - 0.4,
    `l'overall medio cala fra la stagione ${s - 1} e la ${s}: allenarsi non paga`);
}
check(at(ability, MIN_SEASONS) - at(ability, 1) >= CAREER_BOUNDS.minOverallGain,
  `in otto stagioni l'overall cresce di ${(at(ability, MIN_SEASONS) - at(ability, 1)).toFixed(1)}` +
  ' punti soli: la crescita non si vede');

// E la posizione resta incerta, come nella realtà.
const rate = avg(improved.map(avg));
check(rate >= CAREER_BOUNDS.improvementRate[0] && rate <= CAREER_BOUNDS.improvementRate[1],
  `si migliora nel ${(100 * rate).toFixed(0)}% dei passaggi,` +
  ` fuori da ${CAREER_BOUNDS.improvementRate.map((x) => `${100 * x}%`).join('–')}`);

if (problems.length === 0) {
  console.log('ok — la carriera ha la forma di quelle vere');
} else {
  for (const p of problems) console.log(`  ✗ ${p}`);
  process.exitCode = 1;
}
