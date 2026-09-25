import { Banknote, FlaskConical, Sparkles } from 'lucide-react';
import { CURRENCY_LABEL, type Currency, type Wallet } from '../../engine/wallet.js';

/**
 * Come si disegna una valuta.
 *
 * Un'icona, un colore e una regola di formato per ciascuna, in un posto solo.
 * Sparse per le schermate finirebbero per divergere, e due icone diverse per
 * la stessa cosa sono un modo sicuro di non farla riconoscere.
 */
export const CURRENCY_ICON = {
  credits: Banknote,
  skill: Sparkles,
  research: FlaskConical,
} as const;

export const CURRENCY_COLOUR: Record<Currency, string> = {
  credits: '#12A06E',
  skill: '#C8102E',
  research: '#3E86F0',
};

/** I crediti si contano in milioni: scriverne nove cifre non si legge. */
export function formatAmount(currency: Currency, amount: number): string {
  if (currency !== 'credits') return String(Math.round(amount));
  if (Math.abs(amount) >= 1_000_000) {
    return `${(amount / 1_000_000).toFixed(amount % 1_000_000 === 0 ? 0 : 1)}M`;
  }
  return `${Math.round(amount / 1000)}k`;
}

export function CurrencyChip({ currency, amount, size = 'md' }: {
  currency: Currency; amount: number; size?: 'sm' | 'md';
}) {
  const Icon = CURRENCY_ICON[currency];
  const colour = CURRENCY_COLOUR[currency];
  return (
    <span
      title={`${CURRENCY_LABEL[currency].name} — ${CURRENCY_LABEL[currency].hint}`}
      className={`inline-flex items-center gap-1.5 rounded border border-line bg-panel2
        ${size === 'sm' ? 'px-1.5 py-0.5' : 'px-2 py-1'}`}
    >
      <Icon className={size === 'sm' ? 'w-3 h-3' : 'w-3.5 h-3.5'} style={{ color: colour }} />
      <span className={`font-mono tnum ${size === 'sm' ? 'text-[9px]' : 'text-2xs'}`}>
        {formatAmount(currency, amount)}
      </span>
    </span>
  );
}

/** Il portafoglio intero, come lo si vede in alto a sinistra nelle schermate. */
export function WalletBar({ wallet, size = 'md' }: { wallet: Wallet; size?: 'sm' | 'md' }) {
  return (
    <span className="inline-flex items-center gap-1.5">
      <CurrencyChip currency="credits" amount={wallet.credits} size={size} />
      <CurrencyChip currency="skill" amount={wallet.skill} size={size} />
      <CurrencyChip currency="research" amount={wallet.research} size={size} />
    </span>
  );
}

/** Una ricompensa: le icone con i numeri sotto, come nei calendari di accesso. */
export function RewardRow({ reward, size = 'md' }: {
  reward: Partial<Wallet>; size?: 'sm' | 'md';
}) {
  const entries = (['credits', 'skill', 'research'] as const)
    .filter((c) => (reward[c] ?? 0) > 0);
  return (
    <span className="inline-flex items-center justify-center gap-2">
      {entries.map((c) => {
        const Icon = CURRENCY_ICON[c];
        return (
          <span key={c} className="flex flex-col items-center gap-0.5">
            <Icon
              className={size === 'sm' ? 'w-4 h-4' : 'w-6 h-6'}
              style={{ color: CURRENCY_COLOUR[c] }}
              strokeWidth={1.6}
            />
            <span className={`font-mono tnum ${size === 'sm' ? 'text-[9px]' : 'text-2xs'}`}>
              {formatAmount(c, reward[c]!)}
            </span>
          </span>
        );
      })}
    </span>
  );
}
