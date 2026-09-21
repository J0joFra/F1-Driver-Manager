import { useGame } from '../../state/useGame.js';
import { championshipPosition, headToHead, isRaceWeek, nextRace, player, teamOf, teammateOf } from '../../engine/selectors.js';
import { overall } from '../../engine/driver.js';
import { carPace } from '../../engine/regulations.js';
import { Bar, Note, Panel, Stat } from '../components/kit.js';

/** Schermata iniziale: dove sei, cosa ti aspetta, come stai andando. */
export function Paddock() {
  const world = useGame((s) => s.world)!;
  const me = player(world)!;
  const team = teamOf(world, me);
  const mate = teammateOf(world, me);
  const race = nextRace(world);
  const h2h = mate ? headToHead(world, me.id, mate.id) : null;
  const pos = championshipPosition(world, me.id);
  const myPoints = world.standings[me.id] ?? 0;
  const matePoints = mate ? world.standings[mate.id] ?? 0 : 0;

  return (
    <div className="h-full grid grid-cols-[1.25fr_1fr] gap-2 min-h-0">
      <div className="flex flex-col gap-2 min-h-0">
        <Panel title={isRaceWeek(world) ? 'Weekend di gara' : 'Prossimo weekend'} tag={race ? `round ${race.round}/${race.totalRounds}` : ''} className="flex-1">
          {race ? (
            <div className="flex flex-col gap-2">
              <h3 className="font-display text-2xl font-bold leading-none">{race.trackName.toUpperCase()}</h3>
              <div className="font-mono text-2xs text-muted leading-relaxed">
                {race.weeksAway === 0 ? 'Si corre questa settimana' : `Fra ${race.weeksAway} settimane`}
                {team && ` · monoposto ${carPace(team.car).toFixed(0)}/100 · affidabilità ${team.car.reliability.toFixed(0)}`}
              </div>
              <div className="flex gap-6 mt-1">
                <Stat value={pos > 0 ? `P${pos}` : '—'} label="Campionato" />
                <Stat value={myPoints} label="Punti" />
                <Stat value={Math.round(overall(me.attrs))} label="Overall" />
                <Stat value={Math.round(me.reputation)} label="Reputazione" />
              </div>
            </div>
          ) : (
            <p className="text-sm text-muted">Il calendario è finito. Chiudi l'anno per passare alla stagione successiva.</p>
          )}
        </Panel>

        <Panel title="Stato" tag="pre-gara" className="shrink-0">
          <div className="grid grid-cols-3 gap-3">
            {[
              { k: 'Forma', v: me.form, c: '#2FD98A' },
              { k: 'Morale', v: me.morale, c: '#F5C518' },
              { k: 'Reputazione', v: me.reputation, c: '#3E86F0' },
            ].map((x) => (
              <div key={x.k} className="flex flex-col gap-1">
                <div className="flex justify-between text-2xs">
                  <span className="text-muted">{x.k}</span>
                  <span className="font-mono text-dim tnum">{Math.round(x.v)}</span>
                </div>
                <Bar value={x.v} colour={x.c} height={6} />
              </div>
            ))}
          </div>
        </Panel>
      </div>

      <Panel title="Il compagno di squadra" tag={mate ? `${Math.round(overall(mate.attrs))} ovr` : ''} bodyClass="p-3 scroll-y">
        {mate ? (
          <div className="flex flex-col gap-3">
            <div>
              <div className="font-display text-xl font-bold leading-none">{mate.name}</div>
              <div className="font-mono text-2xs text-dim mt-1">
                {mate.age} anni · {mate.nationality} · {mate.career.wins} vittorie in carriera
              </div>
            </div>

            {h2h && (
              <div className="flex flex-col">
                {[
                  { k: 'Qualifiche', a: h2h.qualiA, b: h2h.qualiB },
                  { k: 'Gare', a: h2h.raceA, b: h2h.raceB },
                  { k: 'Punti', a: myPoints, b: matePoints },
                ].map((r) => (
                  <div key={r.k} className="grid grid-cols-[1fr_auto_1fr] items-center gap-2 py-2 border-b border-line last:border-0">
                    <div className={`font-mono text-sm text-right tnum ${r.a > r.b ? 'text-aurora font-semibold' : 'text-muted'}`}>{r.a}</div>
                    <div className="text-2xs uppercase tracking-[0.13em] text-dim text-center min-w-[74px]">{r.k}</div>
                    <div className={`font-mono text-sm tnum ${r.b > r.a ? 'text-ink' : 'text-muted'}`}>{r.b}</div>
                  </div>
                ))}
              </div>
            )}

            <Note>
              Stessa macchina, nessun alibi. A fine stagione è questo il confronto che le altre scuderie guarderanno per prime.
            </Note>
          </div>
        ) : (
          <p className="text-sm text-muted">Nessun compagno di squadra.</p>
        )}
      </Panel>
    </div>
  );
}
