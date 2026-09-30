import type { CarRating } from '../types.js';

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
  car: CarRating;
  budget: number;
  prestige: number;
  crew: { technical: number; trackEngineer: number; pitCrew: number };
}

/**
 * Otto scuderie, due vetture ciascuna: sedici al via, punti ai primi dieci.
 *
 * ## Perché i valori delle monoposto stanno tutti fra 80 e 91
 *
 * Andavano da 70 a 95, ed era il numero che rendeva le gare illeggibili.
 * Venticinque punti di scarto, moltiplicati per quanto vale un punto sul giro,
 * facevano 2,3 secondi fra la prima e l'ultima — che su cinquantotto giri sono
 * due giri di distacco. Il campo arrivava spalmato su sette giri e mezzo, e una
 * scuderia nuova non correva contro nessuno: veniva doppiata da tutti, sempre.
 *
 * Questi valori vanno letti insieme a `CAR_PACE_PER_POINT`: sono la stessa
 * decisione presa in due punti, e quello che conta è il prodotto. Undici punti
 * di scarto per 0,058 secondi a punto fanno sei decimi al giro fra la prima e
 * l'ultima, che è una griglia in cui si corre.
 *
 * La gerarchia non sparisce: si ricostruisce da sola in poche stagioni, perché
 * lo sviluppo segue il bilancio e il bilancio segue i risultati. A quarant'anni
 * il campo torna a spalmarsi su due secondi — è la misura `lapTimeSpread`, che
 * non si è mossa. Quello che cambia è **il punto di partenza**, cioè gli unici
 * anni in cui una scuderia appena fondata sta correndo.
 *
 * Il margine è stretto: comprimendo ancora, il ricambio dei campioni scende
 * sotto il minimo su almeno un seed. Questa è la fine della corda.
 */
export const TEAM_SEEDS: readonly TeamSeed[] = [
  { id: 'vantar',  name: 'Vantar Racing', short: 'Vantar',   colour: '#1B4DB1', budget: 135_000_000, prestige: 92,
    car: { aero: 91, engine: 91, chassis: 90, reliability: 89 },
    crew: { technical: 91, trackEngineer: 88, pitCrew: 90 } },
  { id: 'kestrel', name: 'Kestrel Motors', short: 'Kestrel',  colour: '#0F7B5A', budget: 133_000_000, prestige: 86,
    car: { aero: 90, engine: 88, chassis: 90, reliability: 88 },
    crew: { technical: 87, trackEngineer: 86, pitCrew: 84 } },
  { id: 'aurora',  name: 'Scuderia Aurora', short: 'Aurora', colour: '#A01030', budget: 128_000_000, prestige: 79,
    car: { aero: 88, engine: 89, chassis: 88, reliability: 86 },
    crew: { technical: 80, trackEngineer: 77, pitCrew: 78 } },
  { id: 'solaro',  name: 'Solaro Corse', short: 'Solaro',    colour: '#0E7C97', budget: 121_000_000, prestige: 71,
    car: { aero: 86, engine: 87, chassis: 86, reliability: 87 },
    crew: { technical: 76, trackEngineer: 79, pitCrew: 73 } },
  { id: 'mirage',  name: 'Mirage GP', short: 'Mirage',       colour: '#B85C00', budget: 112_000_000, prestige: 63,
    car: { aero: 85, engine: 85, chassis: 84, reliability: 86 },
    crew: { technical: 70, trackEngineer: 72, pitCrew: 68 } },
  { id: 'brandt',  name: 'Brandt Werke', short: 'Brandt',    colour: '#C43E86', budget: 104_000_000, prestige: 55,
    car: { aero: 84, engine: 84, chassis: 83, reliability: 85 },
    crew: { technical: 66, trackEngineer: 67, pitCrew: 65 } },
  { id: 'nordvik', name: 'Nordvik Squadra', short: 'Nordvik', colour: '#8A5FC7', budget: 95_000_000,  prestige: 46,
    car: { aero: 82, engine: 83, chassis: 82, reliability: 84 },
    crew: { technical: 60, trackEngineer: 63, pitCrew: 59 } },
  { id: 'kaizen',  name: 'Kaizen Racing', short: 'Kaizen',   colour: '#6B6820', budget: 88_000_000,  prestige: 38,
    car: { aero: 81, engine: 81, chassis: 80, reliability: 82 },
    crew: { technical: 56, trackEngineer: 58, pitCrew: 55 } },
];
