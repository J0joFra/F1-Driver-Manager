import { useEffect, useRef } from 'react';
import type { LiveCar, LiveRace } from '../../engine/liveRace.js';
import { gapBetween, order } from '../../engine/liveRace.js';

/**
 * La torre dei tempi: chi è davanti a chi, e di quanto dal leader.
 * Le righe si spostano con una transizione, così un sorpasso si vede.
 */
export function TimingTower({
  race, teamColour, driverName, playerId,
}: {
  race: LiveRace;
  teamColour: (driverId: string) => string;
  driverName: (driverId: string) => string;
  playerId: string | null;
}) {
  const rows = order(race);
  const leader = rows[0];
  const ROW = 19;
  const scroller = useRef<HTMLDivElement>(null);
  const myIndex = rows.findIndex((c) => c.entry.driverId === playerId);

  // Con sedici vetture il giocatore finisce spesso fuori dalle righe visibili:
  // la torre lo segue, altrimenti la schermata più importante non lo mostra.
  useEffect(() => {
    const el = scroller.current;
    if (!el || myIndex < 0) return;
    const top = myIndex * ROW;
    const viewTop = el.scrollTop;
    const viewBottom = viewTop + el.clientHeight;
    if (top < viewTop + ROW) el.scrollTo({ top: Math.max(0, top - ROW * 2), behavior: 'smooth' });
    else if (top + ROW > viewBottom - ROW) el.scrollTo({ top: top - el.clientHeight + ROW * 3, behavior: 'smooth' });
  }, [myIndex]);

  const label = (c: LiveCar, i: number) => {
    if (race.t < c.pitUntil) return 'BOX';
    if (i === 0) return 'LEADER';
    const g = leader ? gapBetween(race, leader, c) : 0;
    return g > 60 ? `+${(g / 60).toFixed(1)}m` : `+${g.toFixed(1)}`;
  };

  return (
    <div className="panel flex flex-col min-h-0">
      <div className="panel-head shrink-0 !py-1.5">
        <h2 className="panel-title">Classifica</h2>
        <span className="font-mono text-2xs text-dim tnum">
          G{race.lap}/{race.track.laps}
        </span>
      </div>
      <div ref={scroller} className="flex-1 min-h-0 scroll-y relative">
        <div className="relative" style={{ height: rows.length * ROW + 4 }}>
          {rows.map((c, i) => {
            const isPlayer = c.entry.driverId === playerId;
            return (
              <div
                key={c.entry.driverId}
                // Le righe devono essere opache: durante uno scambio due
                // righe si attraversano, e senza fondo il testo si sovrappone.
                className={`absolute left-0 right-0 grid grid-cols-[16px_3px_1fr_auto] items-center gap-1.5 px-2 transition-transform duration-200 ${
                  isPlayer ? 'bg-aurora/25' : 'bg-panel2'
                }`}
                style={{ height: ROW, transform: `translateY(${i * ROW + 2}px)` }}
              >
                <span className={`font-display text-xs font-bold text-right tnum ${isPlayer ? 'text-ink' : 'text-dim'}`}>
                  {i + 1}
                </span>
                <i className="block w-[3px] h-3 rounded-sm" style={{ background: teamColour(c.entry.driverId) }} />
                <span className="font-display text-xs tracking-wide truncate">{driverName(c.entry.driverId)}</span>
                <span className={`font-mono text-[9px] tnum ${race.t < c.pitUntil ? 'text-warn' : 'text-dim'}`}>
                  {label(c, i)}
                </span>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
