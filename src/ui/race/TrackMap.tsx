import { useEffect, useMemo, useRef, useState } from 'react';
import type { LiveRace } from '../../engine/liveRace.js';
import { order } from '../../engine/liveRace.js';
import { TRACK_VIEWBOX, trackPath } from './trackPath.js';
import { eventText } from './eventText.js';

/**
 * Il tracciato visto dall'alto, con una vettura per puntino.
 *
 * È la vista atmosferica: dà contesto e fa capire dove sei sul giro. I
 * distacchi veri si leggono sulla striscia qui sotto, perché su un tracciato
 * chiuso un secondo di ritardo non si vede.
 */
export function TrackMap({
  race, teamColour, driverName, playerId, keyMoment,
}: {
  race: LiveRace;
  teamColour: (driverId: string) => string;
  driverName: (driverId: string) => string;
  playerId: string | null;
  keyMoment: string | null;
}) {
  const pathRef = useRef<SVGPathElement>(null);
  const [length, setLength] = useState(0);
  const d = useMemo(() => trackPath(race.track), [race.track]);

  useEffect(() => {
    if (pathRef.current) setLength(pathRef.current.getTotalLength());
  }, [d]);

  const cars = order(race);
  const last = race.events[0];

  return (
    <div className="panel relative flex-1 min-h-0 overflow-hidden">
      <svg
        viewBox={`0 0 ${TRACK_VIEWBOX.w} ${TRACK_VIEWBOX.h}`}
        className="w-full h-full"
        preserveAspectRatio="xMidYMid meet"
        role="img"
        aria-label={`Vista dall'alto di ${race.track.name} con le vetture in gara`}
      >
        {/* via di fuga, cordoli, asfalto: tre tratti sullo stesso percorso */}
        <path d={d} fill="none" stroke="#3B3126" strokeWidth={24} strokeLinecap="round" opacity={0.55} />
        <path d={d} fill="none" stroke="#E8EBF0" strokeWidth={17} strokeLinecap="round" opacity={0.5} />
        <path ref={pathRef} d={d} fill="none" stroke="#2B333C" strokeWidth={14} strokeLinecap="round" />

        {length > 0 && (
          <>
            {(() => {
              const p = pathRef.current!.getPointAtLength(0);
              const q = pathRef.current!.getPointAtLength(6);
              const a = (Math.atan2(q.y - p.y, q.x - p.x) * 180) / Math.PI;
              return (
                <g transform={`translate(${p.x},${p.y}) rotate(${a})`}>
                  <rect x={-1} y={-9} width={2} height={18} fill="#E8EBF0" opacity={0.9} />
                </g>
              );
            })()}

            {cars.map((c) => {
              const frac = ((c.progress % 1) + 1) % 1;
              const p = pathRef.current!.getPointAtLength(frac * length);
              const q = pathRef.current!.getPointAtLength((frac * length + 5) % length);
              const a = (Math.atan2(q.y - p.y, q.x - p.x) * 180) / Math.PI;
              const isPlayer = c.entry.driverId === playerId;
              const inPit = race.t < c.pitUntil;
              return (
                <g
                  key={c.entry.driverId}
                  transform={`translate(${p.x.toFixed(1)},${p.y.toFixed(1)}) rotate(${a.toFixed(1)})`}
                  opacity={c.dnf ? 0.15 : inPit ? 0.35 : 1}
                >
                  <rect x={-5} y={-2.6} width={10} height={5.2} rx={1.6} fill={teamColour(c.entry.driverId)} />
                  <circle cx={0.4} cy={0} r={1.3} fill="#0E1216" />
                  {isPlayer && <circle cx={0} cy={0} r={7.5} fill="none" stroke="#E9ECF1" strokeWidth={1.2} />}
                </g>
              );
            })}
          </>
        )}
      </svg>

      {keyMoment && (
        <div className="absolute top-1.5 left-1/2 -translate-x-1/2 bg-warn text-[#2B2200] font-display text-2xs font-bold uppercase tracking-[0.14em] px-2.5 py-1 rounded-sm">
          {keyMoment}
        </div>
      )}

      {last && (
        <div className="absolute bottom-1.5 left-2 right-2 font-mono text-2xs text-dim truncate">
          <span className={last.key ? 'text-aurora' : ''}>G{last.lap}</span> · {eventText(last, driverName)}
        </div>
      )}

      <div className="absolute top-1.5 right-2 font-mono text-2xs text-dim text-right leading-snug">
        {race.wet ? 'BAGNATO' : 'ASCIUTTO'}
        <br />
        {race.track.laps} giri
      </div>
    </div>
  );
}
