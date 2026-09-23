import { PALETTE } from '../palette.js';
import { useState } from 'react';
import type { Compound } from '../../engine/types.js';
import { carOf, fastForward, liveResults } from '../../engine/liveRace.js';
import { currentRace } from '../../state/raceSession.js';
import { useGame } from '../../state/useGame.js';
import { Btn } from '../components/kit.js';
import { lapTime } from '../format.js';

const COMPOUNDS: { k: Compound; label: string; colour: string; note: string }[] = [
  { k: 'S', label: 'Soft', colour: '#E8283C', note: '−0,78s al giro, dura poco' },
  { k: 'M', label: 'Medium', colour: '#F5C518', note: 'il compromesso' },
  { k: 'H', label: 'Hard', colour: '#E8EBF0', note: '+0,68s al giro, arriva in fondo' },
];

/**
 * La griglia di partenza: l'unico momento in cui la qualifica si vede.
 * Qui si sceglie la gomma con cui partire, e si decide se correre o simulare.
 */
export function GridScreen() {
  const world = useGame((s) => s.world)!;
  const startRace = useGame((s) => s.startRace);
  const completeRace = useGame((s) => s.completeRace);
  const session = currentRace();
  const [compound, setCompound] = useState<Compound>('M');
  if (!session) return null;

  const { prepared, race } = session;
  const playerId = world.seat.mode === 'pilota' ? world.seat.driverId : null;
  const me = playerId ? carOf(race, playerId) : undefined;
  const myGrid = prepared.qualifying.find((q) => q.driverId === playerId)?.position ?? 0;
  const pole = prepared.qualifying[0];

  const choose = (c: Compound) => {
    setCompound(c);
    if (me) me.tyre.compound = c;
  };

  const simulate = () => {
    fastForward(race);
    completeRace(liveResults(race), race.safetyCarsUsed);
  };

  return (
    <div className="h-full grid grid-cols-[1fr_1fr] gap-2 p-2 min-h-0">
      <div className="panel flex flex-col min-h-0">
        <div className="panel-head shrink-0">
          <h2 className="panel-title">Griglia di partenza</h2>
          <span className="font-mono text-2xs text-dim">
            {prepared.wet ? 'bagnato' : 'asciutto'} · {prepared.track.laps} giri
          </span>
        </div>
        <div className="flex-1 min-h-0 scroll-y">
          {prepared.qualifying.map((q) => {
            const d = world.drivers[q.driverId];
            const team = d?.teamId ? world.teams[d.teamId] : null;
            const mine = q.driverId === playerId;
            return (
              <div
                key={q.driverId}
                className={`grid grid-cols-[18px_3px_1fr_auto] items-center gap-2 px-2.5 py-1 border-b border-line last:border-0 ${
                  mine ? 'bg-aurora/15' : ''
                }`}
              >
                <span className={`font-display text-xs font-bold text-right tnum ${mine ? 'text-ink' : 'text-dim'}`}>
                  {q.position}
                </span>
                <i className="block w-[3px] h-3.5 rounded-sm" style={{ background: team?.colour ?? PALETTE.dim }} />
                <span className="font-display text-xs tracking-wide truncate">{d?.name ?? q.driverId}</span>
                <span className="font-mono text-[9px] text-dim tnum">
                  {q.position === 1
                    ? lapTime(q.lapTime)
                    : `+${(q.lapTime - (pole?.lapTime ?? q.lapTime)).toFixed(3)}`}
                </span>
              </div>
            );
          })}
        </div>
      </div>

      <div className="flex flex-col gap-2 min-h-0">
        <div className="panel p-3">
          <div className="font-display text-2xs tracking-[0.16em] text-aurora font-bold uppercase">
            Round {world.round + 1} · qualifica chiusa
          </div>
          <h1 className="font-display text-xl font-bold leading-tight mt-1">{prepared.track.name.toUpperCase()}</h1>
          <div className="font-mono text-2xs text-dim mt-1">
            Parti {myGrid ? `P${myGrid}` : '—'} su {prepared.qualifying.length}
            {prepared.wet && ' · pista bagnata'}
          </div>
        </div>

        <div className="panel p-3 flex-1 min-h-0">
          <h3 className="panel-title mb-2">Gomma di partenza</h3>
          <div className="grid grid-cols-3 gap-1.5">
            {COMPOUNDS.map((c) => (
              <button
                key={c.k}
                type="button"
                onClick={() => choose(c.k)}
                aria-pressed={compound === c.k}
                className="font-display text-xs font-bold uppercase tracking-wider py-2 rounded-sm border"
                style={
                  compound === c.k
                    ? { background: c.colour, borderColor: c.colour, color: '#FFFFFF' }
                    : { background: '#1C232B', borderColor: '#293240', color: '#8B95A2' }
                }
              >
                {c.label}
              </button>
            ))}
          </div>
          <p className="font-mono text-2xs text-dim mt-2 leading-relaxed">
            {COMPOUNDS.find((c) => c.k === compound)?.note}
          </p>
        </div>

        <div className="flex gap-2 shrink-0">
          <Btn variant="primary" onClick={startRace} className="flex-1 py-3" testId="go-racing">Vai in pista</Btn>
          <Btn onClick={simulate} className="py-3" testId="simulate-race">Simula</Btn>
        </div>
      </div>
    </div>
  );
}
