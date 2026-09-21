import { useGame } from '../../state/useGame.js';
import { player, teamOf } from '../../engine/selectors.js';
import { carPace, CAR_KEYS } from '../../engine/regulations.js';
import { Note, Panel } from '../components/kit.js';
import { money } from '../format.js';

const CAR_LABELS: Record<string, string> = {
  aero: 'Aerodinamica', engine: 'Motore', chassis: 'Telaio', reliability: 'Affidabilità',
};

/**
 * La scuderia in sola lettura.
 *
 * In Modalità Pilota vedi le scelte del team e non puoi cambiarle: è
 * frustrazione voluta, ed è la promessa della Modalità Scuderia.
 */
export function TeamScreen() {
  const world = useGame((s) => s.world)!;
  const me = player(world)!;
  const team = teamOf(world, me);
  if (!team) return <Panel title="Scuderia"><p className="text-sm text-muted">Sei senza sedile.</p></Panel>;

  const rank = Object.values(world.teams)
    .sort((a, b) => carPace(b.car) - carPace(a.car))
    .findIndex((t) => t.id === team.id) + 1;

  return (
    <div className="h-full grid grid-cols-[1fr_1fr] gap-2 min-h-0">
      <Panel title={`Monoposto · ${team.name}`} tag={`${rank}ª forza · ${carPace(team.car).toFixed(0)}/100`} bodyClass="p-3 scroll-y">
        <div className="flex flex-col gap-1.5 opacity-70">
          {CAR_KEYS.map((k) => (
            <div key={k} className="grid grid-cols-[86px_1fr_28px] items-center gap-2">
              <span className="text-xs text-muted">{CAR_LABELS[k]}</span>
              <div className="h-3 bg-panel2 rounded-sm overflow-hidden">
                <div className="h-full" style={{ width: `${team.car[k]}%`, background: team.colour, borderRadius: '0 4px 4px 0' }} />
              </div>
              <span className="font-mono text-xs text-muted text-right tnum">{Math.round(team.car[k])}</span>
            </div>
          ))}
        </div>
        <div className="mt-3">
          <Note>
            <b className="font-display tracking-wide text-nordvik">SOLA LETTURA.</b>{' '}
            Vedi le scelte della tua scuderia ma non puoi cambiarle. In Modalità Scuderia questi cursori sono tuoi.
          </Note>
        </div>
      </Panel>

      <Panel title="Budget e staff" tag={`${world.year}`} bodyClass="p-3 scroll-y">
        <div className="flex flex-col gap-1.5 opacity-70">
          {[
            { k: 'Dir. tecnico', v: team.crew.technical },
            { k: 'Ing. di pista', v: team.crew.trackEngineer },
            { k: 'Pit crew', v: team.crew.pitCrew },
          ].map((x) => (
            <div key={x.k} className="grid grid-cols-[86px_1fr_28px] items-center gap-2">
              <span className="text-xs text-muted">{x.k}</span>
              <div className="h-3 bg-panel2 rounded-sm overflow-hidden">
                <div className="h-full bg-muted" style={{ width: `${x.v}%`, borderRadius: '0 4px 4px 0' }} />
              </div>
              <span className="font-mono text-xs text-muted text-right tnum">{Math.round(x.v)}</span>
            </div>
          ))}
        </div>
        <div className="mt-3 flex flex-col font-mono text-xs">
          <div className="flex justify-between py-1.5 border-b border-line">
            <span className="text-muted">Budget cap</span><span className="tnum">{money(team.budget)}</span>
          </div>
          <div className="flex justify-between py-1.5 border-b border-line">
            <span className="text-muted">Prestigio</span><span className="tnum">{Math.round(team.prestige)}/100</span>
          </div>
          <div className="flex justify-between py-1.5">
            <span className="text-muted">Piloti</span>
            <span className="tnum text-right">{team.driverIds.map((id) => world.drivers[id]?.name).join(' · ')}</span>
          </div>
        </div>
      </Panel>
    </div>
  );
}
