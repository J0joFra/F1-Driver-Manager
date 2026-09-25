import { Check, Trophy, X } from 'lucide-react';
import { useProfile } from '../../state/useProfile.js';
import { claimable, isComplete, OBJECTIVES, progressOf } from '../../engine/profile.js';
import { Bar } from '../components/kit.js';
import { WalletBar, RewardRow } from '../components/Currency.js';

/**
 * Gli obiettivi.
 *
 * Contano su **tutte** le carriere, non su quella in corso: un obiettivo che
 * si azzera quando ricominci non è un obiettivo, è un compito. Per questo i
 * contatori stanno nel profilo e non nel mondo.
 *
 * Quelli che hanno un corrispondente su Play Games si sbloccano anche lì,
 * quando l'app gira su Android ed è stato configurato. I **punti** Google Play
 * non c'entrano e non si possono assegnare: li dà Google a chi acquista, non
 * lo sviluppatore a chi gioca.
 */
export function Objectives({ onClose }: { onClose: () => void }) {
  const profile = useProfile((s) => s.profile);
  const claim = useProfile((s) => s.claimObjectiveById);

  const ordered = [...OBJECTIVES].sort((a, b) => {
    const rank = (o: typeof a) =>
      claimable(profile, o) ? 0 : isComplete(profile.stats, o) ? 2 : 1;
    return rank(a) - rank(b);
  });

  return (
    <div className="h-full flex flex-col gap-2 min-h-0">
      <div className="shrink-0 panel px-3 py-2 flex items-center gap-3">
        <WalletBar wallet={profile.wallet} />
        <h1 className="flex-1 text-center font-display text-base font-bold tracking-wide uppercase">
          Obiettivi
        </h1>
        <button
          type="button" onClick={onClose} aria-label="Chiudi" data-testid="objectives-close"
          className="w-7 h-7 rounded-full border border-line grid place-items-center
            text-muted hover:text-ink hover:border-dim transition"
        >
          <X className="w-3.5 h-3.5" />
        </button>
      </div>

      <div className="flex-1 min-h-0 scroll-y grid grid-cols-2 gap-2 auto-rows-min pr-0.5">
        {ordered.map((o) => {
          const progress = progressOf(profile.stats, o);
          const done = isComplete(profile.stats, o);
          const ready = claimable(profile, o);
          return (
            <div
              key={o.id}
              data-testid={`objective-${o.id}`}
              className={`panel px-2.5 py-2 ${ready ? 'border-accent' : ''}`}
            >
              <div className="flex items-baseline justify-between gap-2">
                <span className="font-sans text-xs font-bold truncate">{o.name}</span>
                {done && !ready && <Check className="w-3.5 h-3.5 text-good shrink-0" />}
              </div>
              <p className="font-mono text-[9px] text-dim leading-tight mt-0.5 truncate">
                {o.hint}
              </p>

              <div className="mt-1.5">
                <Bar value={(progress / o.target) * 100} colour={done ? '#12A06E' : '#3E86F0'} height={4} />
              </div>

              <div className="flex items-center justify-between gap-2 mt-1.5">
                <span className="font-mono text-[9px] text-muted tnum">
                  {progress} / {o.target}
                </span>
                {ready ? (
                  <button
                    type="button"
                    onClick={() => claim(o.id)}
                    data-testid={`claim-${o.id}`}
                    className="rounded bg-primary px-2.5 py-1 font-sans text-[10px] font-semibold
                      text-white hover:brightness-110 transition"
                  >
                    Riscuoti
                  </button>
                ) : (
                  <RewardRow reward={o.reward} size="sm" />
                )}
              </div>
            </div>
          );
        })}
      </div>

      <p className="shrink-0 font-mono text-[9px] text-dim flex items-center gap-1.5">
        <Trophy className="w-3 h-3" />
        Gli obiettivi valgono su tutte le carriere. Su Android, quelli configurati
        compaiono anche nel profilo Play Games.
      </p>
    </div>
  );
}
