import { PALETTE } from '../palette.js';
import { useGame } from '../../state/useGame.js';
import { player } from '../../engine/selectors.js';
import { getTrack } from '../../engine/data/tracks.js';
import { Panel } from '../components/kit.js';

/**
 * L'archivio del mondo: chi ha vinto, e com'è finita l'ultima gara.
 * È il premio di chi gioca a lungo, quindi cresce invece di consumarsi.
 */
export function History() {
  const world = useGame((s) => s.world)!;
  const me = player(world)!;
  const champions = [...world.champions].reverse();

  const byTeam = new Map<string, number>();
  for (const c of world.champions) byTeam.set(c.teamId, (byTeam.get(c.teamId) ?? 0) + 1);
  const titles = [...byTeam].sort((a, b) => b[1] - a[1]);
  const maxTitles = titles[0]?.[1] ?? 1;

  const lastRace = world.results[world.results.length - 1];

  return (
    <div className="h-full grid grid-cols-[1fr_276px] gap-2 min-h-0">
      <Panel title="Albo d'oro" tag={champions.length > 0 ? `${champions.length} stagioni` : ''} bodyClass="p-0 flex flex-col min-h-0">
        {champions.length === 0 ? (
          <p className="font-mono text-2xs text-dim p-3">Nessun campione ancora. Gioca la prima stagione.</p>
        ) : (
          <>
            <div className="grid grid-cols-[40px_14px_1fr_110px_44px] gap-1.5 px-3 py-1.5
              border-b border-line shrink-0 field-label">
              <span>Anno</span>
              <span />
              <span>Campione</span>
              <span>Scuderia</span>
              <span className="text-right">Punti</span>
            </div>
            <div className="flex-1 min-h-0 scroll-y">
              {champions.map((c) => {
                const d = world.drivers[c.driverId];
                const t = world.teams[c.teamId];
                const season = d?.history.find((h) => h.year === c.year);
                const mine = c.driverId === me.id;
                return (
                  <div
                    key={c.year}
                    className={`grid grid-cols-[40px_14px_1fr_110px_44px] gap-1.5 px-3 py-[5px]
                      border-b border-line/50 last:border-0 font-mono text-2xs tnum ${mine ? 'bg-primary/10' : ''}`}
                  >
                    <span className="text-muted">{c.year}</span>
                    <i className="block w-2 h-2 rounded-full self-center" style={{ background: t?.colour ?? PALETTE.dim }} />
                    <span className={`font-sans text-xs truncate ${mine ? 'text-primary font-bold' : 'text-ink'}`}>
                      {d?.name ?? '—'}
                    </span>
                    <span className="truncate" style={{ color: t?.colour ?? PALETTE.dim }}>{t?.name ?? '—'}</span>
                    <span className="text-right text-accent">{season?.points ?? '—'}</span>
                  </div>
                );
              })}
            </div>
          </>
        )}
      </Panel>

      <div className="flex flex-col gap-2 min-h-0">
        <Panel title="Titoli per scuderia" className="shrink-0" bodyClass="p-2.5">
          {titles.length === 0 ? (
            <p className="font-mono text-2xs text-dim">—</p>
          ) : (
            titles.map(([teamId, n]) => {
              const t = world.teams[teamId];
              return (
                <div key={teamId} className="grid grid-cols-[78px_1fr_18px] items-center gap-2 py-[3px]">
                  <span className="font-sans text-xs truncate">{t?.short ?? '—'}</span>
                  <div className="h-[5px] bg-panel3 rounded-sm overflow-hidden">
                    <div className="h-full rounded-sm" style={{ width: `${(n / maxTitles) * 100}%`, background: t?.colour ?? PALETTE.dim }} />
                  </div>
                  <span className="font-mono text-2xs text-accent tnum text-right">{n}</span>
                </div>
              );
            })
          )}
        </Panel>

        <Panel
          title="Ultima gara"
          tag={lastRace ? `${world.year} R${lastRace.round + 1}` : ''}
          className="flex-1"
          bodyClass="p-0 flex flex-col min-h-0"
        >
          {!lastRace ? (
            <p className="font-mono text-2xs text-dim p-3">Nessuna gara corsa.</p>
          ) : (
            <>
              <div className="px-3 py-1.5 border-b border-line shrink-0 font-mono text-2xs text-muted truncate">
                {getTrack(lastRace.trackId).name}
              </div>
              <div className="flex-1 min-h-0 scroll-y">
                {lastRace.race.slice(0, 10).map((r) => {
                  const d = world.drivers[r.driverId];
                  const t = d?.teamId ? world.teams[d.teamId] : null;
                  const mine = r.driverId === me.id;
                  return (
                    <div
                      key={r.driverId}
                      className={`grid grid-cols-[20px_14px_1fr_26px] gap-1.5 px-3 py-[5px]
                        border-b border-line/50 last:border-0 font-mono text-2xs tnum ${mine ? 'bg-primary/10' : ''}`}
                    >
                      <span className="text-dim text-right">{r.position}</span>
                      <i className="block w-2 h-2 rounded-full self-center" style={{ background: t?.colour ?? PALETTE.dim }} />
                      <span className={`font-sans text-xs truncate ${mine ? 'text-primary font-semibold' : 'text-ink'}`}>
                        {d?.name ?? r.driverId}
                      </span>
                      <span className={`text-right ${r.points > 0 ? 'text-accent' : 'text-dim'}`}>{r.points || ''}</span>
                    </div>
                  );
                })}
              </div>
            </>
          )}
        </Panel>
      </div>
    </div>
  );
}
