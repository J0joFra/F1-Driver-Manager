import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import type { RaceResult, TrainingPlan, World } from '../engine/types.js';
import { unlockSkill as unlock } from '../engine/skills.js';
import type { QualifyingPlan } from '../engine/qualifying.js';
import { advanceDay, endSeason, finishPendingRace, playerDriver, takeOffer, type DayReport, type SeasonSummary, type WeekReport } from '../engine/world.js';
import { startCareer, type StartCareerOptions } from '../engine/career.js';
import { commitWeekend, SEASON_WEEKS } from '../engine/season.js';
import { migrateWorld } from '../engine/migrate.js';
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
  | 'calendario'
  | 'finanze'
  | 'scuderia'
  | 'contratti'
  | 'classifiche'
  | 'abilita'
  | 'storia';

/** Si può avanzare solo se non c'è una gara da giocare o un contratto da firmare. */
function canAdvance(world: World | null, pendingRace: string | null): world is World {
  if (!world || world.week >= SEASON_WEEKS || pendingRace) return false;
  return (world.offers?.length ?? 0) === 0;
}

/**
 * Un giorno di mondo. Se il giocatore è in griglia il weekend si ferma prima
 * del via: la gara la corre lui, e sarà `completeRace` a registrarla.
 */
function stepDay(world: World, plan: TrainingPlan, minigameScore?: number): DayReport {
  return advanceDay(world, {
    plan,
    ...(minigameScore !== undefined ? { minigameScore } : {}),
    deferRace: world.seat.mode === 'pilota',
  });
}

/**
 * Il motore muta il mondo in posto: se ne prende una copia superficiale per
 * far scattare il render di React.
 */
function commitStep(
  set: (partial: Partial<GameState>) => void,
  world: World,
  report: DayReport,
): void {
  set({
    world: { ...world },
    lastDay: report,
    // Il riepilogo del weekend si apre solo quando la gara è stata corsa.
    lastWeek: report.raceRun
      ? {
          week: report.week, raceRun: report.raceRun, pendingRace: null,
          minigame: report.minigame, seasonOver: report.seasonOver,
        }
      : null,
    pendingRace: report.pendingRace,
    gridReady: false,
  });
}

interface GameState {
  world: World | null;
  screen: Screen;
  /** piano di allenamento corrente: si conserva da una settimana all'altra */
  plan: TrainingPlan;
  setPlan: (plan: TrainingPlan) => void;
  /** ultimo weekend corso, da mostrare come riepilogo */
  lastWeek: WeekReport | null;
  /** l'ultimo giorno avanzato: cosa è successo, per la barra di stato */
  lastDay: DayReport | null;
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
  /** accetta una delle offerte in attesa; senza, la stagione non riparte */
  acceptOffer: (teamId: string) => void;
  newGame: (opts: StartCareerOptions) => void;
  abandon: () => void;
  goTo: (screen: Screen) => void;
  /** avanza di un giorno: è l'unità di tempo del gioco */
  /** fissa le tre decisioni della qualifica di sabato */
  setQualifyingPlan: (plan: QualifyingPlan) => void;
  /** spende un punto abilità sul nodo scelto */
  unlockSkill: (id: string) => void;
  advance: (plan: TrainingPlan, minigameScore?: number) => DayReport | null;
  /** avanza fino al venerdì del prossimo weekend di gara, o alla fine della stagione */
  skipToWeekend: (plan: TrainingPlan) => DayReport | null;
  closeSeason: () => SeasonSummary | null;
  dismissSummary: () => void;
}

/**
 * Sale a ogni campo nuovo nel mondo. La `migrate` qui sotto riempie ciò che
 * manca: un salvataggio vecchio deve continuare una carriera, non cancellarla.
 */
const SAVE_VERSION = 4;

export const useGame = create<GameState>()(
  persist(
    (set, get) => ({
      world: null,
      screen: 'paddock',
      // Una sola sessione: è quanto concede una settimana di gara, che è
      // dove una carriera comincia.
      plan: { simulator: 1, fitness: 0, engineering: 0, media: 0 },
      setPlan: (plan) => set({ plan }),
      lastWeek: null,
      lastDay: null,
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
          world: null, lastWeek: null, lastDay: null, lastSeason: null,
          pendingRace: null, raceRunning: false, gridReady: false, screen: 'paddock',
        });
      },

      goTo: (screen) => set({ screen }),

      setQualifyingPlan: (plan) => {
        const world = get().world;
        if (!world) return;
        world.qualifyingPlan = plan;
        set({ world: { ...world } });
      },

      unlockSkill: (id) => {
        const world = get().world;
        const me = world ? playerDriver(world) : null;
        if (!world || !me) return;
        if (unlock(me, id)) set({ world: { ...world } });
      },

      advance: (plan, minigameScore) => {
        const world = get().world;
        if (!canAdvance(world, get().pendingRace)) return null;
        const report = stepDay(world!, plan, minigameScore);
        commitStep(set, world!, report);
        return report;
      },

      /**
       * Trecento giorni all'anno e ventiquattro gare: avanzare a mano fino al
       * prossimo weekend sarebbe un lavoro, non una scelta. Questo salta ai
       * giorni che contano e si ferma appena succede qualcosa.
       */
      skipToWeekend: (plan) => {
        const world = get().world;
        if (!canAdvance(world, get().pendingRace)) return null;
        let report: DayReport | null = null;
        for (let guard = 0; guard < SEASON_WEEKS * 7; guard++) {
          report = stepDay(world!, plan);
          if (report.pendingRace || report.raceRun || report.seasonOver) break;
          // Ci si ferma al venerdì di un weekend di gara: da lì in avanti ogni
          // giorno ha qualcosa da decidere.
          if (world!.schedule[world!.week]?.trackId && world!.dayOfWeek >= 4) break;
        }
        if (report) commitStep(set, world!, report);
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
        set({
          world: { ...world }, lastWeek: report, pendingRace: null,
          raceRunning: false, gridReady: false,
        });
      },

      closeSeason: () => {
        const world = get().world;
        if (!world || get().pendingRace) return null;
        const summary = endSeason(world);
        set({ world: { ...world }, lastSeason: summary, lastWeek: null });
        return summary;
      },

      acceptOffer: (teamId) => {
        const world = get().world;
        if (!world) return;
        if (takeOffer(world, teamId)) set({ world: { ...world } });
      },

      dismissSummary: () => set({ lastWeek: null, lastSeason: null }),
    }),
    {
      name: 'f1dm-save-v1',
      version: SAVE_VERSION,
      storage: createJSONStorage(() => localStorage),
      migrate: (persisted) => {
        const state = persisted as { world?: unknown } | undefined;
        const world = migrateWorld(state?.world);
        // Un salvataggio irrecuperabile riparte pulito invece di rompere l'app.
        return { ...(state ?? {}), world, pendingRace: null } as never;
      },
      // La gara in corso non si salva: contiene un generatore casuale, che è
      // una chiusura. Chi chiude l'app in gara la ritrova da rigiocare.
      partialize: (s) => ({ world: s.world, screen: s.screen, pendingRace: s.pendingRace }) as never,
    },
  ),
);

export const seasonWeeks = SEASON_WEEKS;
