import { CalendarDays, ChevronRight, Flag, Trophy } from 'lucide-react';
import { useGame, seasonWeeks, type Screen } from '../../state/useGame.js';
import { championshipPosition, isRaceWeek, nextRace, player, teamOf } from '../../engine/selectors.js';
import { money } from '../format.js';

/**
 * Intestazione della schermata.
 *
 * Una gerarchia sola: il titolo dice dove sei, la riga sotto dà il contesto
 * (data, prossima gara), e a destra sta ciò che si può fare. È l'unico posto
 * da cui si fa avanzare il tempo.
 */
const TITLES: Record<Screen, { title: string; hint: string }> = {
  paddock: { title: 'Paddock', hint: 'La settimana e il prossimo weekend' },
  pilota: { title: 'Pilota', hint: 'Attributi, potenziale, stagione' },
  allenamento: { title: 'Allenamento', hint: 'Come spendi la settimana' },
  finanze: { title: 'Finanze', hint: 'Bilancio e staff personale' },
  scuderia: { title: 'Scuderia', hint: 'Monoposto e budget del team' },
  classifiche: { title: 'Classifiche', hint: 'Piloti e costruttori' },
  storia: { title: 'Storia', hint: 'Le tue stagioni e l’albo d’oro' },
};

export function TopBar({ onAdvance, busy }: { onAdvance: () => void; busy: boolean }) {
  const world = useGame((s) => s.world)!;
  const screen = useGame((s) => s.screen);
  const me = player(world);
  const team = teamOf(world, me);
  const race = nextRace(world);
  const raceWeek = isRaceWeek(world);
  const pos = me ? championshipPosition(world, me.id) : 0;
  const seasonOver = world.week >= seasonWeeks;
  const meta = TITLES[screen];

  const context = seasonOver
    ? 'Stagione conclusa'
    : race
      ? raceWeek
        ? `Gara · ${race.trackName} · round ${race.round}/${race.totalRounds}`
        : `${race.trackName} fra ${race.weeksAway} settiman${race.weeksAway === 1 ? 'a' : 'e'}`
      : 'Nessuna gara rimasta';

  return (
    <header className="h-[42px] shrink-0 border-b border-line bg-panel flex items-center gap-3 px-3">
      <div className="min-w-0">
        <h1 className="font-display text-lg font-bold uppercase tracking-[0.06em] leading-none truncate">
          {meta.title}
        </h1>
        <p className="flex items-center gap-1 mt-0.5 font-mono text-2xs text-dim leading-none truncate">
          <CalendarDays className="w-3 h-3 shrink-0" />
          {world.year} · set. {Math.min(world.week + 1, seasonWeeks)}/{seasonWeeks} · {context}
        </p>
      </div>

      <span className="flex-1" />

      {team && (
        <div className="hidden sm:flex items-center gap-1.5 shrink-0">
          <i className="block w-[3px] h-4 rounded-sm" style={{ background: team.colour }} />
          <span className="font-display text-sm font-semibold uppercase tracking-wide truncate max-w-[92px]">
            {team.short}
          </span>
        </div>
      )}

      <div className="hidden sm:flex items-center gap-2.5 shrink-0 font-mono text-2xs text-muted tnum">
        <span className="flex items-center gap-1">
          <Trophy className="w-3 h-3 text-dim" />
          {pos > 0 ? `P${pos}` : '—'}
        </span>
        <span>{world.standings[me?.id ?? ''] ?? 0} pt</span>
        <span className="text-primary">{money(me?.money ?? 0)}</span>
      </div>

      <button
        type="button"
        data-testid="advance"
        onClick={onAdvance}
        disabled={busy}
        className="shrink-0 flex items-center gap-1 font-display text-sm font-bold uppercase tracking-[0.08em] px-3 py-1.5 rounded-md bg-aurora text-white disabled:opacity-40 hover:brightness-110 transition"
      >
        {seasonOver ? 'Chiudi anno' : raceWeek ? <><Flag className="w-3.5 h-3.5" />Vai in pista</> : 'Avanza'}
        {!raceWeek && <ChevronRight className="w-3.5 h-3.5" />}
      </button>
    </header>
  );
}
