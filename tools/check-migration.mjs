/**
 * Verifica che un salvataggio scritto da una versione precedente venga
 * recuperato invece di mandare in crash l'app.
 *
 * Riproduce il difetto vero: `world.offers` è arrivato con i contratti, e
 * senza migrazione ogni carriera già iniziata si apriva su uno schermo nero.
 *
 *   npm run build && npm run preview &
 *   node tools/check-migration.mjs
 */
import { chromium } from 'playwright';
import { execSync } from 'node:child_process';
import { writeFileSync, unlinkSync } from 'node:fs';

const gen = `
import { startCareer } from './src/engine/career.js';
import { advanceWeek } from './src/engine/world.js';
const w = startCareer({ seed: 5, name: 'L. Marchetti', nationality: 'ITA' });
for (let i = 0; i < 3; i++) advanceWeek(w);
const old = JSON.parse(JSON.stringify(w));
// Com'era il salvataggio prima dei contratti e dei nomi brevi.
delete old.offers;
delete old.talentAnchor;
for (const t of Object.values(old.teams)) delete t.short;
process.stdout.write(JSON.stringify(old));
`;
writeFileSync('gen-old-save.tmp.ts', gen);
const oldWorld = JSON.parse(execSync('npx tsx gen-old-save.tmp.ts', { encoding: 'utf8', maxBuffer: 64e6 }));
unlinkSync('gen-old-save.tmp.ts');

const browser = await chromium.launch(
  process.env.CHROMIUM_PATH ? { executablePath: process.env.CHROMIUM_PATH } : {},
);
const page = await browser.newPage({ viewport: { width: 844, height: 390 } });
const errors = [];
page.on('pageerror', (e) => errors.push(e.message));

// Il salvataggio vecchio porta ancora la versione 1.
await page.addInitScript((world) => {
  localStorage.setItem('f1dm-save-v1', JSON.stringify({
    state: { world, screen: 'paddock' },
    version: 1,
  }));
}, oldWorld);

await page.goto('http://localhost:4173/', { waitUntil: 'networkidle' });
await page.waitForTimeout(600);

const recovered = await page.locator('[data-testid=advance]').count();
const crashed = await page.getByText('Qualcosa si è rotto').count();
const body = (await page.locator('body').innerText()).slice(0, 80).replace(/\n/g, ' · ');

console.log('errori in console:', errors.length ? errors : 'nessuno');
console.log('carriera ripresa (barra di stato presente):', recovered === 1);
console.log('rete di sicurezza scattata:', crashed > 0);
console.log('schermata:', body);

// Secondo caso: un salvataggio corrotto che supera la migrazione ma rompe il
// render (il sedile punta a un pilota che non esiste). Serve a controllare che
// la rete di sicurezza non sia codice morto.
const page2 = await browser.newPage({ viewport: { width: 844, height: 390 } });
const broken = structuredClone(oldWorld);
broken.seat = { mode: 'pilota', driverId: 'pilota-inesistente' };
await page2.addInitScript((world) => {
  localStorage.setItem('f1dm-save-v1', JSON.stringify({
    state: { world, screen: 'paddock' },
    version: 1,
  }));
}, broken);
await page2.goto('http://localhost:4173/', { waitUntil: 'networkidle' });
await page2.waitForTimeout(600);
const caught = await page2.getByText('Qualcosa si è rotto').count();
const canRestart = await page2.getByRole('button', { name: /ricomincia/i }).count();
console.log('\nsalvataggio corrotto → rete di sicurezza:', caught > 0);
console.log('offre di ricominciare:', canRestart > 0);

await browser.close();
if (errors.length || recovered !== 1 || caught === 0 || canRestart === 0) process.exitCode = 1;
