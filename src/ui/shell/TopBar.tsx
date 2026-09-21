import { useGame, seasonWeeks } from '../../state/useGame.js';
import { championshipPosition, isRaceWeek, nextRace, player, teamOf } from '../../engine/selectors.js';
import { money } from '../format.js';
import { Icon } from './icons.js';

/**
 * Barra di stato alta 36 px: dove sei nel mondo e il pulsante che fa avanzare
 * il tempo. È l'unico comando sempre presente.
 */
export function TopBar({ onAdvance, busy }: { onAdvance: () => void; busy: boolean }) {
  const world = useGame((s) => s.world)!;
  const me = player(world);
  const team = teamOf(world, me);
  const race = nextRace(world);
  const raceWeek = isRaceWeek(world);
  const pos = me ? championshipPosition(world, me.id) : 0;
  const seasonOver = world.week >= seasonWeeks;

  return (
    <header className="h-9 shrink-0 border-b border-line bg-panel flex items-center gap-3 px-3 text-xs">
      <div className="flex items-center gap-2 shrink-0">
        <span className="font-display text-base font-bold tnum">{world.year}</span>
        <span className="text-dim font-mono text-2xs">
          set. {Math.min(world.week + 1, seasonWeeks)}/{seasonWeeks}
        </span>
      </div>

      {team && (
        <div className="flex items-center gap-1.5 shrink-0">
          <i className="block w-[3px] h-3.5 rounded-sm" style={{ background: team.colour }} />
          <span className="font-display text-sm tracking-wide truncate max-w-[110px]">{team.name}</span>
        </div>
      )}

      <div className="flex-1 min-w-0 truncate text-dim font-mono text-2xs">
        {seasonOver
          ? 'Stagione conclusa'
          : race
            ? raceWeek
              ? `GARA · ${race.trackName} · round ${race.round}/${race.totalRounds}`
              : `Prossima: ${race.trackName} · fra ${race.weeksAway} set.`
            : 'Nessuna gara rimasta'}
      </div>

      <div className="hidden sm:flex items-center gap-3 shrink-0 font-mono text-2xs text-muted tnum">
        <span>{pos > 0 ? `P${pos}` : '—'}</span>
        <span>{world.standings[me?.id ?? ''] ?? 0} pt</span>
        <span className="text-good">{money(me?.money ?? 0)}</span>
      </div>

      <button
        type="button"
        onClick={onAdvance}
        disabled={busy}
        className="shrink-0 flex items-center gap-1.5 font-display text-sm font-bold uppercase tracking-[0.1em] px-3 py-1.5 rounded-sm bg-aurora text-white disabled:opacity-40"
      >
        {seasonOver ? 'Chiudi anno' : raceWeek ? 'Vai in pista' : 'Avanza'}
        <Icon name="next" size={14} />
      </button>
    </header>
  );
}
