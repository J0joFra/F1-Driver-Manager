import { useEffect, useRef, useState } from 'react';
import { CalendarDays, Flag, Moon, Snowflake, Sun, Wrench } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { useGame } from '../../state/useGame.js';
import { player } from '../../engine/selectors.js';
import { getTrack, isNightRace } from '../../engine/data/tracks.js';
import {
  formatDay, formatHour, formatShortDay, monthName, raceCountOf, raceHourInItaly,
  weekendDays, weekMonday, WEEK_LABEL, WEEK_TRAINING_CAPACITY,
  type SeasonWeek, type WeekKind,
} from '../../engine/calendar.js';
import type { Driver, Region, World } from '../../engine/types.js';
import { MonthGrid } from '../calendar/MonthGrid.js';
import { Panel, Stat } from '../components/kit.js';

const KIND_ICON: Record<WeekKind, LucideIcon> = {
  testing: Wrench,
  race: Flag,
  free: CalendarDays,
  summerBreak: Sun,
  postseason: Snowflake,
};

const REGION_LABEL: Record<Region, string> = {
  oceania: 'Oceania',
  asia: 'Asia',
  middleEast: 'Medio Oriente',
  europe: 'Europa',
  americas: 'Americhe',
};

const KIND_COLOUR: Record<WeekKind, string> = {
  testing: 'text-vantar',
  race: 'text-aurora',
  free: 'text-dim',
  summerBreak: 'text-accent',
  postseason: 'text-muted',
};

/**
 * Il calendario della stagione, in due viste.
 *
 * **Mese** è la griglia a sette colonne dei manageriali: serve a pianificare,
 * perché il colpo d'occhio dice dove sono i weekend e quanto fiato c'è in
 * mezzo. **Stagione** è l'anno intero in tabella: serve a cercare.
 *
 * Non è solo una vista: il carattere della settimana decide quanto ci si può
 * allenare, e il tempo scorre un giorno alla volta.
 */
export function Calendar() {
  const world = useGame((s) => s.world)!;
  const plan = useGame((s) => s.plan);
  const me = player(world)!;
  const current = world.schedule[world.week];
  const totalRaces = raceCountOf(world.schedule);

  const [view, setView] = useState<'mese' | 'stagione'>('mese');
  const [month, setMonth] = useState(() => monthOfToday(world));

  return (
    <div className="h-full grid grid-cols-[1fr_228px] gap-2 min-h-0">
      <Panel
        title={view === 'mese' ? `${monthName(month)} ${world.year}` : `Stagione ${world.year}`}
        bodyClass="p-0 flex flex-col min-h-0"
        tag={
          <div className="flex items-center gap-1">
            <span className="mr-1">{world.round}/{totalRaces} gare</span>
            {view === 'mese' && (
              <>
                <NavButton label="‹" onClick={() => setMonth((m) => Math.max(0, m - 1))} />
                <NavButton label="›" onClick={() => setMonth((m) => Math.min(11, m + 1))} />
                <NavButton label="Oggi" onClick={() => setMonth(monthOfToday(world))} />
              </>
            )}
            <div className="flex rounded border border-line overflow-hidden ml-1">
              {(['mese', 'stagione'] as const).map((v) => (
                <button
                  key={v}
                  type="button"
                  onClick={() => setView(v)}
                  className={`px-1.5 py-px font-mono text-[9px] capitalize transition
                    ${view === v ? 'bg-panel3 text-ink' : 'text-dim hover:text-muted'}`}
                >
                  {v}
                </button>
              ))}
            </div>
          </div>
        }
      >
        {view === 'mese'
          ? <MonthGrid world={world} month={month} plan={plan} />
          : <SeasonList world={world} me={me} />}
      </Panel>

      <SidePanels world={world} current={current} me={me} totalRaces={totalRaces} />
    </div>
  );
}

/** Il mese in cui si trova il mondo adesso; a stagione finita, quello del via. */
function monthOfToday(world: World): number {
  const week = world.schedule[world.week] ?? world.schedule[world.schedule.length - 1];
  return week ? weekMonday(world.year, week).getUTCMonth() : 2;
}

function NavButton({ label, onClick }: { label: string; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="rounded border border-line px-1.5 py-px font-mono text-[9px]
        text-dim hover:text-ink hover:border-dim transition"
    >
      {label}
    </button>
  );
}

/** L'anno intero in tabella: serve a cercare, dove il mese serve a pianificare. */
function SeasonList({ world, me }: { world: World; me: Driver }) {
  const scroller = useRef<HTMLDivElement>(null);
  const currentRow = useRef<HTMLDivElement>(null);

  // La settimana in corso deve essere già sotto gli occhi all'apertura.
  useEffect(() => {
    currentRow.current?.scrollIntoView({ block: 'center' });
  }, []);

  const resultFor = (round: number | null) =>
    round === null ? null : world.results[round - 1] ?? null;

  let lastMonth = -1;

  return (
    <>
        <div className="grid grid-cols-[30px_46px_18px_1fr_86px_40px] gap-1.5 px-3 py-1.5
          border-b border-line shrink-0 field-label">
          <span>Sett.</span>
          <span>Data</span>
          <span />
          <span>Evento</span>
          <span>Risultato</span>
          <span className="text-right">Sess.</span>
        </div>

        <div ref={scroller} className="flex-1 min-h-0 scroll-y">
          {world.schedule.map((week) => {
            const isCurrent = week.index === world.week;
            const past = week.index < world.week;
            const result = resultFor(week.round);
            // Per una gara già corsa vale il circuito del risultato: se il
            // calendario è stato rigenerato da un salvataggio vecchio, la
            // storia resta quella vera.
            const trackId = result?.trackId ?? week.trackId;
            const track = trackId ? getTrack(trackId) : null;
            const days = weekendDays(world.year, week);

            // Una settimana si raggruppa sotto il mese della data che mostra,
            // che per un weekend di gara è la domenica: altrimenti una gara
            // del 6 aprile finisce sotto l'intestazione di marzo.
            const monday = weekMonday(world.year, week);
            const shown = track ? days.race : monday;
            const month = shown.getUTCMonth();
            const showMonth = month !== lastMonth;
            lastMonth = month;
            const mine = result?.race.find((r) => r.driverId === me.id);
            const Icon = KIND_ICON[week.kind];

            return (
              <div key={week.index}>
                {showMonth && (
                  <div className="px-3 pt-2 pb-1 field-label text-muted border-t border-line first:border-0">
                    {monthName(month)}
                  </div>
                )}
                <div
                  ref={isCurrent ? currentRow : undefined}
                  className={`grid grid-cols-[30px_46px_18px_1fr_86px_40px] gap-1.5 px-3 py-[5px]
                    border-b border-line/40 items-center font-mono text-2xs tnum
                    ${isCurrent ? 'bg-primary/12 border-l-2 border-l-primary pl-[10px]' : ''}
                    ${past && !isCurrent ? 'opacity-55' : ''}`}
                >
                  <span className="text-dim">{week.index + 1}</span>
                  <span className="text-muted">
                    {formatShortDay(shown)}
                  </span>
                  <span className={track && isNightRace(track) ? 'text-accent' : KIND_COLOUR[week.kind]}>
                    {track && isNightRace(track)
                      ? <Moon className="w-3 h-3" strokeWidth={2} />
                      : <Icon className="w-3 h-3" strokeWidth={2} />}
                  </span>
                  <span className="truncate">
                    {track ? (
                      <>
                        <span className="text-accent">R{week.round}</span>{' '}
                        <span className="font-sans text-xs text-ink">{track.name}</span>{' '}
                        <span className="text-dim">
                          {formatHour(raceHourInItaly(track.localStart, track.utcOffset, days.race))}
                        </span>
                      </>
                    ) : (
                      <span className="text-dim">{WEEK_LABEL[week.kind]}</span>
                    )}
                  </span>
                  <span className={mine ? (mine.dnf ? 'text-bad' : 'text-ink') : 'text-dim'}>
                    {mine ? (mine.dnf ? 'ritiro' : `P${mine.position} · ${mine.points}pt`) : ''}
                  </span>
                  <span className="text-right text-dim">
                    {WEEK_TRAINING_CAPACITY[week.kind] || '—'}
                  </span>
                </div>
              </div>
            );
          })}
        </div>
    </>
  );
}

/**
 * La colonna di destra: cosa chiede oggi e cosa resta dell'anno. Resta
 * identica fra le due viste, perché la domanda non cambia con l'impaginazione.
 */
function SidePanels({ world, current, me, totalRaces }: {
  world: World;
  current: SeasonWeek | undefined;
  me: Driver;
  totalRaces: number;
}) {
  return (
    <div className="flex flex-col gap-2 min-h-0">
        <Panel title="Questa settimana" className="shrink-0" bodyClass="p-2.5">
          {current ? (
            <>
              <div className="flex items-center gap-2">
                <span className={KIND_COLOUR[current.kind]}>
                  {(() => {
                    const Icon = KIND_ICON[current.kind];
                    return <Icon className="w-4 h-4" strokeWidth={2} />;
                  })()}
                </span>
                <span className="font-sans text-xs font-bold">{WEEK_LABEL[current.kind]}</span>
              </div>
              <div className="font-mono text-2xs text-muted mt-1">
                dal {formatDay(weekMonday(world.year, current))}
              </div>

              {current.trackId && (() => {
                const track = getTrack(current.trackId);
                const days = weekendDays(world.year, current);
                const italy = raceHourInItaly(track.localStart, track.utcOffset, days.race);
                return (
                  <div className="mt-2 pt-2 border-t border-line">
                    <div className="font-sans text-xs font-bold truncate">{track.name}</div>
                    <div className="font-mono text-2xs text-dim flex items-center gap-1">
                      {REGION_LABEL[track.region]}
                      {isNightRace(track) && <Moon className="w-2.5 h-2.5 text-accent" strokeWidth={2} />}
                    </div>
                    <div className="mt-1.5 flex flex-col gap-[3px]">
                      {([
                        ['Libere', days.practice],
                        ['Qualifica', days.qualifying],
                        ['Gara', days.race],
                      ] as const).map(([label, date]) => (
                        <div key={label} className="flex justify-between font-mono text-2xs">
                          <span className="text-muted">{label}</span>
                          <span className="text-ink tnum">{formatDay(date)}</span>
                        </div>
                      ))}
                    </div>
                    <div className="mt-1.5 pt-1.5 border-t border-line/50 flex justify-between font-mono text-2xs">
                      <span className="text-muted">Via alle</span>
                      <span className="tnum">
                        <span className="text-dim">{formatHour(track.localStart)} loc</span>{' '}
                        <span className="text-accent">{formatHour(italy)} ITA</span>
                      </span>
                    </div>
                  </div>
                );
              })()}

              <div className="mt-2 pt-2 border-t border-line flex justify-between font-mono text-2xs">
                <span className="text-muted">Sessioni disponibili</span>
                <span className={WEEK_TRAINING_CAPACITY[current.kind] > 0 ? 'text-ink' : 'text-accent'}>
                  {WEEK_TRAINING_CAPACITY[current.kind] || 'riposo'}
                </span>
              </div>
            </>
          ) : (
            <p className="font-mono text-2xs text-dim">Stagione conclusa.</p>
          )}
        </Panel>

        <Panel title="Il resto dell'anno" className="flex-1" bodyClass="p-2.5 scroll-y">
          <div className="grid grid-cols-2 gap-y-3">
            <Stat value={world.round} label="Gare corse" />
            <Stat value={totalRaces - world.round} label="Rimaste" tone="accent" />
            <Stat value={Math.round(me.fatigue)} label="Stanchezza" tone={me.fatigue > 70 ? 'accent' : undefined} />
            <Stat value={`${world.week + 1}/${world.schedule.length}`} label="Settimana" />
          </div>

          <div className="mt-3 pt-2 border-t border-line flex flex-col gap-[3px]">
            {nextOf(world.schedule, world.week, 'summerBreak', 'Pausa estiva', world.year)}
            {nextOf(world.schedule, world.week, 'race', 'Prossima gara', world.year)}
            {nextOf(world.schedule, world.week, 'postseason', 'Fine stagione', world.year)}
          </div>

          <p className="font-mono text-[8.5px] text-dim leading-relaxed mt-2.5">
            Nella pausa estiva le fabbriche chiudono: non ci si allena e si recupera. È l'unico
            momento dell'anno in cui la stanchezza scende da sola.
          </p>
        </Panel>
    </div>
  );
}


function nextOf(
  schedule: readonly SeasonWeek[],
  from: number,
  kind: WeekKind,
  label: string,
  year: number,
) {
  const found = schedule.find((w) => w.index >= from && w.kind === kind);
  return (
    <div key={kind} className="flex justify-between font-mono text-2xs">
      <span className="text-muted">{label}</span>
      <span className="text-ink tnum">
        {/* La domenica, non il lunedì: è il giorno che il giocatore aspetta. */}
        {found ? formatShortDay(weekendDays(year, found).race) : '—'}
      </span>
    </div>
  );
}
