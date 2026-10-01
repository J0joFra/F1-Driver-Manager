import type { Tier } from '../tiers.js';

export interface TeamSeed {
  id: string;
  name: string;
  /** Nome breve per le colonne strette: non è mai la prima parola del nome. */
  short: string;
  /**
   * Palette validata per daltonismo sul fondo scuro: banda di luminosità,
   * soglia di croma, contrasto ≥ 3:1 e separazione ΔE fra tinte adiacenti.
   * L'unica coppia sotto soglia (rosa/ciano in deuteranopia) è sempre
   * accompagnata dal nome della scuderia, quindi il colore non è mai l'unico
   * elemento che distingue una riga.
   */
  colour: string;
  /** La fascia decide la monoposto: dentro una fascia sono tutte uguali. */
  tier: Tier;
  budget: number;
  prestige: number;
  crew: { technical: number; trackEngineer: number; pitCrew: number };
}

/**
 * Undici scuderie, due vetture ciascuna: ventidue al via, punti ai primi dieci.
 *
 * ## La monoposto non sta più qui
 *
 * Ogni seme portava i suoi quattro valori, scritti a mano. Adesso porta una
 * **fascia**, e i valori li dà `TIER_CAR`: due scuderie di fascia B hanno la
 * stessa identica macchina, e quello che le separa in pista sono i piloti e lo
 * staff tecnico. La macchina decide in che campionato corri; il resto decide
 * dove arrivi dentro quel campionato.
 *
 * ## Perché la griglia resta larga circa sei decimi
 *
 * I valori andavano da 70 a 95, ed era il numero che rendeva le gare
 * illeggibili: venticinque punti di scarto facevano 2,3 secondi al giro, cioè
 * due giri di distacco su una gara, e una scuderia nuova non correva contro
 * nessuno. Poi sono stati compressi a 80–91 con una pendenza continua; adesso
 * sono gli stessi undici punti, ma a scalini.
 *
 * Va letto insieme a `CAR_PACE_PER_POINT`: sono la stessa decisione presa in
 * due punti, e quello che conta è il prodotto. Dalla fascia A alla D corrono
 * circa sei decimi al giro, che è una griglia in cui si corre.
 *
 * ## I colori
 *
 * Due in più delle otto di prima, e non è stato un dettaglio: dieci tinte
 * categoriche che reggano contrasto, separazione ΔE **e** tre dicromazie sono
 * al limite del possibile. Cercandole esaustivamente su tutto lo spazio — con
 * il vincolo che nessuna sia confondibile nemmeno con i sei colori che il
 * giocatore può dare alla propria scuderia — ne restavano **esattamente due**,
 * ed è la coppia qui sotto. Non si cambiano a occhio: si cambia un valore e si
 * rilancia `npm run check:palette`.
 */
export const TEAM_SEEDS: readonly TeamSeed[] = [
  { id: 'vantar',  name: 'Vantar Racing', short: 'Vantar',   colour: '#1B4DB1', budget: 135_000_000, prestige: 92,
    tier: 'A', crew: { technical: 91, trackEngineer: 88, pitCrew: 90 } },
  { id: 'kestrel', name: 'Kestrel Motors', short: 'Kestrel',  colour: '#0F7B5A', budget: 133_000_000, prestige: 86,
    tier: 'A', crew: { technical: 87, trackEngineer: 86, pitCrew: 84 } },
  { id: 'aurora',  name: 'Scuderia Aurora', short: 'Aurora', colour: '#A01030', budget: 128_000_000, prestige: 79,
    tier: 'B', crew: { technical: 80, trackEngineer: 77, pitCrew: 78 } },
  { id: 'solaro',  name: 'Solaro Corse', short: 'Solaro',    colour: '#0E7C97', budget: 121_000_000, prestige: 71,
    tier: 'B', crew: { technical: 76, trackEngineer: 79, pitCrew: 73 } },
  { id: 'tiberio', name: 'Tiberio Corse', short: 'Tiberio',  colour: '#0066AA', budget: 118_000_000, prestige: 67,
    tier: 'B', crew: { technical: 74, trackEngineer: 74, pitCrew: 72 } },
  { id: 'mirage',  name: 'Mirage GP', short: 'Mirage',       colour: '#B85C00', budget: 112_000_000, prestige: 63,
    tier: 'C', crew: { technical: 70, trackEngineer: 72, pitCrew: 68 } },
  { id: 'brandt',  name: 'Brandt Werke', short: 'Brandt',    colour: '#C43E86', budget: 104_000_000, prestige: 55,
    tier: 'C', crew: { technical: 66, trackEngineer: 67, pitCrew: 65 } },
  { id: 'draeger', name: 'Draeger Motorsport', short: 'Draeger', colour: '#664400', budget: 99_000_000, prestige: 50,
    tier: 'C', crew: { technical: 63, trackEngineer: 65, pitCrew: 62 } },
  { id: 'nordvik', name: 'Nordvik Squadra', short: 'Nordvik', colour: '#8A5FC7', budget: 95_000_000,  prestige: 46,
    tier: 'D', crew: { technical: 60, trackEngineer: 63, pitCrew: 59 } },
  { id: 'kaizen',  name: 'Kaizen Racing', short: 'Kaizen',   colour: '#6B6820', budget: 88_000_000,  prestige: 38,
    tier: 'D', crew: { technical: 56, trackEngineer: 58, pitCrew: 55 } },
];
