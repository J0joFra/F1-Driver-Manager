import { Flag } from 'lucide-react';
import { useGame } from '../../state/useGame.js';
import { championshipPosition, isRaceWeek, nextRace, player, teamOf } from '../../engine/selectors.js';
import { constructorStandings, driverStandings } from '../../engine/season.js';
import { overall } from '../../engine/driver.js';
import { getTrack } from '../../engine/data/tracks.js';
import { ATTRIBUTE_KEYS } from '../../engine/types.js';
import { ATTRIBUTE_COLOURS, AttrRow, Bar, DriverBadge, KeyRow, Panel, Stat, TeamDot } from '../components/kit.js';
import { ATTR_LABELS, money } from '../format.js';

/**
 * Il cruscotto: a sinistra chi sei, al centro cosa ti aspetta e come va il
 * campionato, a destra la tua scuderia. Tre colonne perché in orizzontale la
 * larghezza è ciò che abbonda.
 */
export function Paddock({ onAdvance }: { onAdvance: () => void }) {
  const world = useGame((s) => s.world)!;
  const me = player(world)!;
  const team = teamOf(world, me);
  const race = nextRace(world);
  const track = race ? getTrack(race.trackId) : null;
  const pos = championshipPosition(world, me.id);
  const drivers = driverStandings(world).slice(0, 10);
  const teams = constructorStandings(world);

  return (
    <div className="h-full grid grid-cols-[200px_1fr_208px] gap-2 min-h-0">
      {/* ---- il pilota ---- */}
      <div className="flex flex-col gap-2 min-h-0">
        {/* Intestazione fissa, elenco attributi scorrevole: a 390 px di altezza
            i sette attributi non entrano tutti sotto la riga dei numeri. */}
        <Panel title="Il tuo pilota" className="flex-1" bodyClass="p-2.5 flex flex-col min-h-0">
          <div className="flex items-center gap-2.5 shrink-0">
            <DriverBadge name={me.name} colour={team?.colour ?? '#5D6C85'} />
            <div className="min-w-0">
              <div className="font-sans text-xs font-bold truncate">{me.name}</div>
              <div className="font-mono text-2xs text-muted truncate">{team?.name}</div>
            </div>
          </div>

          <div className="grid grid-cols-3 gap-1 mt-2.5 pt-2.5 border-t border-line shrink-0">
            <Stat value={Math.round(overall(me.attrs))} label="Overall" />
            <Stat value={me.age} label="Età" />
            <Stat value={pos > 0 ? `P${pos}` : '—'} label="Pos." tone="accent" />
          </div>

          <div className="mt-2 pt-1.5 border-t border-line flex-1 min-h-0 scroll-y">
            {ATTRIBUTE_KEYS.map((k) => (
              <AttrRow key={k} compact label={ATTR_LABELS[k]!} value={me.attrs[k]} colour={ATTRIBUTE_COLOURS[k]} />
            ))}
          </div>
        </Panel>

        <Panel title="Contratto" className="shrink-0">
          <KeyRow label="Ingaggio" value={`${money(me.salary)}/anno`} />
          <KeyRow label="Anni residui" value={me.contractYears} />
          <KeyRow label="Ruolo" value={me.contractYears > 0 ? 'Seconda guida' : 'Svincolato'} />
          <KeyRow label="Vittorie" value={me.career.wins} />
          <KeyRow label="Podi" value={me.career.podiums} />
        </Panel>
      </div>

      {/* ---- il weekend e il campionato ---- */}
      <div className="flex flex-col gap-2 min-h-0">
        <Panel
          title="Prossimo weekend"
          tag={race ? `Round ${race.round}` : ''}
          className="shrink-0"
          bodyClass="p-3"
        >
          {race && track ? (
            <div className="text-center">
              <div className="font-sans text-[9px] tracking-[0.2em] uppercase text-muted">
                {isRaceWeek(world) ? 'Settimana di gara' : `Fra ${race.weeksAway} settiman${race.weeksAway === 1 ? 'a' : 'e'}`}
              </div>
              <h2 className="font-sans text-lg font-bold mt-1 leading-tight">{track.name}</h2>
              <div className="font-mono text-2xs text-muted mt-0.5">
                {track.laps} giri · {(track.baseLap * track.laps / 60).toFixed(0)} min
              </div>

              <div className="flex justify-center gap-8 mt-3">
                <Stat className="items-center" value={track.laps} label="Giri" />
                <Stat className="items-center" value={`${track.baseLap.toFixed(1)}s`} label="Giro base" />
                <Stat className="items-center" value={`${Math.round(track.overtaking * 100)}%`} label="Sorpasso" />
              </div>

              <button
                type="button"
                onClick={onAdvance}
                className="mt-3 inline-flex items-center gap-1.5 rounded bg-primary px-4 py-1.5 text-xs
                  font-sans font-semibold text-[#04231A] hover:brightness-110 transition"
              >
                <Flag className="w-3.5 h-3.5" />
                {isRaceWeek(world) ? 'Vai alla gara' : 'Avanza la settimana'}
              </button>
            </div>
          ) : (
            <p className="text-center text-xs text-muted py-4">
              Il calendario è finito. Chiudi l'anno per passare alla stagione successiva.
            </p>
          )}
        </Panel>

        <Panel title="Classifica piloti" className="flex-1" bodyClass="p-0 scroll-y">
          {drivers.map((row) => {
            const d = world.drivers[row.driverId];
            if (!d) return null;
            const t = d.teamId ? world.teams[d.teamId] : null;
            const mine = d.id === me.id;
            return (
              <div
                key={row.driverId}
                className={`grid grid-cols-[22px_10px_1fr_auto] items-center gap-2 px-3 py-[5px]
                  border-b border-line/60 last:border-0 ${mine ? 'bg-primary/10' : ''}`}
              >
                <span className="font-mono text-2xs text-dim text-right tnum">{row.position}</span>
                <TeamDot colour={t?.colour ?? '#5D6C85'} />
                <span className={`font-sans text-xs truncate ${mine ? 'text-primary font-semibold' : ''}`}>{d.name}</span>
                <span className="font-mono text-2xs text-accent tnum">{row.points}</span>
              </div>
            );
          })}
        </Panel>
      </div>

      {/* ---- la scuderia ---- */}
      <div className="flex flex-col gap-2 min-h-0">
        {team && (
          <Panel title="La tua scuderia" className="shrink-0">
            <div className="flex items-center gap-2">
              <TeamDot colour={team.colour} />
              <span className="font-sans text-xs font-bold truncate">{team.name}</span>
            </div>
            <div className="mt-2">
              {team.driverIds.map((id) => {
                const d = world.drivers[id];
                if (!d) return null;
                return (
                  <KeyRow
                    key={id}
                    label={<span className={d.id === me.id ? 'text-ink font-semibold' : ''}>{d.name}</span>}
                    value={Math.round(overall(d.attrs))}
                  />
                );
              })}
            </div>
            <div className="mt-2 pt-2 border-t border-line">
              <div className="field-label mb-1.5">Auto</div>
              {[
                { k: 'Passo', v: (team.car.aero * 0.38 + team.car.engine * 0.34 + team.car.chassis * 0.28), c: '#3E86F0' },
                { k: 'Affidabilità', v: team.car.reliability, c: '#12A06E' },
              ].map((x) => (
                <div key={x.k} className="grid grid-cols-[72px_1fr_24px] items-center gap-2 py-[3px]">
                  <span className="font-mono text-2xs text-muted">{x.k}</span>
                  <Bar value={x.v} colour={x.c} height={5} />
                  <span className="font-mono text-2xs text-ink tnum text-right">{Math.round(x.v)}</span>
                </div>
              ))}
            </div>
          </Panel>
        )}

        <Panel title="Classifica scuderie" className="flex-1" bodyClass="p-0 scroll-y">
          {teams.map((c, i) => {
            const t = world.teams[c.teamId];
            if (!t) return null;
            const mine = c.teamId === team?.id;
            return (
              <div
                key={c.teamId}
                className={`grid grid-cols-[16px_10px_1fr_auto] items-center gap-2 px-3 py-[5px]
                  border-b border-line/60 last:border-0 ${mine ? 'bg-primary/10' : ''}`}
              >
                <span className="font-mono text-2xs text-dim text-right tnum">{i + 1}</span>
                <TeamDot colour={t.colour} />
                <span className={`font-sans text-xs truncate ${mine ? 'text-primary font-semibold' : ''}`}>{t.name}</span>
                <span className="font-mono text-2xs text-accent tnum">{c.points}</span>
              </div>
            );
          })}
        </Panel>
      </div>
    </div>
  );
}
