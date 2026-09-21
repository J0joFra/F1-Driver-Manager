/**
 * Cattura le schermate dell'app a 844×390 — un telefono in orizzontale — e
 * verifica che la pagina non scorra mai in verticale: è una regressione facile
 * da introdurre e invisibile su desktop.
 *
 *   npm run build && npm run preview &
 *   node tools/screenshots.mjs [cartella-di-output]
 *
 * Dove il binario di Chromium non è quello che Playwright si aspetta, passare
 * CHROMIUM_PATH.
 */
import { chromium } from 'playwright';
import { mkdir } from 'node:fs/promises';

const out = process.argv[2] ?? 'screenshots';
await mkdir(out, { recursive: true });

const browser = await chromium.launch(
  process.env.CHROMIUM_PATH ? { executablePath: process.env.CHROMIUM_PATH } : {},
);
const page = await browser.newPage({ viewport: { width: 844, height: 390 }, deviceScaleFactor: 2 });

const errors = [];
page.on('console', (m) => {
  // Il proxy dell'ambiente di sviluppo rompe i font di Google: non è un errore dell'app.
  if (m.type() === 'error' && !m.text().includes('CERT')) errors.push(m.text());
});
page.on('pageerror', (e) => errors.push(`PAGEERROR ${e.message}`));

const shot = (name) => page.screenshot({ path: `${out}/${name}.png` });

async function noVerticalScroll(where) {
  const overflow = await page.evaluate(
    () => document.getElementById('root').scrollHeight - window.innerHeight,
  );
  if (overflow > 1) throw new Error(`${where}: la pagina scorre di ${overflow}px in verticale`);
}

await page.goto('http://localhost:4173/', { waitUntil: 'networkidle' });
await shot('01-nuova-carriera');

await page.fill('#driver-name', 'L. Marchetti');
await page.click('[data-testid=start-career]');
await page.waitForTimeout(300);
await shot('02-paddock');
await noVerticalScroll('paddock');

for (const [nav, file] of [
  ['Allena', '03-allenamento'],
  ['Pilota', '04-pilota'],
  ['Soldi', '05-finanze'],
  ['Team', '06-scuderia'],
  ['Classif.', '07-classifiche'],
  ['Storia', '08-storia'],
]) {
  await page.click(`nav button:has-text("${nav}")`);
  await page.waitForTimeout(120);
  await shot(file);
  await noVerticalScroll(nav);
}

// Avanza fino alla prima gara
for (let i = 0; i < 10; i++) {
  if (await page.locator('[data-testid=go-racing]').count()) break;
  await page.click('[data-testid=advance]', { timeout: 4000 });
  await page.waitForTimeout(150);
}
await shot('09-griglia');
await noVerticalScroll('griglia');

await page.click('[data-testid=go-racing]');
await page.waitForTimeout(2500);
await shot('10-gara');
await noVerticalScroll('gara');

await page.click('button:has-text("4×")');
await page.waitForTimeout(2500);
await shot('11-gara-veloce');

await page.click('[data-testid=skip-race]');
await page.waitForTimeout(900);
await shot('12-risultato');
await noVerticalScroll('risultato');

console.log(`Schermate salvate in ${out}/`);
console.log('Errori in console:', errors.length ? errors : 'nessuno');
await browser.close();
if (errors.length) process.exitCode = 1;
