import { useGame } from '../../state/useGame.js';
import { player, teamOf } from '../../engine/selectors.js';
import { carPace } from '../../engine/regulations.js';
import { overall } from '../../engine/driver.js';
import { Bar, Note, Panel, TeamBadge } from '../components/kit.js';
import { money } from '../format.js';

/**
 * La scuderia, in sola lettura.
 *
 * In Modalità Pilota vedi le scelte del team e non puoi cambiarle: è
 * frustrazione voluta, ed è la promessa della Modalità Scuderia.
 */
export function TeamScreen() {
  const world = useGame((s) => s.world)!;
  const me = player(world)!;
  const team = teamOf(world, me);
  if (!team) {
    return <Panel title="Scuderia"><p className="text-xs text-muted">Sei senza sedile.</p></Panel>;
  }

  const pace = carPace(team.car);
  const rank = Object.values(world.teams).sort((a, b) => carPace(b.car) - carPace(a.car))
    .findIndex((t) => t.id === team.id) + 1;

  return (
    <div className="h-full grid grid-cols-[210px_1fr_212px] gap-2 min-h-0">
      <Panel title="La tua scuderia" bodyClass="p-2.5">
        <div className="flex items-center gap-2.5">
          <TeamBadge name={team.name} colour={team.colour} />
          <div className="min-w-0">
            <div className="font-sans text-xs font-bold truncate">{team.name}</div>
            <div className="font-mono text-2xs text-muted">Prestigio {Math.round(team.prestige)}</div>
          </div>
        </div>

        <div className="mt-3">
          {[
            { k: 'Passo auto', v: pace, c: '#3E86F0' },
            { k: 'Affidabilità', v: team.car.reliability, c: '#12A06E' },
            { k: 'Budget', v: (team.budget / 135_000_000) * 100, c: '#D4761E', shown: money(team.budget) },
            { k: 'Prestigio', v: team.prestige, c: '#A06BE0' },
          ].map((x) => (
            <div key={x.k} className="py-1.5">
              <div className="flex items-baseline justify-between mb-1">
                <span className="font-mono text-2xs text-muted">{x.k}</span>
                <span className="font-mono text-2xs text-ink tnum">{x.shown ?? Math.round(x.v)}</span>
              </div>
              <Bar value={x.v} colour={x.c} height={5} />
            </div>
          ))}
        </div>

        <div className="mt-2 pt-2 border-t border-line">
          <div className="field-label mb-1">Ordine in griglia</div>
          <div className="font-mono text-2xs text-muted">
            {rank}ª forza su {Object.keys(world.teams).length} per passo
          </div>
        </div>
      </Panel>

      <Panel title="Piloti" bodyClass="p-2.5 scroll-y">
        {team.driverIds.map((id, i) => {
          const d = world.drivers[id];
          if (!d) return null;
          const mine = d.id === me.id;
          return (
            <div
              key={id}
              className={`rounded border px-2.5 py-2 mb-2 last:mb-0 ${
                mine ? 'border-primary/70 bg-primary/5' : 'border-line bg-panel2'
              }`}
            >
              <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-2 min-w-0">
                  <span className="font-sans text-xs font-bold truncate">{d.name}</span>
                  {mine && (
                    <span className="font-mono text-[8.5px] text-primary border border-primary/50 rounded px-1 py-px shrink-0">
                      TU
                    </span>
                  )}
                </div>
                <span className="font-mono text-[8.5px] text-dim shrink-0">{i + 1}ª guida</span>
              </div>
              <div className="grid grid-cols-3 gap-1.5 mt-2">
                {[
                  { k: 'OVR', v: Math.round(overall(d.attrs)) },
                  { k: 'Età', v: d.age },
                  { k: 'Ingaggio', v: money(d.salary) },
                ].map((x) => (
                  <div key={x.k} className="bg-panel border border-line rounded px-2 py-1">
                    <div className="field-label">{x.k}</div>
                    <div className="font-mono text-xs text-ink tnum mt-0.5">{x.v}</div>
                  </div>
                ))}
              </div>
            </div>
          );
        })}
      </Panel>

      <Panel title="Sviluppo" bodyClass="p-2.5 scroll-y">
        <Note tone="warn">
          Modalità Pilota: la scuderia è in sola lettura. Vedi lo sviluppo ma non lo controlli.
        </Note>
        <p className="font-sans text-[10.5px] text-muted leading-relaxed mt-2.5">
          Le scuderie sviluppano la macchina da sole, ogni stagione. Chi vince sviluppa meno —
          handicap inverso alla classifica, come le ore di galleria del vento in Formula 1 — e ogni
          4–6 anni un reset regolamentare rimescola la gerarchia.
        </p>
        <div className="mt-2.5 pt-2 border-t border-line">
          <div className="flex items-baseline justify-between py-[3px]">
            <span className="font-mono text-2xs text-muted">Prossimo reset</span>
            <span className="font-mono text-2xs text-accent tnum">{world.regulations.nextResetYear}</span>
          </div>
          <div className="flex items-baseline justify-between py-[3px]">
            <span className="font-mono text-2xs text-muted">Ultimo reset</span>
            <span className="font-mono text-2xs text-ink tnum">{world.regulations.lastResetYear}</span>
          </div>
          <div className="flex items-baseline justify-between py-[3px]">
            <span className="font-mono text-2xs text-muted">Dir. tecnico</span>
            <span className="font-mono text-2xs text-ink tnum">{Math.round(team.crew.technical)}</span>
          </div>
          <div className="flex items-baseline justify-between py-[3px]">
            <span className="font-mono text-2xs text-muted">Pit crew</span>
            <span className="font-mono text-2xs text-ink tnum">{Math.round(team.crew.pitCrew)}</span>
          </div>
        </div>
      </Panel>
    </div>
  );
}
