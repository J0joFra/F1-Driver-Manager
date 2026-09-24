import { describe, expect, it } from 'vitest';
import { createWorld, advanceDay, advanceWeek } from '../src/engine/world.js';
import {
  SEASON_WEEKS, WEEK_TRAINING_CAPACITY, type SeasonWeek, type WeekKind,
} from '../src/engine/calendar.js';
import {
  commitDay, DAYS_IN_WEEK, RACE_DAY, trainingDays, sessionsByDay, weekActivities,
} from '../src/engine/days.js';
import { driverStandings } from '../src/engine/season.js';
import type { TrainingPlan } from '../src/engine/types.js';
import { TRAINING_CATEGORIES } from '../src/engine/training.js';

const KINDS: WeekKind[] = ['testing', 'race', 'free', 'summerBreak', 'postseason'];
const PLAN: TrainingPlan = { simulator: 1, fitness: 1, engineering: 0, media: 0 };
const PLANS: Record<string, TrainingPlan> = {};

/** Una settimana finta, per provare le viste senza costruire un mondo. */
const week = (kind: WeekKind, training: number, trackId: string | null = null): SeasonWeek =>
  ({ index: 0, kind, startDay: 0, trackId, round: trackId ? 1 : null, training });

describe('la settimana giorno per giorno', () => {
  it('avanzare a giorni dà lo stesso mondo di avanzare a settimane', () => {
    const byWeek = createWorld({ seed: 99 });
    const byDay = createWorld({ seed: 99 });

    while (byWeek.week < SEASON_WEEKS) advanceWeek(byWeek, { plans: PLANS });
    while (byDay.week < SEASON_WEEKS) advanceDay(byDay, { plans: PLANS });

    // Il campionato è il riassunto più severo: dipende da ogni gara e da ogni
    // allenamento di tutti i piloti.
    expect(driverStandings(byDay)).toEqual(driverStandings(byWeek));
    expect(byDay.round).toBe(byWeek.round);
    for (const id of Object.keys(byWeek.drivers)) {
      expect(byDay.drivers[id]!.attrs, id).toEqual(byWeek.drivers[id]!.attrs);
      expect(byDay.drivers[id]!.fatigue, id).toBeCloseTo(byWeek.drivers[id]!.fatigue, 10);
    }
  });

  it('una stagione a giorni dura sette volte le settimane', () => {
    const w = createWorld({ seed: 12 });
    let days = 0;
    while (w.week < SEASON_WEEKS) {
      advanceDay(w, { plans: PLANS });
      days++;
    }
    expect(days).toBe(SEASON_WEEKS * DAYS_IN_WEEK);
  });

  it('il lavoro della settimana si mette a bilancio una volta sola', () => {
    const w = createWorld({ seed: 7 });
    let commits = 0;
    for (let i = 0; i < DAYS_IN_WEEK * 4; i++) {
      if (advanceDay(w, { plans: PLANS }).trainingApplied) commits++;
    }
    expect(commits).toBe(4);
  });

  it('si corre solo di domenica, e solo nelle settimane di gara', () => {
    const w = createWorld({ seed: 31 });
    while (w.week < SEASON_WEEKS) {
      const week = w.schedule[w.week]!;
      const expectRace = week.trackId !== null && w.dayOfWeek === RACE_DAY;
      const report = advanceDay(w, { plans: PLANS });
      expect(!!report.raceRun, `sett. ${week.index} giorno ${report.day}`).toBe(expectRace);
    }
  });

  it('una sessione nelle settimane di gara, due in quelle libere', () => {
    const w = createWorld({ seed: 55 });
    for (const week of w.schedule) {
      if (week.trackId) expect(week.training, `sett. ${week.index}`).toBe(1);
      else if (week.kind === 'free') expect(week.training, `sett. ${week.index}`).toBe(2);
    }
  });

  it('nelle pause ci si allena una settimana sì e una no', () => {
    const w = createWorld({ seed: 55 });
    for (const kind of ['summerBreak', 'postseason'] as const) {
      const block = w.schedule.filter((x) => x.kind === kind);
      expect(block.length, kind).toBeGreaterThan(1);
      // Si riparte sempre allenandosi, poi si alterna.
      block.forEach((week, i) => {
        expect(week.training, `${kind} #${i}`).toBe(i % 2 === 0 ? 2 : 0);
      });
      // In vacanza, ma senza sparire: almeno una settimana di lavoro.
      expect(block.some((x) => x.training > 0), kind).toBe(true);
    }
  });

  it('il giorno di bilancio è l\'ultimo di allenamento', () => {
    for (let capacity = 0; capacity <= 5; capacity++) {
      const days = trainingDays(capacity);
      expect(days, `capienza ${capacity}`).toHaveLength(capacity);
      // Il bilancio non può cadere dopo la gara: gli allenamenti della
      // settimana devono contare per il weekend, non per quello dopo.
      expect(commitDay(capacity), `capienza ${capacity}`).toBeLessThan(RACE_DAY);
      if (capacity > 0) expect(commitDay(capacity)).toBe(days[days.length - 1]);
      else expect(commitDay(0)).toBe(0);
    }
  });

  it('le sessioni del piano finiscono tutte in calendario', () => {
    const total = TRAINING_CATEGORIES.reduce((s, c) => s + PLAN[c], 0);
    for (let capacity = 0; capacity <= 3; capacity++) {
      const byDay = sessionsByDay(PLAN, capacity);
      const placed = byDay.reduce((s, d) => s + d.length, 0);
      expect(placed, `capienza ${capacity}`).toBe(capacity > 0 ? total : 0);
      // Nessuna sessione fuori dalle giornate di allenamento.
      byDay.forEach((sessions, day) => {
        if (sessions.length > 0) expect(trainingDays(capacity)).toContain(day);
      });
    }
  });

  it('ogni giorno di ogni settimana ha qualcosa da dire', () => {
    for (const kind of KINDS) {
      for (const training of [0, WEEK_TRAINING_CAPACITY[kind]]) {
        const w = week(kind, training, kind === 'race' ? 'lario' : null);
        const days = weekActivities(w, PLAN);
        expect(days, kind).toHaveLength(DAYS_IN_WEEK);
        days.forEach((activities, i) => {
          expect(activities.length, `${kind}/${training} giorno ${i}`).toBeGreaterThan(0);
          // L'etichetta corta deve reggere una casella da settanta pixel.
          for (const a of activities) expect(a.short.length, a.short).toBeLessThanOrEqual(11);
        });
      }
    }
  });
});
