import { useEffect, useState } from 'react';
import { AlertTriangle, Loader2, ShoppingBag, X } from 'lucide-react';
import { useProfile } from '../../state/useProfile.js';
import { createBilling, type Billing, type StoreProduct } from '../../platform/billing.js';
import { PRODUCTS } from '../../engine/store.js';
import { Note } from '../components/kit.js';
import { WalletBar, RewardRow } from '../components/Currency.js';

/**
 * Il negozio.
 *
 * Due cose che questa schermata fa e che quasi nessun negozio di gioco fa:
 *
 * 1. **Dice quando non è reale.** Nel browser non c'è nessun negozio dietro:
 *    il pulsante accredita e basta, e sopra c'è scritto. Fingere un acquisto
 *    senza dirlo è il modo migliore per ritrovarsi un giorno con un accredito
 *    che il giocatore giura di aver pagato.
 * 2. **Mostra il prezzo del negozio, non il nostro.** Quello scritto nel
 *    catalogo è solo un segnaposto per il tempo in cui Google non ha ancora
 *    risposto. Mostrare una cifra diversa da quella addebitata, oltre che
 *    scorretto, è vietato dalle regole del Play Store.
 */
export function Store({ onClose }: { onClose: () => void }) {
  const profile = useProfile((s) => s.profile);
  const credit = useProfile((s) => s.creditPurchase);

  const [billing, setBilling] = useState<Billing | null>(null);
  const [items, setItems] = useState<StoreProduct[]>(
    PRODUCTS.map((p) => ({ ...p, storePrice: p.price, available: true })),
  );
  const [busy, setBusy] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  useEffect(() => {
    let alive = true;
    createBilling().then(async (b) => {
      if (!alive) return;
      setBilling(b);
      setItems(await b.products());
    });
    return () => { alive = false; };
  }, []);

  const buy = async (id: string) => {
    if (!billing || busy) return;
    setBusy(id);
    setMessage(null);
    try {
      const outcome = await billing.buy(id);
      if (outcome.status === 'annullato') { setMessage('Acquisto annullato.'); return; }
      if (outcome.status === 'errore') { setMessage(outcome.message); return; }
      // L'accredito passa dal profilo, che registra la ricevuta: se lo stesso
      // acquisto torna una seconda volta — succede, quando Play Billing
      // riconsegna un prodotto non consumato — non accredita due volte.
      const credited = credit(outcome.product.id, outcome.token);
      setMessage(credited
        ? `${outcome.product.name}: accreditato.`
        : 'Questo acquisto era già stato accreditato.');
    } finally {
      setBusy(null);
    }
  };

  return (
    <div className="h-full flex flex-col gap-2 min-h-0">
      <div className="shrink-0 panel px-3 py-2 flex items-center gap-3">
        <WalletBar wallet={profile.wallet} />
        <h1 className="flex-1 text-center font-display text-base font-bold tracking-wide uppercase">
          Negozio
        </h1>
        <button
          type="button" onClick={onClose} aria-label="Chiudi" data-testid="store-close"
          className="w-7 h-7 rounded-full border border-line grid place-items-center
            text-muted hover:text-ink hover:border-dim transition"
        >
          <X className="w-3.5 h-3.5" />
        </button>
      </div>

      {billing && !billing.real && (
        <div className="shrink-0">
          <Note tone="warn">
            Nessun negozio collegato: qui nel browser gli acquisti sono simulati e non viene
            addebitato niente. Su Android passano da Google Play.
          </Note>
        </div>
      )}

      <div className="flex-1 min-h-0 scroll-y grid grid-cols-3 gap-2 auto-rows-min pr-0.5">
        {items.map((p) => (
          <div
            key={p.id}
            data-testid={`product-${p.id}`}
            className={`panel px-2.5 py-2 flex flex-col ${p.featured ? 'border-primary/70' : ''}`}
          >
            <div className="flex items-baseline justify-between gap-1">
              <span className="font-sans text-2xs font-bold truncate">{p.name}</span>
              {p.featured && (
                <span className="font-mono text-[8px] text-primary border border-primary/50
                  rounded px-1 shrink-0">top</span>
              )}
            </div>
            <p className="font-mono text-[9px] text-dim leading-tight mt-0.5 h-[22px] overflow-hidden">
              {p.hint}
            </p>
            <div className="my-2 grid place-items-center">
              <RewardRow reward={p.grants} size="sm" />
            </div>
            <button
              type="button"
              disabled={!p.available || busy !== null}
              onClick={() => buy(p.id)}
              data-testid={`buy-${p.id}`}
              className="mt-auto w-full rounded bg-ink px-2 py-1.5 font-sans text-2xs font-semibold
                text-white disabled:opacity-40 hover:brightness-125 transition
                inline-flex items-center justify-center gap-1.5"
            >
              {busy === p.id
                ? <Loader2 className="w-3 h-3 animate-spin" />
                : <ShoppingBag className="w-3 h-3" />}
              {p.available ? p.storePrice : 'non disponibile'}
            </button>
          </div>
        ))}
      </div>

      {message && (
        <p className="shrink-0 font-mono text-2xs text-accent flex items-center gap-1.5">
          <AlertTriangle className="w-3 h-3" />{message}
        </p>
      )}
    </div>
  );
}
