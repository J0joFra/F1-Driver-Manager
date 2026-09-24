import { ChevronsRight, FastForward } from 'lucide-react';
import { useGame, seasonWeeks } from '../../state/useGame.js';
import { currentWeek, isRaceDay, isRaceWeek, nextRace, today, weekLabel } from '../../engine/selectors.js';
import { formatDay } from '../../engine/calendar.js';
import { weekActivities, WEEKDAY_SHORT } from '../../engine/days.js';

/**
 * Riga di stato: dove si trova il mondo, e i comandi che fanno passare il
 * tempo. Niente titolo della schermata — lo dice l'icona accesa nella barra
 * laterale, e in 390 px di altezza due righe di intestazione sono un lusso.
 *
 * Il tempo scorre a giorni, quindi qui compare la data di oggi e non la
 * settimana: è il riferimento che il giocatore cerca per primo.
 */
export function TopBar({
  onAdvance, onSkip, busy,
}: { onAdvance: () => void; onSkip: () => void; busy: boolean }) {
  const world = useGame((s) => s.world)!;
  const plans = useGame((s) => s.plans);
  const race = nextRace(world);
  const raceWeek = isRaceWeek(world);
  const raceDay = isRaceDay(world);
  const seasonOver = world.week >= seasonWeeks;
  const week = currentWeek(world);
  const date = today(world);
  // Una scuderia senza piloti non può correre: è la cosa più urgente che
  // esista, e va detta dove il giocatore guarda per avanzare.
  const seatsEmpty = world.seat.mode === 'scuderia'
    && (world.teams[world.seat.teamId]?.driverIds.length ?? 0) === 0;

  // Che cosa c'è in programma oggi: è la riga che sostituisce il "che
  // settimana è" di prima, e dice al giocatore se vale la pena fermarsi.
  const agenda = week
    ? (weekActivities(week, Object.values(plans)[0] ?? null)[world.dayOfWeek] ?? [])
        .map((a) => a.label).join(' · ')
    : '';

  return (
    <header className="h-[34px] shrink-0 border-b border-line bg-panel flex items-center gap-3 px-3 font-mono text-2xs">
      <span className="font-sans font-bold tracking-[0.12em] text-ink text-[11px]">F1 MANAGER</span>
      <span className="text-muted tnum">{world.year}</span>
      <span className="text-ink tnum">
        {date ? `${WEEKDAY_SHORT[world.dayOfWeek]} ${formatDay(date)}` : `sett. ${seasonWeeks}`}
      </span>
      <span className="text-dim truncate hidden md:inline">{agenda || weekLabel(world)}</span>
      <span className="truncate">
        {seatsEmpty ? (
          <span className="text-accent">NESSUN PILOTA · la scuderia non prende il via</span>
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

      {!seatsEmpty && !seasonOver && !raceDay && (
        <button
          type="button"
          data-testid="skip"
          onClick={onSkip}
          disabled={busy}
          title="Salta al prossimo weekend di gara"
          className="shrink-0 inline-flex items-center gap-1 rounded border border-line px-2 py-1
            text-[11px] font-sans text-muted hover:text-ink hover:border-dim
            disabled:opacity-40 transition"
        >
          <FastForward className="w-3 h-3" />
          <span className="hidden sm:inline">Al weekend</span>
        </button>
      )}

      <button
        type="button"
        data-testid="advance"
        onClick={onAdvance}
        disabled={busy || seatsEmpty}
        className="shrink-0 inline-flex items-center gap-1.5 rounded bg-primary px-3 py-1 text-[11px]
          font-sans font-semibold text-[#04231A] disabled:opacity-40 hover:brightness-110 transition"
      >
        <ChevronsRight className="w-3.5 h-3.5" />
        {seatsEmpty ? 'Ingaggia un pilota'
          : seasonOver ? 'Chiudi anno'
          : raceDay ? 'Vai alla gara'
          : 'Avanza'}
      </button>
    </header>
  );
}
