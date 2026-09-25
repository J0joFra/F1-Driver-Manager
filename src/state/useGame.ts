import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import type { CarKey, ProjectSize, RaceResult, TrainingPlan, World } from '../engine/types.js';
import { unlockSkill as unlock } from '../engine/skills.js';
import type { QualifyingPlan } from '../engine/qualifying.js';
import {
  advanceDay, endSeason, finishPendingRace,
  type DayReport, type SeasonSummary, type WeekReport,
} from '../engine/world.js';
import {
  releaseDriver, renewDriver, signDriver, startTeam,
  type StartTeamOptions, type Terms,
} from '../engine/team.js';
import { cancelProject, startProject } from '../engine/projects.js';
import { injectCash, convertSkillTokens, rushProject } from '../engine/boosts.js';
import { fromSeason, fromWeekend } from '../engine/tracking.js';
import { useProfile } from './useProfile.js';
import { firstFreeSlot, saveSlot } from './saves.js';
import { commitWeekend, SEASON_WEEKS } from '../engine/season.js';
import { migrateWorld } from '../engine/migrate.js';
import { beginRace, currentRace, endRace } from './raceSession.js';

/**
 * Lo stato dell'app è il mondo del motore, più una manciata di flag di
 * interfaccia. Nessuna regola di gioco vive qui: questo file sposta dati,
 * non decide nulla.
 */

/** Dove si entra: il menu, o la partita. */
export type Stage = 'menu' | 'gioco';

export type Screen =
  | 'paddock'
  | 'scuderia'
  | 'sviluppo'
  | 'piloti'
  | 'profilo'
  | 'mercato'
  | 'calendario'
  | 'finanze'
  | 'classifiche'
  | 'abilita'
  | 'storia';

/** Si può avanzare solo se non c'è una gara da giocare. */
function canAdvance(world: World | null, pendingRace: string | null): world is World {
  return !(!world || world.week >= SEASON_WEEKS || pendingRace);
}

/**
 * Un giorno di mondo. Il weekend si ferma prima del via: la gara la guarda il
 * giocatore, e sarà `completeRace` a registrarla.
 */
function stepDay(
  world: World, plans: Record<string, TrainingPlan>, minigameScore?: number,
): DayReport {
  return advanceDay(world, {
    plans,
    ...(minigameScore !== undefined ? { minigameScore } : {}),
    deferRace: true,
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

/** Il programma con cui parte un pilota appena ingaggiato. */
export function defaultPlan(): TrainingPlan {
  return { simulator: 1, fitness: 0, engineering: 0, media: 0 };
}

interface GameState {
  world: World | null;
  /**
   * Menu o partita.
   *
   * Prima bastava «c'è un mondo o non c'è»: aprire l'app con una carriera in
   * corso ti buttava dentro la partita, e non c'era modo di tornare indietro
   * per caricarne un'altra. Adesso il menu è uno stato, e un mondo caricato
   * non implica esserci entrato.
   */
  stage: Stage;
  /** lo slot su cui questa partita si salva */
  slot: number | null;
  screen: Screen;
  /**
   * Il programma settimanale di ciascun pilota, per id.
   *
   * Uno per pilota e non uno solo: due monoposto vogliono dire anche decidere
   * che uno lavori al simulatore mentre l'altro sta in palestra.
   */
  plans: Record<string, TrainingPlan>;
  setPlan: (driverId: string, plan: TrainingPlan) => void;
  /** il pilota aperto nelle schede di dettaglio */
  selected: string | null;
  select: (driverId: string | null) => void;
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
  /** l'ultimo rifiuto del mercato, da mostrare accanto al pulsante */
  refusal: string | null;
  openGrid: () => void;
  startRace: () => void;
  completeRace: (results: RaceResult[], safetyCars: number) => void;
  newGame: (opts: StartTeamOptions & { slot?: number }) => void;
  /** entra in una partita già caricata */
  openSlot: (slot: number, world: World) => void;
  /** salva e torna al menu */
  toMenu: () => void;
  continueGame: () => void;
  abandon: () => void;
  /** versa crediti del portafoglio nella cassa della scuderia */
  injectCredits: (credits: number) => boolean;
  /** converte gettoni abilità in punti per un tuo pilota */
  spendSkillTokens: (driverId: string, tokens: number) => boolean;
  /** accorcia un progetto con i gettoni ricerca */
  rush: (projectId: string, tokens: number) => boolean;
  goTo: (screen: Screen) => void;
  /** fissa le tre decisioni della qualifica di sabato */
  setQualifyingPlan: (plan: QualifyingPlan) => void;
  /** spende un punto abilità di un tuo pilota sul nodo scelto */
  unlockSkill: (driverId: string, id: string) => void;
  sign: (driverId: string, terms: Terms) => void;
  renew: (driverId: string, terms: Terms) => void;
  release: (driverId: string) => void;
  openProject: (area: CarKey, size: ProjectSize) => void;
  closeProject: (projectId: string) => void;
  /** avanza di un giorno: è l'unità di tempo del gioco */
  advance: (minigameScore?: number) => DayReport | null;
  /** avanza fino al venerdì del prossimo weekend di gara, o alla fine della stagione */
  skipToWeekend: () => DayReport | null;
  closeSeason: () => SeasonSummary | null;
  dismissSummary: () => void;
}

/**
 * Sale a ogni campo nuovo nel mondo. La `migrate` qui sotto riempie ciò che
 * manca: un salvataggio vecchio deve continuare una partita, non cancellarla.
 */
const SAVE_VERSION = 6;

export const useGame = create<GameState>()(
  persist(
    (set, get) => ({
      world: null,
      stage: 'menu',
      slot: null,
      screen: 'paddock',
      plans: {},
      selected: null,
      lastWeek: null,
      lastDay: null,
      lastSeason: null,
      pendingRace: null,
      raceRunning: false,
      gridReady: false,
      refusal: null,

      setPlan: (driverId, plan) => set({ plans: { ...get().plans, [driverId]: plan } }),
      select: (driverId) => set({ selected: driverId }),

      newGame: ({ slot, ...opts }) => {
        endRace();
        const world = startTeam(opts);
        const chosen = slot ?? firstFreeSlot() ?? 0;
        saveSlot(chosen, world);
        set({
          world, stage: 'gioco', slot: chosen, screen: 'mercato', plans: {}, selected: null,
          lastWeek: null, lastSeason: null, pendingRace: null,
          raceRunning: false, gridReady: false, refusal: null,
        });
      },

      openSlot: (slot, world) => {
        endRace();
        set({
          world, stage: 'gioco', slot, screen: 'paddock', plans: {}, selected: null,
          lastWeek: null, lastSeason: null, pendingRace: null,
          raceRunning: false, gridReady: false, refusal: null,
        });
      },

      continueGame: () => {
        if (get().world) set({ stage: 'gioco' });
      },

      /**
       * Torna al menu, scrivendo prima lo slot.
       *
       * Il mondo attivo si salva da solo a ogni cambiamento, ma lo slot no:
       * scriverlo a ogni giorno avanzato vorrebbe dire duecento chilobyte
       * ogni volta che si preme «Avanza». Si scrive quando si esce, a fine
       * gara e a fine stagione — i tre momenti in cui perdere qualcosa
       * farebbe davvero male.
       */
      toMenu: () => {
        const { world, slot } = get();
        if (world && slot !== null) saveSlot(slot, world);
        set({ stage: 'menu' });
      },

      injectCredits: (credits) => {
        const world = get().world;
        const team = world?.seat.mode === 'scuderia' ? world.teams[world.seat.teamId] : null;
        if (!world || !team) return false;
        // Il portafoglio è l'unica fonte di verità: si prova a pagare da lì, e
        // solo se il pagamento riesce la cassa si muove.
        const wallet = { ...useProfile.getState().profile.wallet };
        if (!injectCash(wallet, team, credits)) return false;
        useProfile.getState().pay({ credits });
        set({ world: { ...world } });
        return true;
      },

      spendSkillTokens: (driverId, tokens) => {
        const world = get().world;
        const driver = world?.drivers[driverId];
        if (!world || !driver) return false;
        const wallet = { ...useProfile.getState().profile.wallet };
        if (!convertSkillTokens(wallet, driver, tokens)) return false;
        useProfile.getState().pay({ skill: tokens });
        set({ world: { ...world } });
        return true;
      },

      rush: (projectId, tokens) => {
        const world = get().world;
        const team = world?.seat.mode === 'scuderia' ? world.teams[world.seat.teamId] : null;
        const project = team?.projects.find((p) => p.id === projectId);
        if (!world || !team || !project) return false;
        const wallet = { ...useProfile.getState().profile.wallet };
        if (!rushProject(wallet, team, project, tokens)) return false;
        useProfile.getState().pay({ research: tokens });
        set({ world: { ...world } });
        return true;
      },

      abandon: () => {
        endRace();
        set({
          world: null, stage: 'menu', slot: null, lastWeek: null, lastDay: null,
          lastSeason: null, plans: {}, selected: null, pendingRace: null,
          raceRunning: false, gridReady: false, screen: 'paddock', refusal: null,
        });
      },

      goTo: (screen) => set({ screen, refusal: null }),

      setQualifyingPlan: (plan) => {
        const world = get().world;
        if (!world) return;
        world.qualifyingPlan = plan;
        set({ world: { ...world } });
      },

      unlockSkill: (driverId, id) => {
        const world = get().world;
        const d = world?.drivers[driverId];
        if (!world || !d) return;
        if (unlock(d, id)) set({ world: { ...world } });
      },

      sign: (driverId, terms) => {
        const world = get().world;
        if (!world) return;
        const refusal = signDriver(world, driverId, terms);
        set({ world: { ...world }, refusal });
      },

      renew: (driverId, terms) => {
        const world = get().world;
        if (!world) return;
        const refusal = renewDriver(world, driverId, terms);
        set({ world: { ...world }, refusal });
      },

      release: (driverId) => {
        const world = get().world;
        if (!world) return;
        const refusal = releaseDriver(world, driverId);
        set({ world: { ...world }, refusal, selected: null });
      },

      openProject: (area, size) => {
        const world = get().world;
        const team = world?.seat.mode === 'scuderia' ? world.teams[world.seat.teamId] : null;
        if (!world || !team) return;
        startProject(team, area, size, world.year, world.week);
        set({ world: { ...world }, refusal: null });
      },

      closeProject: (projectId) => {
        const world = get().world;
        const team = world?.seat.mode === 'scuderia' ? world.teams[world.seat.teamId] : null;
        if (!world || !team) return;
        cancelProject(team, projectId);
        set({ world: { ...world } });
      },

      advance: (minigameScore) => {
        const world = get().world;
        if (!canAdvance(world, get().pendingRace)) return null;
        const report = stepDay(world, get().plans, minigameScore);
        commitStep(set, world, report);
        return report;
      },

      /**
       * Trecento giorni all'anno e ventiquattro gare: avanzare a mano fino al
       * prossimo weekend sarebbe un lavoro, non una scelta. Questo salta ai
       * giorni che contano e si ferma appena succede qualcosa.
       */
      skipToWeekend: () => {
        const world = get().world;
        if (!canAdvance(world, get().pendingRace)) return null;
        let report: DayReport | null = null;
        for (let guard = 0; guard < SEASON_WEEKS * 7; guard++) {
          report = stepDay(world, get().plans);
          if (report.pendingRace || report.raceRun || report.seasonOver) break;
          // Ci si ferma al venerdì di un weekend di gara: da lì in avanti ogni
          // giorno ha qualcosa da decidere.
          if (world.schedule[world.week]?.trackId && world.dayOfWeek >= 4) break;
        }
        if (report) commitStep(set, world, report);
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
        // Il weekend appena corso fa avanzare gli obiettivi del profilo.
        useProfile.getState().track(fromWeekend(world, results));
        const slot = get().slot;
        if (slot !== null) saveSlot(slot, world);
        set({
          world: { ...world }, lastWeek: report, pendingRace: null,
          raceRunning: false, gridReady: false,
        });
      },

      closeSeason: () => {
        const world = get().world;
        if (!world || get().pendingRace) return null;
        // Prima la contabilità della stagione, poi la chiusura: `endSeason`
        // azzera le classifiche, e dopo non c'è più niente da contare.
        useProfile.getState().trackSeason(fromSeason(world));
        const summary = endSeason(world);
        const slot = get().slot;
        if (slot !== null) saveSlot(slot, world);
        set({ world: { ...world }, lastSeason: summary, lastWeek: null });
        return summary;
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
      partialize: (s) => ({
        world: s.world, screen: s.screen, pendingRace: s.pendingRace,
        plans: s.plans, slot: s.slot,
      }) as never,
    },
  ),
);

export const seasonWeeks = SEASON_WEEKS;
