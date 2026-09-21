import type { CarRating } from '../types.js';

export interface TeamSeed {
  id: string;
  name: string;
  /** palette validata per daltonismo (ΔE ≥ 9 fra tinte adiacenti) */
  colour: string;
  car: CarRating;
  budget: number;
  prestige: number;
  crew: { technical: number; trackEngineer: number; pitCrew: number };
}

/** Griglia di partenza del mondo: 5 scuderie, 2 vetture ciascuna. */
export const TEAM_SEEDS: readonly TeamSeed[] = [
  { id: 'vantar',  name: 'Vantar Racing',    colour: '#3E86F0', budget: 135_000_000, prestige: 92,
    car: { aero: 95, engine: 96, chassis: 94, reliability: 90 },
    crew: { technical: 91, trackEngineer: 88, pitCrew: 90 } },
  { id: 'kestrel', name: 'Kestrel Motors',   colour: '#12A06E', budget: 132_000_000, prestige: 86,
    car: { aero: 93, engine: 89, chassis: 92, reliability: 88 },
    crew: { technical: 87, trackEngineer: 86, pitCrew: 84 } },
  { id: 'aurora',  name: 'Scuderia Aurora',  colour: '#E8283C', budget: 121_000_000, prestige: 78,
    car: { aero: 81, engine: 88, chassis: 83, reliability: 79 },
    crew: { technical: 74, trackEngineer: 69, pitCrew: 71 } },
  { id: 'mirage',  name: 'Mirage GP',        colour: '#D4761E', budget: 104_000_000, prestige: 63,
    car: { aero: 79, engine: 80, chassis: 78, reliability: 82 },
    crew: { technical: 68, trackEngineer: 71, pitCrew: 66 } },
  { id: 'nordvik', name: 'Nordvik Squadra',  colour: '#A06BE0', budget: 88_000_000,  prestige: 44,
    car: { aero: 72, engine: 74, chassis: 71, reliability: 76 },
    crew: { technical: 59, trackEngineer: 62, pitCrew: 58 } },
];
