import { useGame } from '../../state/useGame.js';
import { constructorStandings, driverStandings } from '../../engine/season.js';
import { player } from '../../engine/selectors.js';
import { Panel } from '../components/kit.js';

/** Classifiche piloti e costruttori. Le barre usano il colore della scuderia. */
export function Standings() {
  const world = useGame((s) => s.world)!;
  const me = player(world);
  const drivers = driverStandings(world);
  const cons = constructorStandings(world);
  const maxCons = Math.max(1, cons[0]?.points ?? 1);

  return (
    <div className="h-full grid grid-cols-[1.15fr_1fr] gap-2 min-h-0">
      <Panel title="Campionato piloti" tag={`dopo ${world.round} gare`} bodyClass="p-0 scroll-y">
        {drivers.map((row) => {
          const d = world.drivers[row.driverId];
          if (!d) return null;
          const team = d.teamId ? world.teams[d.teamId] : null;
          const mine = d.id === me?.id;
          return (
            <div
              key={row.driverId}
              className={`grid grid-cols-[22px_10px_1fr_auto] items-center gap-2 px-3 py-[5px]
                border-b border-line/60 last:border-0 ${mine ? 'bg-primary/10' : ''}`}
            >
              <span className="font-mono text-2xs text-dim text-right tnum">{row.position}</span>
              <i className="block w-2 h-2 rounded-full" style={{ background: team?.colour ?? '#5D6C85' }} />
              <span className={`font-sans text-xs truncate ${mine ? 'text-primary font-semibold' : ''}`}>
                {d.name}
                {mine && <span className="ml-1.5 font-mono text-[8.5px] text-primary">TU</span>}
              </span>
              <span className="font-mono text-2xs text-accent tnum">{row.points}</span>
            </div>
          );
        })}
      </Panel>

      <Panel title="Campionato costruttori" tag="punti" bodyClass="p-3 scroll-y">
        <div className="flex flex-col gap-1">
          {cons.map((c) => {
            const team = world.teams[c.teamId];
            if (!team) return null;
            return (
              <div key={c.teamId} className="grid grid-cols-[78px_1fr_30px] items-center gap-2 py-[5px]" title={`${team.name}: ${c.points} punti`}>
                <span className="font-sans text-xs truncate">{team.short}</span>
                <div className="h-[5px] bg-panel3 rounded-sm overflow-hidden">
                  <div className="h-full rounded-sm" style={{ width: `${(c.points / maxCons) * 100}%`, background: team.colour }} />
                </div>
                <span className="font-mono text-2xs text-accent text-right tnum">{c.points}</span>
              </div>
            );
          })}
        </div>
      </Panel>
    </div>
  );
}
