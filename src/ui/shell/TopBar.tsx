import { ChevronsRight, FastForward, Home } from 'lucide-react';
import { useGame, seasonWeeks } from '../../state/useGame.js';
import { currentWeek, isRaceDay, isRaceWeek, nextRace, today, weekLabel } from '../../engine/selectors.js';
import { formatDay } from '../../engine/calendar.js';
import { weekActivities, WEEKDAY_SHORT } from '../../engine/days.js';
import { nextStop, STOP_LABEL } from '../../engine/agenda.js';

/**
 * Riga di stato: dove si trova il mondo, e i comandi che fanno passare il
 * tempo. Niente titolo della schermata — lo dice l'icona accesa nella barra
 * laterale, e in 390 px di altezza due righe di intestazione sono un lusso.
 *
 * Il tempo scorre a giorni, quindi qui compare la data di oggi e non la
 * settimana: è il riferimento che il giocatore cerca per primo.
 */
export function TopBar({
  onAdvance, onSkip, busy, onMenu,
}: { onAdvance: () => void; onSkip: () => void; busy: boolean; onMenu: () => void }) {
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

  /*
   * Il paddock è casa, e da lì si avanza.
   *
   * Il pulsante deve dire dove porta. Se da un'altra schermata dicesse
   * «Avanza» e invece navigasse, sarebbe un pulsante che mente — e la seconda
   * volta il giocatore non si fiderebbe più di nessun pulsante.
   */
  const screen = useGame((s) => s.screen);
  const atHome = screen === 'paddock';
  const stop = world.week < seasonWeeks ? nextStop(world) : null;

  // Che cosa c'è in programma oggi: è la riga che sostituisce il "che
  // settimana è" di prima, e dice al giocatore se vale la pena fermarsi.
  const agenda = week
    ? (weekActivities(week, Object.values(plans)[0] ?? null)[world.dayOfWeek] ?? [])
        .map((a) => a.label).join(' · ')
    : '';

  return (
    <header className="h-[34px] shrink-0 border-b border-line bg-panel flex items-center gap-3 px-3 font-mono text-2xs">
      {/* Il titolo è anche la via d'uscita: da qui si torna al menu, e lo
          slot viene scritto prima di uscire. */}
      <button
        type="button" onClick={onMenu} data-testid="to-menu" title="Torna al menu"
        className="font-sans font-bold tracking-[0.12em] text-ink text-[11px]
          hover:text-primary transition shrink-0"
      >
        F1 MANAGER
      </button>
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

      {atHome && !seatsEmpty && !seasonOver && !raceDay && (
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
        disabled={busy || (atHome && seatsEmpty)}
        title={atHome && stop && !seasonOver && !raceDay
          ? `Salta ${stop.days} giorn${stop.days === 1 ? 'o' : 'i'} fino a: ${STOP_LABEL[stop.reason].toLowerCase()}`
          : undefined}
        className="shrink-0 inline-flex items-center gap-1.5 rounded bg-primary px-3 py-1 text-[11px]
          font-sans font-semibold text-[#04231A] disabled:opacity-40 hover:brightness-110 transition"
      >
        {atHome ? <ChevronsRight className="w-3.5 h-3.5" /> : <Home className="w-3.5 h-3.5" />}
        {!atHome ? 'Al paddock'
          : seatsEmpty ? 'Ingaggia un pilota'
          : seasonOver ? 'Chiudi anno'
          : raceDay ? 'Vai alla gara'
          : stop ? `Avanza · ${STOP_LABEL[stop.reason]}`
          : 'Avanza'}
      </button>
    </header>
  );
}
