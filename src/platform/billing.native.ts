import { PRODUCTS } from '../engine/store.js';
import type { Billing, PurchaseOutcome, StoreProduct } from './billing.js';

/**
 * Il negozio vero, su Android.
 *
 * Questo file è **già collegato ma non ancora acceso**: il plugin viene
 * caricato per nome a runtime, quindi il progetto compila e la pagina web si
 * costruisce anche senza averlo installato. Il giorno in cui si pubblica basta
 *
 *     npm install @capacitor-community/in-app-purchases
 *     npx cap sync android
 *
 * e questo codice comincia a funzionare, senza toccare nient'altro nel gioco.
 *
 * Ho scelto il caricamento dinamico invece di un `import` normale per una
 * ragione pratica: con l'import normale la build del sito fallisce finché il
 * pacchetto non c'è, e il gioco resterebbe ingiocabile nel browser per un
 * pezzo che serve solo su telefono.
 *
 * ## Cosa fa Play Billing, nell'ordine
 *
 * 1. **Connette**: apre il canale col Play Store. Se l'app non è installata
 *    dal Play Store — per esempio l'hai messa a mano con `adb` — fallisce, ed
 *    è normale.
 * 2. **Chiede i prodotti**: prezzi e valuta del paese del giocatore. Sono
 *    questi che vanno mostrati, non quelli scritti nel catalogo.
 * 3. **Acquista**: apre la finestra di Google. L'esito arriva in modo
 *    asincrono, e può arrivare anche a app riaperta.
 * 4. **Consuma**: accredita e poi dice a Google che il prodotto è stato
 *    consegnato. Senza questo passo il giocatore non può ricomprarlo, e senza
 *    l'accredito prima del consumo si rischia di consumare qualcosa che il
 *    gioco non ha ancora registrato.
 *
 * L'ordine del punto 4 è l'unica cosa davvero delicata: **prima si accredita
 * il portafoglio e lo si salva, poi si consuma**. Se l'app muore in mezzo, al
 * riavvio l'acquisto risulta ancora posseduto e si può accreditare di nuovo —
 * e il controllo sui token già visti impedisce il doppio accredito.
 */

/** La parte del plugin che usiamo, dichiarata qui per non dipenderne a compile-time. */
interface PurchasesPlugin {
  connect?(): Promise<void>;
  getProducts(opts: { productIdentifiers: string[] }): Promise<{
    products: { identifier: string; priceString?: string; price?: number }[];
  }>;
  purchaseProduct(opts: { productIdentifier: string }): Promise<{
    transaction?: { transactionId?: string; purchaseToken?: string };
    userCancelled?: boolean;
  }>;
  finishTransaction?(opts: { transactionId: string }): Promise<void>;
  restorePurchases?(): Promise<{ transactions: { productIdentifier: string }[] }>;
}

const PLUGIN = '@capacitor-community/in-app-purchases';

class PlayBilling implements Billing {
  readonly real = true;

  constructor(private readonly plugin: PurchasesPlugin) {}

  async products(): Promise<StoreProduct[]> {
    const ids = PRODUCTS.map((p) => p.id);
    try {
      const res = await this.plugin.getProducts({ productIdentifiers: ids });
      const byId = new Map(res.products.map((p) => [p.identifier, p]));
      return PRODUCTS.map((p) => {
        const live = byId.get(p.id);
        return {
          ...p,
          // Il prezzo del negozio ha la precedenza sempre: mostrarne un altro
          // è vietato dalle regole di Google, oltre che scorretto.
          storePrice: live?.priceString ?? p.price,
          available: !!live,
        };
      });
    } catch {
      return PRODUCTS.map((p) => ({ ...p, storePrice: p.price, available: false }));
    }
  }

  async buy(productId: string): Promise<PurchaseOutcome> {
    const product = PRODUCTS.find((p) => p.id === productId);
    if (!product) return { status: 'errore', message: 'Prodotto sconosciuto' };

    try {
      const res = await this.plugin.purchaseProduct({ productIdentifier: productId });
      if (res.userCancelled) return { status: 'annullato' };

      const token = res.transaction?.purchaseToken ?? res.transaction?.transactionId;
      if (!token) return { status: 'errore', message: 'Il negozio non ha restituito una ricevuta' };

      return { status: 'ok', product, token };
    } catch (e) {
      return { status: 'errore', message: e instanceof Error ? e.message : 'Acquisto non riuscito' };
    }
  }

  /**
   * Chiude la transazione. Va chiamata **dopo** che il portafoglio è stato
   * accreditato e salvato, mai prima.
   */
  async finish(transactionId: string): Promise<void> {
    await this.plugin.finishTransaction?.({ transactionId });
  }

  async restore(): Promise<string[]> {
    try {
      const res = await this.plugin.restorePurchases?.();
      return res?.transactions.map((t) => t.productIdentifier) ?? [];
    } catch {
      return [];
    }
  }
}

export async function createNativeBilling(): Promise<Billing> {
  const mod = await import(/* @vite-ignore */ PLUGIN) as { InAppPurchases: PurchasesPlugin };
  const plugin = mod.InAppPurchases;
  await plugin.connect?.();
  return new PlayBilling(plugin);
}
