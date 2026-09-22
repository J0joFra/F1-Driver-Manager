import { useGame } from '../../state/useGame.js';
import { constructorStandings, driverStandings } from '../../engine/season.js';
import { player } from '../../engine/selectors.js';
import { overall } from '../../engine/driver.js';
import { carPace } from '../../engine/regulations.js';
import { Panel } from '../components/kit.js';

/**
 * Classifiche.
 *
 * I piloti in tabella, perché le colonne (vittorie, podi, overall, punti) si
 * confrontano a colpo d'occhio solo se sono incolonnate. Le scuderie in
 * schede, perché per ognuna servono tre numeri tecnici che in una tabella
 * sarebbero rumore.
 */
export function Standings() {
  const world = useGame((s) => s.world)!;
  const me = player(world);
  const drivers = driverStandings(world);
  const teams = constructorStandings(world);

  const seasonOf = (driverId: string) => {
    let wins = 0;
    let podiums = 0;
    for (const w of world.results) {
      const r = w.race.find((x) => x.driverId === driverId);
      if (!r || r.dnf) continue;
      if (r.position === 1) wins += 1;
      if (r.position <= 3) podiums += 1;
    }
    return { wins, podiums };
  };

  return (
    <div className="h-full grid grid-cols-[1fr_276px] gap-2 min-h-0">
      <Panel title="Classifica piloti" tag={`dopo ${world.round} gare`} bodyClass="p-0 flex flex-col min-h-0">
        <div className="grid grid-cols-[26px_14px_1fr_104px_26px_26px_32px_34px] gap-1.5 px-3 py-1.5
          border-b border-line shrink-0 field-label">
          <span className="text-right">#</span>
          <span />
          <span>Pilota</span>
          <span>Team</span>
          <span className="text-right">V</span>
          <span className="text-right">P</span>
          <span className="text-right">OVR</span>
          <span className="text-right">PT</span>
        </div>
        <div className="flex-1 min-h-0 scroll-y">
          {drivers.map((row) => {
            const d = world.drivers[row.driverId];
            if (!d) return null;
            const t = d.teamId ? world.teams[d.teamId] : null;
            const mine = d.id === me?.id;
            const { wins, podiums } = seasonOf(d.id);
            return (
              <div
                key={row.driverId}
                className={`grid grid-cols-[26px_14px_1fr_104px_26px_26px_32px_34px] gap-1.5 px-3 py-[5px]
                  border-b border-line/50 last:border-0 font-mono text-2xs tnum ${mine ? 'bg-primary/10' : ''}`}
              >
                <span className="text-dim text-right">{row.position}</span>
                <i className="block w-2 h-2 rounded-full self-center" style={{ background: t?.colour ?? '#5D6C85' }} />
                <span className={`font-sans text-xs truncate ${mine ? 'text-ink font-bold' : 'text-ink'}`}>{d.name}</span>
                <span className="truncate" style={{ color: t?.colour ?? '#5D6C85' }}>{t?.name ?? '—'}</span>
                <span className={`text-right ${wins > 0 ? 'text-ink' : 'text-dim'}`}>{wins}</span>
                <span className={`text-right ${podiums > 0 ? 'text-ink' : 'text-dim'}`}>{podiums}</span>
                <span className="text-right text-muted">{Math.round(overall(d.attrs))}</span>
                <span className={`text-right ${row.points > 0 ? 'text-accent' : 'text-dim'}`}>{row.points}</span>
              </div>
            );
          })}
        </div>
      </Panel>

      <Panel title="Classifica scuderie" bodyClass="p-2 scroll-y">
        {teams.map((c, i) => {
          const t = world.teams[c.teamId];
          if (!t) return null;
          const mine = me?.teamId === c.teamId;
          return (
            <div
              key={c.teamId}
              className={`rounded border px-2.5 py-2 mb-1.5 last:mb-0 ${
                mine ? 'border-primary/60 bg-primary/5' : 'border-line bg-panel2'
              }`}
            >
              <div className="flex items-center justify-between gap-2">
                <span className="flex items-center gap-2 min-w-0">
                  <span className="font-mono text-2xs text-dim tnum w-3 text-right">{i + 1}</span>
                  <i className="block w-2.5 h-2.5 rounded-full shrink-0" style={{ background: t.colour }} />
                  <span className="font-sans text-xs font-bold truncate">{t.name}</span>
                </span>
                <b className="font-display text-base font-bold text-accent tnum shrink-0">{c.points}</b>
              </div>
              <div className="font-mono text-[8.5px] text-dim mt-1 flex gap-2.5">
                <span>Passo {Math.round(carPace(t.car))}</span>
                <span>Aff. {Math.round(t.car.reliability)}</span>
                <span>Prest. {Math.round(t.prestige)}</span>
              </div>
            </div>
          );
        })}
      </Panel>
    </div>
  );
}
