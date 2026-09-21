import type { LiveRace } from '../../engine/liveRace.js';
import { gapBetween, order } from '../../engine/liveRace.js';

/**
 * I distacchi reali, in secondi dal leader.
 *
 * È la vista funzionale della gara: qui si vede il trenino, chi si stacca e
 * l'undercut che arriva. Sul tracciato quelle cose non si leggono.
 */
export function GapStrip({
  race, teamColour, playerId,
}: {
  race: LiveRace;
  teamColour: (driverId: string) => string;
  playerId: string | null;
}) {
  const rows = order(race);
  const leader = rows[0];
  if (!leader) return null;

  const gaps = rows.map((c) => ({ car: c, gap: gapBetween(race, leader, c) }));
  const maxGap = Math.max(6, gaps[gaps.length - 1]?.gap ?? 6);
  const step = maxGap > 60 ? 30 : maxGap > 30 ? 15 : maxGap > 14 ? 5 : 2;
  const ticks: number[] = [];
  for (let s = 0; s <= maxGap; s += step) ticks.push(s);

  const x = (g: number) => 4 + (g / maxGap) * 92;

  return (
    <div className="panel shrink-0 relative" style={{ height: 52 }}>
      {ticks.map((s) => (
        <div key={s} className="absolute top-4 bottom-2 w-px bg-line" style={{ left: `${x(s)}%` }}>
          <span className="absolute -top-3.5 left-0 -translate-x-1/2 font-mono text-[8px] text-dim whitespace-nowrap">
            {s === 0 ? 'LEADER' : `+${s}s`}
          </span>
        </div>
      ))}

      {gaps.map(({ car, gap }) => {
        const isPlayer = car.entry.driverId === playerId;
        const size = isPlayer ? 13 : 9;
        return (
          <div
            key={car.entry.driverId}
            className={`absolute rounded-full transition-[left] duration-300 ${isPlayer ? 'z-10 ring-1 ring-ink' : ''}`}
            style={{
              left: `${x(gap)}%`,
              top: 26 - size / 2,
              width: size,
              height: size,
              marginLeft: -size / 2,
              background: teamColour(car.entry.driverId),
              opacity: car.dnf ? 0.2 : 1,
            }}
            title={`${car.entry.driverId} · +${gap.toFixed(3)}`}
          />
        );
      })}

      <span className="absolute bottom-0.5 left-2 font-mono text-[8px] text-dim">
        &lt; 1.00s = DRS disponibile
      </span>
    </div>
  );
}
