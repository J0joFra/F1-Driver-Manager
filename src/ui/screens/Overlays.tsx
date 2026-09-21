import { useGame } from '../../state/useGame.js';
import { player } from '../../engine/selectors.js';
import { getTrack } from '../../engine/data/tracks.js';
import { driverStandings } from '../../engine/season.js';
import { Btn, Stat } from '../components/kit.js';
import { gap } from '../format.js';

function Sheet({ children, onClose, cta = 'Continua' }: { children: React.ReactNode; onClose: () => void; cta?: string }) {
  return (
    <div className="absolute inset-0 z-30 bg-ground/[0.97] backdrop-blur-md flex flex-col">
      <div className="flex-1 min-h-0 p-3">{children}</div>
      <div className="shrink-0 p-3 pt-0">
        <Btn variant="primary" onClick={onClose} className="w-full py-3" testId="dismiss-sheet">{cta}</Btn>
      </div>
    </div>
  );
}

/** Riepilogo del weekend appena corso. */
export function WeekendOverlay() {
  const world = useGame((s) => s.world)!;
  const dismiss = useGame((s) => s.dismissSummary);
  const me = player(world)!;
  const weekend = world.results[world.results.length - 1];
  if (!weekend) return null;

  const mine = weekend.race.find((r) => r.driverId === me.id);
  const grid = weekend.qualifying.find((q) => q.driverId === me.id)?.position ?? 0;
  const top = weekend.race.slice(0, 10);
  const delta = mine && !mine.dnf ? grid - mine.position : 0;

  return (
    <Sheet onClose={dismiss}>
      <div className="h-full grid grid-cols-[1fr_1.1fr] gap-3 min-h-0">
        <div className="flex flex-col gap-3 min-h-0">
          <div>
            <div className="font-display text-xs tracking-[0.16em] text-aurora font-bold uppercase">
              Round {weekend.round + 1} · {weekend.wet ? 'bagnato' : 'asciutto'}
              {weekend.safetyCars > 0 && ' · safety car'}
            </div>
            <h2 className="font-display text-2xl font-bold leading-tight mt-1">{getTrack(weekend.trackId).name.toUpperCase()}</h2>
          </div>
          <div className="flex gap-5">
            <Stat value={mine ? (mine.dnf ? 'RIT' : `P${mine.position}`) : '—'} label="Arrivo"
              accent={mine?.dnf ? '#E8283C' : mine && mine.position <= 3 ? '#2FD98A' : undefined} />
            <Stat value={grid ? `P${grid}` : '—'} label="Griglia" />
            <Stat value={mine?.points ?? 0} label="Punti" />
            <Stat value={delta > 0 ? `+${delta}` : delta || '—'} label="Guadagnate"
              accent={delta > 0 ? '#2FD98A' : delta < 0 ? '#E8283C' : undefined} />
          </div>
          <div className="font-mono text-2xs text-dim leading-relaxed">
            {mine?.dnf
              ? 'Ritiro. Succede: la macchina cede o il pilota sbaglia, e la classifica non perdona.'
              : delta > 0
                ? `Hai guadagnato ${delta} posizion${delta === 1 ? 'e' : 'i'} rispetto alla griglia. È questo che le altre scuderie guardano.`
                : 'La gara è finita. Il campionato prosegue.'}
          </div>
        </div>

        <div className="panel flex flex-col min-h-0">
          <div className="panel-head shrink-0">
            <h3 className="panel-title">Ordine d'arrivo</h3>
            <span className="font-mono text-2xs text-dim">primi 10</span>
          </div>
          <div className="flex-1 min-h-0 scroll-y">
            {top.map((r) => {
              const d = world.drivers[r.driverId];
              const team = d?.teamId ? world.teams[d.teamId] : null;
              const isMe = r.driverId === me.id;
              return (
                <div key={r.driverId}
                  className={`grid grid-cols-[20px_3px_1fr_auto_28px] items-center gap-2 px-3 py-1 border-b border-line last:border-0 ${
                    isMe ? 'bg-aurora/15' : ''}`}>
                  <span className="font-display text-sm font-bold text-right text-dim tnum">{r.position}</span>
                  <i className="block w-[3px] h-3.5 rounded-sm" style={{ background: team?.colour ?? '#5B6672' }} />
                  <span className="font-display text-sm tracking-wide truncate">{d?.name}</span>
                  <span className="font-mono text-2xs text-dim tnum">{r.position === 1 ? 'LEADER' : gap(r.gap)}</span>
                  <span className="font-mono text-2xs text-muted text-right tnum">{r.points || ''}</span>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </Sheet>
  );
}

/** Fine stagione: titolo, bilancio personale, cosa è cambiato nel mondo. */
export function SeasonOverlay() {
  const world = useGame((s) => s.world)!;
  const summary = useGame((s) => s.lastSeason)!;
  const dismiss = useGame((s) => s.dismissSummary);
  const me = player(world)!;
  const last = me.history[me.history.length - 1];
  const champion = world.drivers[summary.championId];
  const championTeam = world.teams[summary.championTeamId];

  return (
    <Sheet onClose={dismiss} cta={`Inizia la stagione ${world.year}`}>
      <div className="h-full grid grid-cols-[1fr_1fr] gap-3 min-h-0">
        <div className="flex flex-col gap-3">
          <div>
            <div className="font-display text-xs tracking-[0.16em] text-aurora font-bold uppercase">Stagione {summary.year}</div>
            <h2 className="font-display text-2xl font-bold leading-tight mt-1">
              {champion?.id === me.id ? 'SEI CAMPIONE DEL MONDO' : `CAMPIONE: ${champion?.name.toUpperCase() ?? '—'}`}
            </h2>
            <div className="font-mono text-2xs text-dim mt-1">{championTeam?.name}</div>
          </div>
          {last && (
            <div className="flex gap-5">
              <Stat value={`P${last.championshipPos}`} label="La tua posizione" />
              <Stat value={last.points} label="Punti" />
              <Stat value={last.wins} label="Vittorie" />
              <Stat value={last.podiums} label="Podi" />
            </div>
          )}
        </div>

        <div className="panel p-3 flex flex-col gap-2 min-h-0 scroll-y">
          <h3 className="panel-title">Il mondo è cambiato</h3>
          <div className="flex flex-col font-mono text-xs">
            <div className="flex justify-between py-1.5 border-b border-line">
              <span className="text-muted">Piloti ritirati</span><span className="tnum">{summary.retired.length}</span>
            </div>
            <div className="flex justify-between py-1.5 border-b border-line">
              <span className="text-muted">Nuovi talenti</span><span className="tnum">{summary.newgens}</span>
            </div>
            <div className="flex justify-between py-1.5 border-b border-line">
              <span className="text-muted">La tua età</span><span className="tnum">{me.age} anni</span>
            </div>
            <div className="flex justify-between py-1.5">
              <span className="text-muted">Regolamento</span>
              <span className={`tnum ${summary.regulationReset ? 'text-warn' : ''}`}>
                {summary.regulationReset ? 'AZZERATO' : `stabile fino al ${world.regulations.nextResetYear}`}
              </span>
            </div>
          </div>
          {summary.regulationReset && (
            <p className="text-2xs text-warn leading-relaxed">
              Nuove regole tecniche: le monoposto si sono riavvicinate e la gerarchia va riletta da zero.
            </p>
          )}
        </div>
      </div>
    </Sheet>
  );
}

export function useStandingsSnapshot() {
  const world = useGame((s) => s.world);
  return world ? driverStandings(world) : [];
}
