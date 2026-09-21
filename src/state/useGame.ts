import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import type { TrainingPlan, World } from '../engine/types.js';
import { advanceWeek, endSeason, type SeasonSummary, type WeekReport } from '../engine/world.js';
import { startCareer, type StartCareerOptions } from '../engine/career.js';
import { SEASON_WEEKS } from '../engine/season.js';

/**
 * Lo stato dell'app è il mondo del motore, più una manciata di flag di
 * interfaccia. Nessuna regola di gioco vive qui: questo file sposta dati,
 * non decide nulla.
 */

export type Screen =
  | 'paddock'
  | 'pilota'
  | 'allenamento'
  | 'finanze'
  | 'scuderia'
  | 'classifiche'
  | 'storia';

interface GameState {
  world: World | null;
  screen: Screen;
  /** piano di allenamento corrente: si conserva da una settimana all'altra */
  plan: TrainingPlan;
  setPlan: (plan: TrainingPlan) => void;
  /** ultimo weekend corso, da mostrare come riepilogo */
  lastWeek: WeekReport | null;
  lastSeason: SeasonSummary | null;
  newGame: (opts: StartCareerOptions) => void;
  abandon: () => void;
  goTo: (screen: Screen) => void;
  advance: (plan: TrainingPlan, minigameScore?: number) => WeekReport | null;
  closeSeason: () => SeasonSummary | null;
  dismissSummary: () => void;
}

const SAVE_VERSION = 1;

export const useGame = create<GameState>()(
  persist(
    (set, get) => ({
      world: null,
      screen: 'paddock',
      plan: { simulator: 3, fitness: 2, engineering: 1, media: 0 },
      setPlan: (plan) => set({ plan }),
      lastWeek: null,
      lastSeason: null,

      newGame: (opts) =>
        set({ world: startCareer(opts), screen: 'paddock', lastWeek: null, lastSeason: null }),

      abandon: () => set({ world: null, lastWeek: null, lastSeason: null, screen: 'paddock' }),

      goTo: (screen) => set({ screen }),

      advance: (plan, minigameScore) => {
        const world = get().world;
        if (!world || world.week >= SEASON_WEEKS) return null;
        // Il motore muta il mondo in posto: se ne prende una copia superficiale
        // per far scattare il render di React.
        const report = advanceWeek(world, { plan, ...(minigameScore !== undefined ? { minigameScore } : {}) });
        set({ world: { ...world }, lastWeek: report });
        return report;
      },

      closeSeason: () => {
        const world = get().world;
        if (!world) return null;
        const summary = endSeason(world);
        set({ world: { ...world }, lastSeason: summary, lastWeek: null });
        return summary;
      },

      dismissSummary: () => set({ lastWeek: null, lastSeason: null }),
    }),
    {
      name: 'f1dm-save-v1',
      version: SAVE_VERSION,
      storage: createJSONStorage(() => localStorage),
      partialize: (s) => ({ world: s.world, screen: s.screen }) as never,
    },
  ),
);

export const seasonWeeks = SEASON_WEEKS;
