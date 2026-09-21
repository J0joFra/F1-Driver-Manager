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
              className={`grid grid-cols-[22px_3px_1fr_auto] items-center gap-2 px-3 py-1.5 border-b border-line last:border-0 ${
                mine ? 'bg-aurora/15 border-l-2 border-l-aurora pl-[10px]' : ''
              }`}
            >
              <span className={`font-display text-sm font-bold text-right tnum ${mine ? 'text-ink' : 'text-dim'}`}>{row.position}</span>
              <i className="block w-[3px] h-4 rounded-sm" style={{ background: team?.colour ?? '#5B6672' }} />
              <span className="font-display text-sm font-semibold tracking-wide truncate">
                {d.name}
                {mine && <span className="text-aurora ml-1.5 text-2xs">TU</span>}
              </span>
              <span className="font-mono text-xs text-muted tnum">{row.points}</span>
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
              <div key={c.teamId} className="grid grid-cols-[74px_1fr_40px] items-center gap-2 py-1" title={`${team.name}: ${c.points} punti`}>
                <span className="font-display text-sm font-semibold tracking-wide truncate">{team.short}</span>
                <div className="h-3 bg-panel2 rounded-sm overflow-hidden">
                  <div className="h-full" style={{ width: `${(c.points / maxCons) * 100}%`, background: team.colour, borderRadius: '0 4px 4px 0' }} />
                </div>
                <span className="font-mono text-xs text-muted text-right tnum">{c.points}</span>
              </div>
            );
          })}
        </div>
      </Panel>
    </div>
  );
}
