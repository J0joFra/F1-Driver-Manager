/**
 * Cattura le schermate dell'app a 844×390 — un telefono in orizzontale — e
 * verifica che la pagina non scorra mai in verticale.
 *
 *   npm run build && npm run preview &
 *   node tools/screenshots.mjs [cartella-di-output]
 *
 * In ambienti dove il binario di Chromium non è quello che Playwright si
 * aspetta, passare CHROMIUM_PATH.
 */
import { chromium } from 'playwright';
const out = process.argv[2] ?? 'screenshots';
await (await import('node:fs/promises')).mkdir(out, { recursive: true });
const b = await chromium.launch(process.env.CHROMIUM_PATH ? { executablePath: process.env.CHROMIUM_PATH } : {});
const p = await b.newPage({ viewport: { width: 844, height: 390 }, deviceScaleFactor: 2 });
const errs = [];
p.on('console', (m) => m.type() === 'error' && errs.push(m.text()));
p.on('pageerror', (e) => errs.push('PAGEERROR ' + e.message));

await p.goto('http://localhost:4173/', { waitUntil: 'networkidle' });
await p.screenshot({ path: `${out}/01-newgame.png` });

await p.fill('#driver-name', 'L. Marchetti');
await p.click('text=Inizia la carriera');
await p.waitForTimeout(400);
await p.screenshot({ path: `${out}/02-paddock.png` });

// avanza fino alla prima gara
for (let i = 0; i < 6; i++) {
  await p.click('header button:has-text("Avanza"), header button:has-text("Vai in pista")');
  await p.waitForTimeout(150);
  if (await p.locator('text=Ordine d\'arrivo').count()) break;
}
await p.screenshot({ path: `${out}/03-weekend.png` });
await p.click('button:has-text("Continua")').catch(() => {});
await p.waitForTimeout(200);

for (const [nav, file] of [['Allena', '04-allenamento'], ['Pilota', '05-pilota'], ['Classif.', '06-classifiche'], ['Soldi', '07-finanze'], ['Team', '08-scuderia']]) {
  await p.click(`nav button:has-text("${nav}")`);
  await p.waitForTimeout(150);
  await p.screenshot({ path: `${out}/${file}.png` });
}

// controllo che la pagina non scorra mai in verticale
const scroll = await p.evaluate(() => ({
  bodyScroll: document.body.scrollHeight - window.innerHeight,
  rootScroll: document.getElementById('root').scrollHeight - window.innerHeight,
  h: window.innerHeight,
}));
console.log('scroll check:', JSON.stringify(scroll));
console.log('errori console:', errs.length ? errs : 'nessuno');
await b.close();
