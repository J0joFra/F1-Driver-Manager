/**
 * Controllo della palette.
 *
 * I colori delle scuderie non sono decorativi: sono anche i colori delle barre
 * in tutte le classifiche, quindi devono funzionare come palette categorica su
 * un fondo chiaro. Questo verifica tre cose che a occhio non si vedono —
 * contrasto sul fondo, separazione fra tinte adiacenti, e che la separazione
 * regga anche per chi non distingue il rosso dal verde o il blu dal giallo.
 *
 *   npm run check:palette
 */
import { readFileSync } from 'node:fs';
import { COLORS as C } from '../src/theme.js';

const TEAM_KEYS = ['aurora', 'vantar', 'kestrel', 'mirage', 'nordvik', 'solaro', 'brandt', 'kaizen'];
/** Coppie testo/fondo che devono restare leggibili. */
const TEXT_PAIRS = [
  ['ink', 'ground', 4.5], ['ink', 'panel', 4.5], ['ink', 'panel2', 4.5],
  ['muted', 'panel', 4.5], ['dim', 'panel', 3], ['primary', 'panel', 4.5],
  ['accent', 'panel', 4.5], ['bad', 'panel', 4], ['good', 'panel', 3],
];
/** Soglie: 3:1 basta per una barra, 9 di ΔE per distinguere due tinte. */
const MIN_TEAM_CONTRAST = 4.5;
const MIN_DELTA_E = 9;

const hex = (h) => [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16) / 255);
const toLinear = (c) => (c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4);
const luminance = (h) => {
  const [r, g, b] = hex(h).map(toLinear);
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
};
const contrast = (a, b) => {
  const [x, y] = [luminance(a), luminance(b)].sort((p, q) => q - p);
  return (x + 0.05) / (y + 0.05);
};

/** Matrici di Viénot–Brettel–Mollon sul lineare: le tre dicromazie. */
const DICHROMACY = {
  protanopia:   [[0.1121, 0.8853, -0.0005], [0.1127, 0.8897, -0.0001], [0.0045, 0.0085, 1.0000]],
  deuteranopia: [[0.2920, 0.7054, -0.0003], [0.2934, 0.7089, 0.0000], [-0.0209, 0.4055, 0.6155]],
  tritanopia:   [[1.0000, 0.1440, -0.1440], [0.0000, 0.8590, 0.1410], [0.0000, 0.2830, 0.7170]],
};

const simulate = (h, kind) => {
  const lin = hex(h).map(toLinear);
  return DICHROMACY[kind].map((row) => row.reduce((s, k, i) => s + k * lin[i], 0));
};

/** Lab da RGB lineare, per una distanza percettiva (ΔE76: basta allo scopo). */
function lab(linear) {
  const [r, g, b] = linear.map((v) => Math.max(0, Math.min(1, v)));
  const x = (0.4124 * r + 0.3576 * g + 0.1805 * b) / 0.9505;
  const y = 0.2126 * r + 0.7152 * g + 0.0722 * b;
  const z = (0.0193 * r + 0.1192 * g + 0.9505 * b) / 1.089;
  const f = (t) => (t > 0.008856 ? Math.cbrt(t) : 7.787 * t + 16 / 116);
  return [116 * f(y) - 16, 500 * (f(x) - f(y)), 200 * (f(y) - f(z))];
}

const deltaE = (a, b) => Math.hypot(...lab(a).map((v, i) => v - lab(b)[i]));

const problems = [];
/** Margine più stretto trovato: serve a sapere quanto si è vicini al limite. */
let tightest = { what: '', slack: Infinity };
const note = (what, value, min) => {
  const slack = value - min;
  if (slack < tightest.slack) tightest = { what, slack };
};

for (const [fg, bg, min] of TEXT_PAIRS) {
  const ratio = contrast(C[fg], C[bg]);
  if (ratio < min) problems.push(`${fg} su ${bg}: ${ratio.toFixed(2)}:1, serve ${min}:1`);
}

for (const key of TEAM_KEYS) {
  const ratio = contrast(C[key], C.panel);
  if (ratio < MIN_TEAM_CONTRAST) {
    problems.push(`${key} sul pannello: ${ratio.toFixed(2)}:1, serve ${MIN_TEAM_CONTRAST}:1`);
  }
  // Il colore di marca non può essere confuso con una scuderia: è l'unico
  // rosso che significa "premi qui".
  const brand = deltaE(hex(C[key]).map(toLinear), hex(C.primary).map(toLinear));
  if (brand < MIN_DELTA_E * 1.5) {
    problems.push(`${key} è troppo vicino al rosso di marca: ΔE ${brand.toFixed(1)}`);
  }
}

// Le scuderie portano il loro colore dentro al motore, che non può importare
// il tema: qui si verifica che le due liste non siano divergute in silenzio.
const seeds = readFileSync(new URL('../src/engine/data/teams.ts', import.meta.url), 'utf8');
for (const key of TEAM_KEYS) {
  const found = new RegExp(`\\{ id: '${key}',[\\s\\S]*?colour: '(#[0-9A-Fa-f]{6})'`).exec(seeds);
  if (!found) problems.push(`${key}: nessun colore in data/teams.ts`);
  else if (found[1].toUpperCase() !== C[key].toUpperCase()) {
    problems.push(`${key}: data/teams.ts dice ${found[1]}, il tema dice ${C[key]}`);
  }
}

for (const vision of ['normale', ...Object.keys(DICHROMACY)]) {
  for (let i = 0; i < TEAM_KEYS.length; i++) {
    for (let j = i + 1; j < TEAM_KEYS.length; j++) {
      const [a, b] = [TEAM_KEYS[i], TEAM_KEYS[j]];
      const conv = (h) => (vision === 'normale' ? hex(h).map(toLinear) : simulate(h, vision));
      const d = deltaE(conv(C[a]), conv(C[b]));
      if (d < MIN_DELTA_E) problems.push(`${a}/${b} indistinguibili in ${vision}: ΔE ${d.toFixed(1)}`);
      else note(`${a}/${b} in ${vision}`, d, MIN_DELTA_E);
    }
  }
}

/*
 * I colori che il giocatore può dare alla propria scuderia.
 *
 * Vanno misurati contro le otto della griglia, non solo fra loro: una tinta
 * uguale a quella di una squadra esistente rende la tua indistinguibile in
 * classifica e sul tracciato. È esattamente com'erano nella prima versione —
 * sette su otto erano copie esatte di un colore già in uso.
 */
const PLAYER_COLOURS = (
  readFileSync(new URL('../src/ui/screens/NewGame.tsx', import.meta.url), 'utf8')
    .match(/const COLOURS = \[([^\]]+)\]/)?.[1] ?? ''
).match(/#[0-9A-Fa-f]{6}/g) ?? [];

if (PLAYER_COLOURS.length === 0) {
  problems.push('non trovo i colori offerti al giocatore in NewGame.tsx');
}

for (const colour of PLAYER_COLOURS) {
  const ratio = contrast(colour, C.panel);
  if (ratio < MIN_TEAM_CONTRAST) {
    problems.push(`colore giocatore ${colour} sul pannello: ${ratio.toFixed(2)}:1`);
  }
  for (const vision of ['normale', ...Object.keys(DICHROMACY)]) {
    const conv = (h) => (vision === 'normale' ? hex(h).map(toLinear) : simulate(h, vision));
    for (const key of TEAM_KEYS) {
      const d = deltaE(conv(colour), conv(C[key]));
      if (d < MIN_DELTA_E) {
        problems.push(`colore giocatore ${colour} non si distingue da ${key} in ${vision}: ΔE ${d.toFixed(1)}`);
      } else note(`giocatore ${colour}/${key} in ${vision}`, d, MIN_DELTA_E);
    }
    /*
     * Fra loro **non** devono distinguersi, e chiederlo sarebbe un errore: il
     * giocatore ne sceglie uno solo, e due tinte simili nella tavolozza non si
     * incontrano mai in classifica. L'unico confronto che conta è quello con
     * le otto scuderie che vedrà ogni domenica. Pretendere anche la
     * separazione reciproca costringeva la tavolozza su sei toni di blu,
     * perché lo spazio rimasto libero dalla griglia è stretto.
     */
  }
}

if (problems.length) {
  console.error(`Palette: ${problems.length} problemi\n  ${problems.join('\n  ')}`);
  process.exit(1);
}
console.log(
  `Palette: ${TEAM_KEYS.length} colori scuderia + ${PLAYER_COLOURS.length} per il giocatore, ` +
  'contrasti e separazioni a posto.\n' +
  `Margine più stretto: ${tightest.what}, ΔE ${(MIN_DELTA_E + tightest.slack).toFixed(1)} ` +
  `contro un minimo di ${MIN_DELTA_E}.`,
);
