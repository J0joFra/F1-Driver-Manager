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

/** Otto scuderie, due vetture ciascuna: sedici al via, punti ai primi dieci. */
export const TEAM_SEEDS: readonly TeamSeed[] = [
  { id: 'vantar',  name: 'Vantar Racing', short: 'Vantar',   colour: '#3E86F0', budget: 135_000_000, prestige: 92,
    car: { aero: 95, engine: 96, chassis: 94, reliability: 90 },
    crew: { technical: 91, trackEngineer: 88, pitCrew: 90 } },
  { id: 'kestrel', name: 'Kestrel Motors', short: 'Kestrel',  colour: '#12A06E', budget: 133_000_000, prestige: 86,
    car: { aero: 93, engine: 89, chassis: 92, reliability: 88 },
    crew: { technical: 87, trackEngineer: 86, pitCrew: 84 } },
  { id: 'aurora',  name: 'Scuderia Aurora', short: 'Aurora', colour: '#E8283C', budget: 128_000_000, prestige: 79,
    car: { aero: 87, engine: 90, chassis: 88, reliability: 83 },
    crew: { technical: 80, trackEngineer: 77, pitCrew: 78 } },
  { id: 'solaro',  name: 'Solaro Corse', short: 'Solaro',    colour: '#0E9BB4', budget: 121_000_000, prestige: 71,
    car: { aero: 84, engine: 85, chassis: 83, reliability: 86 },
    crew: { technical: 76, trackEngineer: 79, pitCrew: 73 } },
  { id: 'mirage',  name: 'Mirage GP', short: 'Mirage',       colour: '#D4761E', budget: 112_000_000, prestige: 63,
    car: { aero: 80, engine: 81, chassis: 79, reliability: 82 },
    crew: { technical: 70, trackEngineer: 72, pitCrew: 68 } },
  { id: 'brandt',  name: 'Brandt Werke', short: 'Brandt',    colour: '#DE5AA2', budget: 104_000_000, prestige: 55,
    car: { aero: 77, engine: 79, chassis: 76, reliability: 80 },
    crew: { technical: 66, trackEngineer: 67, pitCrew: 65 } },
  { id: 'nordvik', name: 'Nordvik Squadra', short: 'Nordvik', colour: '#A06BE0', budget: 95_000_000,  prestige: 46,
    car: { aero: 73, engine: 75, chassis: 72, reliability: 77 },
    crew: { technical: 60, trackEngineer: 63, pitCrew: 59 } },
  { id: 'kaizen',  name: 'Kaizen Racing', short: 'Kaizen',   colour: '#94892A', budget: 88_000_000,  prestige: 38,
    car: { aero: 70, engine: 71, chassis: 69, reliability: 74 },
    crew: { technical: 56, trackEngineer: 58, pitCrew: 55 } },
];
