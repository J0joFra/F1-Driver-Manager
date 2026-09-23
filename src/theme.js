/**
 * I colori del gioco, in un posto solo.
 *
 * Li leggono tre consumatori diversi: `tailwind.config.js` per generare le
 * classi, `src/ui/palette.ts` per quel che si disegna con `style` (barre,
 * pallini SVG, pip), e `tools/check-palette.mjs` per verificarli. Prima i
 * colori "a mano" vivevano sparsi nei componenti, e cambiare tema ne lasciava
 * indietro metà.
 *
 * Tema chiaro, sul rosso e bianco di GridUP: il fondo è grigio chiarissimo e
 * non bianco pieno, così le schede bianche si staccano senza bordi pesanti.
 */
export const COLORS = {
  ground: '#F1F4F8',
  panel: '#FFFFFF',
  panel2: '#F7F9FC',
  panel3: '#E7EDF5',
  line: '#D8E0EB',
  ink: '#0F1826',
  muted: '#516072',
  dim: '#7C8A9C',

  // Il rosso di marca è l'unico rosso che significa "premi qui": nessuna
  // scuderia può avvicinarglisi, e `npm run check:palette` lo verifica.
  primary: '#E10600',
  accent: '#9A5B00',

  // Colori scuderia, scelti per un fondo chiaro e verificati anche in
  // protanopia, deuteranopia e tritanopia. Otto tinte categoriche che
  // sopravvivono a tre dicromazie stanno al limite del possibile: il margine
  // più stretto è ΔE 9.9 contro un minimo di 9, quindi non si toccano a
  // occhio — si cambia un valore e si rilancia il controllo.
  aurora: '#A01030',
  vantar: '#1B4DB1',
  kestrel: '#0F7B5A',
  mirage: '#B85C00',
  nordvik: '#8A5FC7',
  solaro: '#0E7C97',
  brandt: '#C43E86',
  kaizen: '#6B6820',

  // Le mescole: rosso, giallo, bianco è la convenzione della Formula 1, ma su
  // fondo chiaro il bianco sparisce e il giallo non si legge. Restano tre
  // tinte riconoscibili e scure quanto basta, e la lettera S/M/H resta
  // sempre accanto al colore.
  tyreSoft: '#C81E2E',
  tyreMedium: '#8A6400',
  tyreHard: '#46536A',

  good: '#067647',
  warn: '#B54708',
  bad: '#C4231A',
};
