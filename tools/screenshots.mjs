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
  const problems = await page.evaluate(() => {
    const root = document.getElementById('root');
    const found = [];
    const overflow = root.scrollHeight - window.innerHeight;
    if (overflow > 1) found.push(`la pagina scorre di ${overflow}px in verticale`);
    // Un pannello che sborda dal viewport non fa scorrere la pagina (il body
    // è in overflow hidden): si vede solo tagliato, quindi va cercato a parte.
    for (const el of root.querySelectorAll('.panel')) {
      const r = el.getBoundingClientRect();
      if (r.bottom > window.innerHeight + 1) {
        found.push(`un pannello sfora di ${Math.round(r.bottom - window.innerHeight)}px in basso`);
        break;
      }
      if (r.right > window.innerWidth + 1) {
        found.push(`un pannello sfora di ${Math.round(r.right - window.innerWidth)}px a destra`);
        break;
      }
    }
    // Contenuto più alto del proprio contenitore, che però non può scorrere:
    // si vede tagliato e non c'è modo di raggiungerlo. È il difetto che
    // ricompare a ogni schermata nuova, quindi lo cerchiamo a ogni cattura.
    for (const el of root.querySelectorAll('.panel *')) {
      if (el.scrollHeight - el.clientHeight <= 4) continue;
      const overflow = getComputedStyle(el).overflowY;
      if (overflow === 'auto' || overflow === 'scroll') continue;
      const label = el.className?.baseVal ?? String(el.className ?? '');
      found.push(
        `contenuto tagliato di ${el.scrollHeight - el.clientHeight}px in "${label.slice(0, 48)}"`,
      );
      break;
    }
    return found;
  });
  if (problems.length) throw new Error(`${where}: ${problems.join(' · ')}`);
}

await page.goto('http://localhost:4173/', { waitUntil: 'networkidle' });
await shot('01-nuova-carriera');

await page.fill('#driver-name', 'L. Marchetti');
await page.click('[data-testid=start-career]');
await page.waitForTimeout(300);
await shot('02-paddock');
await noVerticalScroll('paddock');

for (const [screen, file] of [
  ['allenamento', '03-allenamento'],
  ['pilota', '04-pilota'],
  ['calendario', '04b-calendario'],
  ['finanze', '05-finanze'],
  ['scuderia', '06-scuderia'],
  ['contratti', '07-contratti'],
  ['classifiche', '08-classifiche'],
  ['storia', '09-storia'],
]) {
  await page.click(`[data-testid=nav-${screen}]`);
  await page.waitForTimeout(120);
  await shot(file);
  await noVerticalScroll(screen);
}

// Avanza fino alla prima gara
for (let i = 0; i < 10; i++) {
  if (await page.locator('[data-testid=go-racing]').count()) break;
  await page.click('[data-testid=advance]', { timeout: 4000 });
  await page.waitForTimeout(150);
}
await shot('10-griglia');
await noVerticalScroll('griglia');

await page.click('[data-testid=go-racing]');
await page.waitForTimeout(2500);
await shot('11-gara');
await noVerticalScroll('gara');

await page.click('button:has-text("4×")');
await page.waitForTimeout(2500);
await shot('12-gara-veloce');

await page.click('[data-testid=skip-race]');
await page.waitForTimeout(900);
await shot('13-risultato');
await noVerticalScroll('risultato');

console.log(`Schermate salvate in ${out}/`);
console.log('Errori in console:', errors.length ? errors : 'nessuno');
await browser.close();
if (errors.length) process.exitCode = 1;
