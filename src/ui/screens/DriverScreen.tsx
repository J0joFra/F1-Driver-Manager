import { useGame } from '../../state/useGame.js';
import { player, seasonResults, teamOf } from '../../engine/selectors.js';
import { overall } from '../../engine/driver.js';
import { ATTRIBUTE_KEYS } from '../../engine/types.js';
import { Panel, Stat } from '../components/kit.js';
import { ATTR_LABELS } from '../format.js';

/** Scheda del pilota: attributi con il tetto stimato e la stagione in corso. */
export function DriverScreen() {
  const world = useGame((s) => s.world)!;
  const me = player(world)!;
  const team = teamOf(world, me);
  const results = seasonResults(world, me.id);

  return (
    <div className="h-full grid grid-cols-[1fr_1fr] gap-2 min-h-0">
      <Panel title="Attributi" tag="│ = tetto stimato" bodyClass="p-3 scroll-y">
        <div className="flex flex-col">
          {ATTRIBUTE_KEYS.map((k) => {
            const v = me.attrs[k];
            const cap = me.caps[k];
            return (
              <div key={k} className="grid grid-cols-[1fr_28px_72px] items-center gap-2 py-1.5">
                <span className="text-xs text-muted truncate">{ATTR_LABELS[k]}</span>
                <span className="font-display text-base font-bold text-right tnum">{Math.round(v)}</span>
                <div className="relative h-2 bg-panel2 rounded-sm overflow-hidden">
                  <div className="absolute inset-y-0 left-0 bg-ink" style={{ width: `${v}%`, borderRadius: '0 4px 4px 0' }} />
                  <div className="absolute inset-y-0 w-0.5 bg-dim" style={{ left: `${cap}%` }} />
                </div>
              </div>
            );
          })}
        </div>
        <div className="flex gap-5 mt-3 pt-3 border-t border-line">
          <Stat value={Math.round(overall(me.attrs))} label="Overall" />
          <Stat value={Math.round(overall(me.caps))} label="Potenziale" />
          <Stat value={me.age} label="Età" />
        </div>
      </Panel>

      <Panel
        title="Stagione in corso"
        tag={`${me.career.starts} GP in carriera`}
        bodyClass="p-0 scroll-y"
      >
        {results.length === 0 ? (
          <p className="text-xs text-dim p-3">Nessuna gara corsa quest'anno.</p>
        ) : (
          <table className="w-full text-xs">
            <thead className="sticky top-0 bg-panel">
              <tr className="text-2xs uppercase tracking-[0.12em] text-dim">
                <th className="text-left font-semibold px-3 py-1.5">Circuito</th>
                <th className="text-right font-semibold px-1 py-1.5">Gri</th>
                <th className="text-right font-semibold px-1 py-1.5">Fin</th>
                <th className="text-right font-semibold px-3 py-1.5">Pt</th>
              </tr>
            </thead>
            <tbody className="font-mono tnum">
              {results.map((r, i) => (
                <tr key={i} className="border-t border-line">
                  <td className="px-3 py-1.5 text-muted truncate max-w-[130px]">{r.trackName}</td>
                  <td className="px-1 py-1.5 text-right text-dim">{r.grid || '—'}</td>
                  <td className={`px-1 py-1.5 text-right ${r.race?.dnf ? 'text-bad' : r.race && r.race.position <= 3 ? 'text-good' : 'text-ink'}`}>
                    {r.race ? (r.race.dnf ? 'RIT' : r.race.position) : '—'}
                  </td>
                  <td className="px-3 py-1.5 text-right">{r.race?.points || ''}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
        {team && (
          <div className="px-3 py-2 border-t border-line font-mono text-2xs text-dim">
            {team.name} · ingaggio {(me.salary / 1_000_000).toFixed(2).replace('.', ',')}M · contratto {me.contractYears} {me.contractYears === 1 ? 'anno' : 'anni'}
          </div>
        )}
      </Panel>
    </div>
  );
}
