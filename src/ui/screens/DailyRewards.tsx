import { Check, Lock, X } from 'lucide-react';
import { useProfile } from '../../state/useProfile.js';
import { claimableDay, CYCLE_LENGTH, DAILY_CYCLE } from '../../engine/profile.js';
import { WalletBar, RewardRow } from '../components/Currency.js';

/**
 * Le ricompense giornaliere.
 *
 * Sette caselle, quella di oggi accesa, le altre chiuse col lucchetto e
 * l'ultima grande. È l'impaginazione che hanno tutti i calendari di accesso, e
 * funziona per un motivo preciso: la casella che conta è sempre quella che non
 * hai ancora preso, e vederla in fondo alla fila dice quanto manca senza
 * scriverlo.
 *
 * La serie si spezza se salti un giorno e riparte dalla prima casella. Sembra
 * severo ed è il punto — una serie che non si può perdere non è una serie.
 */
export function DailyRewards({ onClose }: { onClose: () => void }) {
  const profile = useProfile((s) => s.profile);
  const claim = useProfile((s) => s.claimToday);

  const today = claimableDay(profile.daily);
  // Quante caselle sono già state prese in questo giro.
  const done = today === null
    ? ((profile.daily.streak - 1) % CYCLE_LENGTH) + 1
    : profile.daily.streak % CYCLE_LENGTH;

  return (
    <div className="h-full flex flex-col gap-2 min-h-0">
      <div className="shrink-0 panel px-3 py-2 flex items-center gap-3">
        <WalletBar wallet={profile.wallet} />
        <h1 className="flex-1 text-center font-display text-base font-bold tracking-wide uppercase">
          Ricompense giornaliere
        </h1>
        <span className="font-mono text-2xs text-dim">
          Giorni di accesso: {profile.daily.totalDays}
        </span>
        <button
          type="button" onClick={onClose} aria-label="Chiudi" data-testid="daily-close"
          className="w-7 h-7 rounded-full border border-line grid place-items-center
            text-muted hover:text-ink hover:border-dim transition"
        >
          <X className="w-3.5 h-3.5" />
        </button>
      </div>

      <div className="flex-1 grid grid-cols-[repeat(3,1fr)_1.15fr] grid-rows-2 gap-2 min-h-0">
        {DAILY_CYCLE.map((reward, i) => {
          const last = i === CYCLE_LENGTH - 1;
          const claimed = i < done;
          const isToday = today === i;
          return (
            <div
              key={i}
              data-testid={`daily-day-${i + 1}`}
              className={`relative panel flex flex-col items-center justify-center gap-1.5 p-2
                ${last ? 'row-span-2 col-start-4 row-start-1 border-primary/70' : ''}
                ${isToday ? 'border-accent' : ''}
                ${claimed ? 'opacity-55' : ''}`}
            >
              <span className="absolute top-1.5 left-0 right-0 text-center field-label">
                Giorno {i + 1}
              </span>
              {!isToday && !claimed && (
                <Lock className="absolute top-2 right-2 w-3.5 h-3.5 text-dim" />
              )}
              {claimed && (
                <Check className="absolute top-2 right-2 w-3.5 h-3.5 text-good" />
              )}

              <div className={last ? 'scale-125 mt-2' : 'mt-2'}>
                <RewardRow reward={reward} size={last ? 'md' : 'sm'} />
              </div>

              {isToday && (
                <button
                  type="button"
                  onClick={() => claim()}
                  data-testid="daily-claim"
                  className="mt-1 w-full max-w-[150px] rounded bg-primary px-3 py-1.5
                    font-sans text-2xs font-semibold text-white hover:brightness-110 transition"
                >
                  Richiedi
                </button>
              )}
            </div>
          );
        })}
      </div>

      <p className="shrink-0 font-mono text-[9px] text-dim text-center">
        {today === null
          ? 'Premio di oggi già ritirato. Torna domani: la serie continua.'
          : 'Salta un giorno e la serie riparte dal primo premio.'}
      </p>
    </div>
  );
}
