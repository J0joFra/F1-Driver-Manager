import { useMemo } from 'react';
import type { TrainingPlan, World } from '../../engine/types.js';
import type { SeasonWeek } from '../../engine/calendar.js';
import { dayDate, weekMonday, type WeekKind } from '../../engine/calendar.js';
import { DAYS_IN_WEEK, WEEKDAY_SHORT, weekActivities, type DayActivity } from '../../engine/days.js';
import { getTrack, isNightRace } from '../../engine/data/tracks.js';
import { DAY_STYLE, NIGHT_ICON } from './dayStyle.js';

const DAY_MS = 86_400_000;

interface Cell {
  date: Date;
  inMonth: boolean;
  isToday: boolean;
  week: SeasonWeek | null;
  weekday: number;
  activities: DayActivity[];
}

/**
 * Il mese, sette colonne per riga.
 *
 * È l'impaginazione dei manageriali perché funziona: il colpo d'occhio dice
 * subito dove sono i weekend e quanto fiato c'è in mezzo, cosa che una lista
 * verticale non riesce a dare. La colonna di sinistra tiene il carattere
 * della settimana, che qui è l'equivalente dello stile di allenamento.
 */
export function MonthGrid({
  world, month, plan,
}: {
  world: World;
  /** mese mostrato, 0-based */
  month: number;
  /** il piano dà un nome alle giornate di allenamento */
  plan: TrainingPlan | null;
}) {
  const rows = useMemo(() => buildRows(world, month, plan), [world, month, plan]);

  return (
    <div className="flex flex-col min-h-0 h-full">
      <div className="grid grid-cols-[52px_repeat(7,1fr)] gap-px shrink-0 px-1 pb-1">
        <span />
        {WEEKDAY_SHORT.map((d) => (
          <span key={d} className="field-label text-dim text-center">{d}</span>
        ))}
      </div>

      <div className="flex-1 min-h-0 scroll-y px-1 pb-1 flex flex-col gap-px">
        {rows.map((row, i) => (
          <div
            key={i}
            // Una settimana fuori stagione non merita lo stesso spazio di una
            // piena: febbraio ha tre righe vuote, e a 390 px di altezza
            // regalare loro un quinto dello schermo sarebbe assurdo.
            className={`grid grid-cols-[52px_repeat(7,1fr)] gap-px
              ${row.busy ? 'h-[58px]' : 'h-[22px]'} shrink-0`}
          >
            <div className="flex items-center justify-center rounded-sm bg-panel2 px-1">
              <span className="field-label text-dim text-center leading-tight">
                {row.label}
              </span>
            </div>
            {row.cells.map((cell) => (
              <DayCell key={cell.date.getTime()} cell={cell} world={world} />
            ))}
          </div>
        ))}
      </div>
    </div>
  );
}

function DayCell({ cell, world }: { cell: Cell; world: World }) {
  const track = cell.week?.trackId ? getTrack(cell.week.trackId) : null;

  return (
    <div
      className={`rounded-sm px-1 pt-0.5 pb-1 flex flex-col gap-px overflow-hidden
        ${cell.isToday ? 'bg-primary/15 ring-1 ring-primary' : 'bg-panel2'}
        ${cell.inMonth ? '' : 'opacity-35'}`}
    >
      <span className={`font-mono text-[9px] tnum leading-none
        ${cell.isToday ? 'text-primary font-bold' : 'text-dim'}`}
      >
        {cell.date.getUTCDate()}
      </span>
      {cell.activities.slice(0, 3).map((activity, i) => (
        <Chip
          key={i}
          activity={activity}
          // La domenica di gara porta il nome del circuito: è l'unica cosa che
          // il giocatore cerca scorrendo il mese.
          label={activity.kind === 'race' && track ? track.name : activity.short}
          title={activity.kind === 'race' && track ? track.name : activity.label}
          night={activity.kind === 'race' && !!track && isNightRace(track)}
        />
      ))}
    </div>
  );
}

function Chip({ activity, label, title, night }: {
  activity: DayActivity; label: string; title: string; night: boolean;
}) {
  const style = DAY_STYLE[activity.kind];
  const Icon = night ? NIGHT_ICON : style.icon;
  return (
    <span
      className={`flex items-center gap-0.5 rounded-[2px] px-1 py-px
        font-mono text-[8.5px] leading-[1.3] truncate ${style.chip}`}
      title={title}
    >
      <Icon className="w-2 h-2 shrink-0" strokeWidth={2.2} />
      <span className="truncate">{label}</span>
    </span>
  );
}

/** Le righe del mese: una per settimana di calendario, anche fuori stagione. */
function buildRows(world: World, month: number, plan: TrainingPlan | null) {
  const byMonday = new Map<number, SeasonWeek>();
  for (const week of world.schedule) byMonday.set(weekMonday(world.year, week).getTime(), week);

  const first = new Date(Date.UTC(world.year, month, 1));
  const last = new Date(Date.UTC(world.year, month + 1, 0));
  // Il lunedì della settimana che contiene il primo del mese.
  const start = new Date(first.getTime() - ((first.getUTCDay() + 6) % 7) * DAY_MS);

  const todayWeek = world.schedule[world.week];
  const todayTime = todayWeek ? dayDate(world.year, todayWeek, world.dayOfWeek).getTime() : -1;

  const rows: { label: string; cells: Cell[]; busy: boolean }[] = [];
  for (let monday = start; monday <= last; monday = new Date(monday.getTime() + 7 * DAY_MS)) {
    const week = byMonday.get(monday.getTime()) ?? null;
    const activities = week ? weekActivities(week, plan) : null;

    const cells: Cell[] = [];
    for (let d = 0; d < DAYS_IN_WEEK; d++) {
      const date = new Date(monday.getTime() + d * DAY_MS);
      cells.push({
        date,
        inMonth: date.getUTCMonth() === month,
        isToday: date.getTime() === todayTime,
        week,
        weekday: d,
        activities: activities?.[d] ?? [],
      });
    }
    rows.push({
      label: week ? shortKind(week) : '—',
      cells,
      busy: cells.some((c) => c.activities.length > 0),
    });
  }
  return rows;
}

/** Etichetta compatta per la colonna di sinistra: 52 px non reggono di più. */
const RAIL_LABEL: Record<WeekKind, string> = {
  testing: 'Test',
  race: 'Gara',
  free: 'Libera',
  summerBreak: 'Pausa',
  postseason: 'Fine',
};

function shortKind(week: SeasonWeek): string {
  return week.trackId ? `R${week.round}` : RAIL_LABEL[week.kind];
}
