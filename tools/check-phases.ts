/**
 * Il bonus di fase non deve congelare la griglia.
 *
 * È il rischio dichiarato del premio a tre fasi: paga chi ha fatto punti, cioè
 * spinge nella direzione **opposta** all'handicap di `deliveredGain`, che
 * esiste apposta perché la classifica di partenza non sia la classifica per
 * sempre. Se la curva del bonus fosse ripida, chi vince svilupperebbe di più,
 * vincerebbe di più, e in tre stagioni non ci sarebbe più un campionato.
 *
 * Qui si misurano le tre cose che lo direbbero: quanto si muovono le fasce,
 * quanto spesso cambia la scuderia campione, e se chi è in fondo riesce ancora
 * a salire.
 */
import { createWorld, advanceWeek, endSeason } from '../src/engine/world.js';
import { SEASON_WEEKS } from '../src/engine/calendar.js';
import { phaseBonusFor, PHASE_BONUS_CAP, PHASE_BONUS_BASE } from '../src/engine/phases.js';
import { TIERS, type Tier } from '../src/engine/tiers.js';

const SEEDS = [1, 2, 3, 4, 5, 6, 7, 8];
const SEASONS = 16;

let moves = 0;
let seasons = 0;
const championTeams: Set<string>[] = [];
/** Per ogni mondo: quante scuderie hanno visitato la fascia A. */
const touchedA: number[] = [];
/** Di chi partiva in fascia D, quante sono salite almeno una volta. */
let startedLow = 0;
let climbed = 0;

for (const seed of SEEDS) {
  const world = createWorld({ seed });
  const startTier: Record<string, Tier> = {};
  for (const t of Object.values(world.teams)) startTier[t.id] = t.tier;
  const everInA = new Set<string>();
  const everUp = new Set<string>();

  for (let i = 0; i < SEASONS; i++) {
    while (world.week < SEASON_WEEKS) advanceWeek(world);
    const summary = endSeason(world);
    moves += summary.tierMoves.length / 2;
    seasons += 1;
    for (const t of Object.values(world.teams)) {
      if (t.tier === 'A') everInA.add(t.id);
      if (TIERS.indexOf(t.tier) < TIERS.indexOf(startTier[t.id]!)) everUp.add(t.id);
    }
  }
  championTeams.push(new Set(world.champions.map((c) => c.teamId)));
  touchedA.push(everInA.size);
  for (const id of Object.keys(startTier)) {
    if (startTier[id] !== 'D') continue;
    startedLow += 1;
    if (everUp.has(id)) climbed += 1;
  }
}

const avg = (a: number[]) => a.reduce((x, y) => x + y, 0) / a.length;
const championSpread = avg(championTeams.map((s) => s.size));

console.log(`\n${SEEDS.length} mondi × ${SEASONS} stagioni\n`);
console.log(`bonus di fase          ${PHASE_BONUS_BASE.toFixed(1)} – ${PHASE_BONUS_CAP.toFixed(1)} punti`);
console.log(`  chi non segna        ${phaseBonusFor(0).toFixed(2)}`);
console.log(`  chi fa 90 punti      ${phaseBonusFor(90).toFixed(2)}`);
console.log(`  chi domina (240)     ${phaseBonusFor(240).toFixed(2)}`);
console.log(`\nscambi di fascia       ${(moves / seasons).toFixed(2)} a stagione`);
console.log(`scuderie passate per A ${avg(touchedA).toFixed(1)} su 10`);
console.log(`scuderie campioni      ${championSpread.toFixed(1)} su ${SEASONS} stagioni`);
console.log(`chi partiva in D ed è salito almeno una volta: ${climbed}/${startedLow}`);

const problems: string[] = [];
const check = (ok: boolean, msg: string) => { if (!ok) problems.push(msg); };

check(moves / seasons >= 0.5,
  `le fasce si muovono ${(moves / seasons).toFixed(2)} volte a stagione: la griglia è congelata`);
check(avg(touchedA) >= 3.5,
  `solo ${avg(touchedA).toFixed(1)} scuderie su 10 vedono la fascia A in ${SEASONS} stagioni`);
check(championSpread >= 2.5,
  `${championSpread.toFixed(1)} scuderie campioni in ${SEASONS} stagioni: vince sempre la stessa`);
check(climbed / Math.max(1, startedLow) >= 0.5,
  `solo ${climbed} su ${startedLow} di chi partiva in fondo è mai salito di fascia`);

// E il bonus deve restare un riconoscimento, non una leva: fra chi domina e
// chi non segna non ci può essere un ordine di grandezza.
check(phaseBonusFor(240) / phaseBonusFor(0) <= 2.6,
  `il bonus di chi domina vale ${(phaseBonusFor(240) / phaseBonusFor(0)).toFixed(1)}× quello di chi non segna`);

if (problems.length === 0) {
  console.log('\nok — il premio paga i risultati senza chiudere il campionato');
} else {
  console.log('');
  for (const p of problems) console.log(`  ✗ ${p}`);
  process.exitCode = 1;
}
