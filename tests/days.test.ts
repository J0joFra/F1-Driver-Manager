import { describe, expect, it } from 'vitest';
import { createWorld, advanceDay, advanceWeek } from '../src/engine/world.js';
import { SEASON_WEEKS, type WeekKind } from '../src/engine/calendar.js';
import {
  COMMIT_DAY, DAYS_IN_WEEK, RACE_DAY, TRAINING_DAYS, sessionsByDay, weekActivities,
} from '../src/engine/days.js';
import { driverStandings } from '../src/engine/season.js';
import type { TrainingPlan } from '../src/engine/types.js';
import { TRAINING_CATEGORIES } from '../src/engine/training.js';

const KINDS: WeekKind[] = ['testing', 'race', 'free', 'summerBreak', 'postseason'];
const PLAN: TrainingPlan = { simulator: 3, fitness: 2, engineering: 1, media: 0 };

describe('la settimana giorno per giorno', () => {
  it('avanzare a giorni dà lo stesso mondo di avanzare a settimane', () => {
    const byWeek = createWorld({ seed: 99 });
    const byDay = createWorld({ seed: 99 });

    while (byWeek.week < SEASON_WEEKS) advanceWeek(byWeek, { plan: PLAN });
    while (byDay.week < SEASON_WEEKS) advanceDay(byDay, { plan: PLAN });

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
      advanceDay(w, { plan: PLAN });
      days++;
    }
    expect(days).toBe(SEASON_WEEKS * DAYS_IN_WEEK);
  });

  it('il lavoro della settimana si mette a bilancio una volta sola', () => {
    const w = createWorld({ seed: 7 });
    let commits = 0;
    for (let i = 0; i < DAYS_IN_WEEK * 4; i++) {
      if (advanceDay(w, { plan: PLAN }).trainingApplied) commits++;
    }
    expect(commits).toBe(4);
  });

  it('si corre solo di domenica, e solo nelle settimane di gara', () => {
    const w = createWorld({ seed: 31 });
    while (w.week < SEASON_WEEKS) {
      const week = w.schedule[w.week]!;
      const expectRace = week.trackId !== null && w.dayOfWeek === RACE_DAY;
      const report = advanceDay(w, { plan: PLAN });
      expect(!!report.raceRun, `sett. ${week.index} giorno ${report.day}`).toBe(expectRace);
    }
  });

  it('il giorno di bilancio è l\'ultimo di allenamento', () => {
    for (const kind of KINDS) {
      const days = TRAINING_DAYS[kind];
      if (days.length === 0) {
        expect(COMMIT_DAY[kind], kind).toBe(0);
        continue;
      }
      expect(COMMIT_DAY[kind], kind).toBe(days[days.length - 1]);
      // Il bilancio non può cadere dopo la gara: gli allenamenti della
      // settimana devono contare per il weekend, non per quello dopo.
      expect(COMMIT_DAY[kind], kind).toBeLessThan(RACE_DAY);
    }
  });

  it('le sessioni del piano finiscono tutte in calendario', () => {
    const total = TRAINING_CATEGORIES.reduce((s, c) => s + PLAN[c], 0);
    for (const kind of KINDS) {
      const byDay = sessionsByDay(PLAN, kind);
      const placed = byDay.reduce((s, d) => s + d.length, 0);
      expect(placed, kind).toBe(TRAINING_DAYS[kind].length > 0 ? total : 0);
      // Nessuna sessione fuori dalle giornate di allenamento.
      byDay.forEach((sessions, day) => {
        if (sessions.length > 0) expect(TRAINING_DAYS[kind], kind).toContain(day);
      });
    }
  });

  it('ogni giorno di ogni settimana ha qualcosa da dire', () => {
    for (const kind of KINDS) {
      const days = weekActivities(kind, PLAN, kind === 'race');
      expect(days, kind).toHaveLength(DAYS_IN_WEEK);
      days.forEach((activities, i) => {
        expect(activities.length, `${kind} giorno ${i}`).toBeGreaterThan(0);
        // L'etichetta corta deve reggere una casella da settanta pixel.
        for (const a of activities) expect(a.short.length, a.short).toBeLessThanOrEqual(11);
      });
    }
  });
});
