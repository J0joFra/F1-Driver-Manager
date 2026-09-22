/**
 * Verifica il flusso delle offerte di contratto.
 *
 * Nel gioco quelle schermate compaiono solo dopo due o tre stagioni, quindi
 * sarebbero fuori portata per lo strumento di cattura. Qui il mondo viene
 * fatto avanzare dal motore, iniettato nel salvataggio, e si controlla che
 * l'interfaccia blocchi l'avanzamento finché non si firma.
 *
 *   npm run build && npm run preview &
 *   node tools/check-offers.mjs [cartella-di-output]
 */
import { chromium } from 'playwright';
import { execSync } from 'node:child_process';

// Mondo preparato dal motore: si avanza finché il contratto scade.
const gen = `
import { startCareer } from './src/engine/career.js';
import { advanceWeek, endSeason } from './src/engine/world.js';
import { SEASON_WEEKS } from './src/engine/season.js';
const w = startCareer({ seed: 11, name: 'L. Marchetti', nationality: 'ITA' });
for (let i = 0; i < 6 && w.offers.length === 0; i++) {
  while (w.week < SEASON_WEEKS) advanceWeek(w);
  endSeason(w);
}
process.stdout.write(JSON.stringify({ world: w, screen: 'contratti', pendingRace: null }));
`;
import { writeFileSync } from 'node:fs';
writeFileSync('gen-offers.tmp.ts', gen);
const state = execSync('npx tsx gen-offers.tmp.ts', { encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 });
const parsed = JSON.parse(state);
console.log('offerte generate:', parsed.world.offers.length, '· anno', parsed.world.year);

const b = await chromium.launch(process.env.CHROMIUM_PATH ? { executablePath: process.env.CHROMIUM_PATH } : {});
const p = await b.newPage({ viewport: { width: 844, height: 390 }, deviceScaleFactor: 2 });
const errs = [];
p.on('pageerror', (e) => errs.push(e.message));
await p.addInitScript((payload) => {
  localStorage.setItem('f1dm-save-v1', JSON.stringify({ state: payload, version: 1 }));
}, parsed);
await p.goto('http://localhost:4173/', { waitUntil: 'networkidle' });
await p.waitForTimeout(500);
const out = process.argv[2] ?? 'screenshots';
await (await import('node:fs/promises')).mkdir(out, { recursive: true });
await p.screenshot({ path: `${out}/07b-offerte.png` });

const advanceDisabled = await p.locator('[data-testid=advance]').isDisabled();
console.log('avanzamento bloccato con offerte aperte:', advanceDisabled);

const first = await p.locator('[data-testid^=accept-]').first();
const teamId = (await first.getAttribute('data-testid')).replace('accept-', '');
await first.click();
await p.waitForTimeout(400);
await p.screenshot({ path: `${out}/07c-dopo-firma.png` });
console.log('firmato con:', teamId, '· avanzamento ora bloccato:',
  await p.locator('[data-testid=advance]').isDisabled());
console.log('errori:', errs.length ? errs : 'nessuno');
await b.close();
(await import('node:fs/promises')).unlink('gen-offers.tmp.ts').catch(() => {});
if (errs.length || !advanceDisabled) process.exitCode = 1;
