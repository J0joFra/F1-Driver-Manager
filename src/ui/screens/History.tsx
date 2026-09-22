import { useGame } from '../../state/useGame.js';
import { player } from '../../engine/selectors.js';
import { Panel, Stat } from '../components/kit.js';

/** Archivio: le tue stagioni e l'albo d'oro del mondo. */
export function History() {
  const world = useGame((s) => s.world)!;
  const me = player(world)!;
  const maxPoints = Math.max(1, ...me.history.map((h) => h.points));

  return (
    <div className="h-full grid grid-cols-[1.25fr_1fr] gap-2 min-h-0">
      <Panel title="Le tue stagioni" tag="punti per anno" bodyClass="p-0 scroll-y">
        {me.history.length === 0 ? (
          <p className="text-xs text-dim p-3">La prima stagione è ancora in corso.</p>
        ) : (
          <table className="w-full text-xs">
            <thead className="sticky top-0 bg-panel">
              <tr className="text-2xs uppercase tracking-[0.12em] text-dim">
                <th className="text-left font-semibold px-3 py-1.5">Anno</th>
                <th className="text-left font-semibold px-1 py-1.5">Scuderia</th>
                <th className="text-right font-semibold px-1 py-1.5">Pos</th>
                <th className="text-left font-semibold px-2 py-1.5 w-[34%]">Punti</th>
                <th className="text-right font-semibold px-3 py-1.5">V</th>
              </tr>
            </thead>
            <tbody className="font-mono tnum">
              {me.history.map((h) => {
                const team = world.teams[h.teamId];
                return (
                  <tr key={h.year} className="border-t border-line">
                    <td className="px-3 py-1.5 text-ink">{h.year}</td>
                    <td className="px-1 py-1.5 text-muted truncate max-w-[90px]">{team?.short ?? '—'}</td>
                    <td className="px-1 py-1.5 text-right font-display text-base font-bold">P{h.championshipPos}</td>
                    <td className="px-2 py-1.5" title={`${h.year}: ${h.points} punti`}>
                      <div className="h-2.5 bg-panel2 rounded-sm overflow-hidden">
                        <div className="h-full" style={{ width: `${(h.points / maxPoints) * 100}%`, background: team?.colour ?? '#5B6672', borderRadius: '0 4px 4px 0' }} />
                      </div>
                    </td>
                    <td className="px-3 py-1.5 text-right text-muted">{h.wins}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </Panel>

      <div className="flex flex-col gap-2 min-h-0">
        <Panel title="Carriera" className="shrink-0">
          <div className="grid grid-cols-3 gap-y-2.5">
            <Stat value={me.career.starts} label="Gran Premi" />
            <Stat value={me.career.wins} label="Vittorie" />
            <Stat value={me.career.podiums} label="Podi" />
            <Stat value={me.career.poles} label="Pole" />
            <Stat value={me.career.bestFinish === 99 ? '—' : `P${me.career.bestFinish}`} label="Miglior gara" />
            <Stat value={me.career.titles} label="Titoli" tone="accent" />
          </div>
        </Panel>

        <Panel title="Albo d'oro del mondo" tag={`dal ${world.champions[0]?.year ?? world.year}`} bodyClass="p-0 scroll-y" className="flex-1">
          {world.champions.length === 0 ? (
            <p className="text-xs text-dim p-3">Nessun campionato ancora assegnato.</p>
          ) : (
            [...world.champions].reverse().map((c) => {
              const d = world.drivers[c.driverId];
              const team = world.teams[c.teamId];
              return (
                <div key={c.year} className="grid grid-cols-[30px_10px_1fr] items-center gap-2 px-3 py-[5px] border-b border-line/60 last:border-0">
                  <span className="font-mono text-2xs text-dim tnum">{c.year}</span>
                  <i className="block w-2 h-2 rounded-full" style={{ background: team?.colour ?? '#5D6C85' }} />
                  <span className={`font-sans text-xs truncate ${c.driverId === me.id ? 'text-primary font-semibold' : ''}`}>
                    {d?.name ?? '—'}
                  </span>
                </div>
              );
            })
          )}
        </Panel>
      </div>
    </div>
  );
}
