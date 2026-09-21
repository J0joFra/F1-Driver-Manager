import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import type { RaceResult, TrainingPlan, World } from '../engine/types.js';
import { advanceWeek, endSeason, finishPendingRace, type SeasonSummary, type WeekReport } from '../engine/world.js';
import { startCareer, type StartCareerOptions } from '../engine/career.js';
import { commitWeekend, SEASON_WEEKS } from '../engine/season.js';
import { beginRace, currentRace, endRace } from './raceSession.js';

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
  /** gara da giocare: la settimana resta ferma finché non è chiusa */
  pendingRace: string | null;
  /** true quando il cronometro della gara sta girando */
  raceRunning: boolean;
  /**
   * La gara è stata preparata ed è pronta da mostrare. Serve davvero: senza un
   * cambio di stato, `openGrid` preparerebbe la gara fuori da React e la
   * schermata della griglia resterebbe bianca, perché nulla farebbe scattare
   * un nuovo render.
   */
  gridReady: boolean;
  openGrid: () => void;
  startRace: () => void;
  completeRace: (results: RaceResult[], safetyCars: number) => void;
  newGame: (opts: StartCareerOptions) => void;
  abandon: () => void;
  goTo: (screen: Screen) => void;
  /** menu laterale ridotto a sole icone */
  sidebarCollapsed: boolean;
  toggleSidebar: () => void;
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
      pendingRace: null,
      raceRunning: false,
      gridReady: false,

      newGame: (opts) => {
        endRace();
        set({
          world: startCareer(opts), screen: 'paddock',
          lastWeek: null, lastSeason: null, pendingRace: null, raceRunning: false, gridReady: false,
        });
      },

      abandon: () => {
        endRace();
        set({
          world: null, lastWeek: null, lastSeason: null,
          pendingRace: null, raceRunning: false, gridReady: false, screen: 'paddock',
        });
      },

      goTo: (screen) => set({ screen }),

      sidebarCollapsed: false,
      toggleSidebar: () => set((s) => ({ sidebarCollapsed: !s.sidebarCollapsed })),

      advance: (plan, minigameScore) => {
        const world = get().world;
        if (!world || world.week >= SEASON_WEEKS || get().pendingRace) return null;
        // Se il giocatore è in griglia la settimana si ferma prima del via: la
        // gara la corre lui, e sarà `completeRace` a registrarla.
        const racing = world.seat.mode === 'pilota';
        const report = advanceWeek(world, {
          plan,
          ...(minigameScore !== undefined ? { minigameScore } : {}),
          deferRace: racing,
        });
        // Il motore muta il mondo in posto: se ne prende una copia superficiale
        // per far scattare il render di React.
        set({
          world: { ...world },
          lastWeek: report.pendingRace ? null : report,
          pendingRace: report.pendingRace,
          gridReady: false,
        });
        return report;
      },

      openGrid: () => {
        const { world, pendingRace, gridReady } = get();
        if (!world || !pendingRace || gridReady) return;
        if (!currentRace()) beginRace(world, pendingRace);
        set({ raceRunning: false, gridReady: true });
      },

      startRace: () => set({ raceRunning: true }),

      completeRace: (results, safetyCars) => {
        const world = get().world;
        const session = currentRace();
        if (!world || !session) return;
        const report = finishPendingRace(world, () => {
          commitWeekend(world, session.prepared, results, safetyCars);
        });
        endRace();
        set({ world: { ...world }, lastWeek: report, pendingRace: null, raceRunning: false, gridReady: false });
      },

      closeSeason: () => {
        const world = get().world;
        if (!world || get().pendingRace) return null;
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
      // La gara in corso non si salva: contiene un generatore casuale, che è
      // una chiusura. Chi chiude l'app in gara la ritrova da rigiocare.
      partialize: (s) => ({
        world: s.world, screen: s.screen, pendingRace: s.pendingRace,
        sidebarCollapsed: s.sidebarCollapsed,
      }) as never,
    },
  ),
);

export const seasonWeeks = SEASON_WEEKS;
