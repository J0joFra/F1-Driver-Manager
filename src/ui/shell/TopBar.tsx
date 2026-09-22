import { ChevronsRight } from 'lucide-react';
import { useGame, seasonWeeks } from '../../state/useGame.js';
import { currentWeek, isRaceWeek, nextRace, weekLabel } from '../../engine/selectors.js';
import { formatDay, weekMonday } from '../../engine/calendar.js';

/**
 * Riga di stato: dove si trova il mondo, e l'unico comando che fa passare il
 * tempo. Niente titolo della schermata — lo dice l'icona accesa nella barra
 * laterale, e in 390 px di altezza due righe di intestazione sono un lusso.
 */
export function TopBar({ onAdvance, busy }: { onAdvance: () => void; busy: boolean }) {
  const world = useGame((s) => s.world)!;
  const race = nextRace(world);
  const raceWeek = isRaceWeek(world);
  const seasonOver = world.week >= seasonWeeks;
  const week = currentWeek(world);
  const offersOpen = (world.offers?.length ?? 0) > 0;

  return (
    <header className="h-[34px] shrink-0 border-b border-line bg-panel flex items-center gap-3 px-3 font-mono text-2xs">
      <span className="font-sans font-bold tracking-[0.12em] text-ink text-[11px]">F1 MANAGER</span>
      <span className="text-muted tnum">{world.year}</span>
      <span className="text-muted tnum">
        {week ? formatDay(weekMonday(world.year, week)) : `sett. ${seasonWeeks}`}
      </span>
      <span className="text-dim truncate hidden sm:inline">{weekLabel(world)}</span>
      <span className="truncate">
        {offersOpen ? (
          <span className="text-accent">CONTRATTO SCADUTO · scegli dove correre</span>
        ) : seasonOver ? (
          <span className="text-accent">STAGIONE CONCLUSA</span>
        ) : race ? (
          <>
            <span className="text-accent">{raceWeek ? 'GARA:' : 'PROSSIMA:'}</span>{' '}
            <span className="text-muted">{race.trackName}</span>
          </>
        ) : (
          <span className="text-dim">Calendario finito</span>
        )}
      </span>

      <span className="flex-1" />

      <button
        type="button"
        data-testid="advance"
        onClick={onAdvance}
        disabled={busy || offersOpen}
        className="shrink-0 inline-flex items-center gap-1.5 rounded bg-primary px-3 py-1 text-[11px]
          font-sans font-semibold text-[#04231A] disabled:opacity-40 hover:brightness-110 transition"
      >
        <ChevronsRight className="w-3.5 h-3.5" />
        {offersOpen ? 'Firma un contratto' : seasonOver ? 'Chiudi anno' : raceWeek ? 'Vai alla gara' : 'Avanza'}
      </button>
    </header>
  );
}
