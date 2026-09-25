import { PRODUCTS, type Product } from '../engine/store.js';

/**
 * La porta verso il negozio, e perché è una porta.
 *
 * Il motore non sa che esistono i pagamenti, e non deve saperlo: è codice puro
 * che gira anche nel simulatore da riga di comando. Qui c'è l'unico punto in
 * cui il gioco parla con Google Play, dietro un'interfaccia che ha due
 * implementazioni — quella vera su Android e una finta sul web, così
 * `npm run dev` continua a funzionare senza un telefono collegato.
 *
 * ## Come si collega quella vera
 *
 * Il gioco è una pagina web impacchettata con Capacitor. Il pagamento passa da
 * **Google Play Billing**, a cui si arriva con un plugin. Due strade:
 *
 * - `@revenuecat/purchases-capacitor` — un servizio esterno che verifica le
 *   ricevute per conto tuo e tiene il conto di chi ha comprato cosa. È la via
 *   ragionevole se non hai un server, ed è gratis fino a una certa soglia di
 *   incasso.
 * - `@capacitor-community/in-app-purchases` — parla direttamente con Play
 *   Billing. Nessun terzo in mezzo, ma la verifica della ricevuta la devi
 *   fare tu, e senza un server non la puoi fare davvero.
 *
 * In entrambi i casi l'implementazione va scritta in `billing.native.ts` e
 * scelta da `createBilling()` qui sotto. Il resto del gioco non cambia di una
 * riga, perché parla solo con questa interfaccia.
 *
 * ## La verifica, detta come sta
 *
 * Questo gioco tiene il portafoglio in `localStorage`, sul dispositivo. Vuol
 * dire che **chi vuole barare bara**, con o senza acquisti: basta aprire gli
 * strumenti da sviluppatore e cambiare un numero. Per un gioco per una persona
 * sola non è un disastro — non c'è nessun altro a cui rovinare la partita — ma
 * va detto invece che far finta di niente:
 *
 * - senza server, un acquisto è «verificato» solo nel senso che il negozio ha
 *   risposto di sì su quel dispositivo;
 * - se un giorno ci saranno classifiche online o profili sincronizzati, la
 *   verifica dovrà spostarsi su un server, con l'API *Google Play Developer*
 *   (`purchases.products.get`) o con RevenueCat che la fa al posto tuo.
 *
 * ## Consumabili e non
 *
 * Un pacchetto di gettoni è **consumabile**: va «consumato» dopo averlo
 * accreditato, altrimenti Google lo considera ancora posseduto e il giocatore
 * non può ricomprarlo. È l'errore più comune di chi integra Play Billing la
 * prima volta, e si manifesta come «ho pagato e non me lo fa ricomprare».
 */

export interface StoreProduct extends Product {
  /** il prezzo vero, come lo scrive il negozio nella valuta del giocatore */
  storePrice: string;
  available: boolean;
}

export type PurchaseOutcome =
  | { status: 'ok'; product: Product; token: string }
  | { status: 'annullato' }
  | { status: 'errore'; message: string };

export interface Billing {
  /** true quando dietro c'è un negozio vero */
  readonly real: boolean;
  /** Prezzi e disponibilità, chiesti al negozio. */
  products(): Promise<StoreProduct[]>;
  /** Avvia l'acquisto e aspetta l'esito. */
  buy(productId: string): Promise<PurchaseOutcome>;
  /**
   * Riporta indietro gli acquisti non consumabili.
   *
   * Google lo pretende: deve esistere un modo di ritrovare quello che si è
   * comprato dopo aver cambiato telefono o reinstallato.
   */
  restore(): Promise<string[]>;
}

/**
 * Il negozio finto del web.
 *
 * Non finge di aver incassato: dichiara `real: false`, e l'interfaccia lo
 * scrive al giocatore. Serve a provare il flusso — accredito, doppio
 * accredito, annullamento — senza un telefono e senza spendere.
 */
class WebBilling implements Billing {
  readonly real = false;

  async products(): Promise<StoreProduct[]> {
    return PRODUCTS.map((p) => ({ ...p, storePrice: p.price, available: true }));
  }

  async buy(productId: string): Promise<PurchaseOutcome> {
    const product = PRODUCTS.find((p) => p.id === productId);
    if (!product) return { status: 'errore', message: 'Prodotto sconosciuto' };
    // Un token diverso a ogni acquisto, come farebbe il negozio vero: è quello
    // che permette di provare la difesa contro il doppio accredito.
    return { status: 'ok', product, token: `web-${productId}-${Date.now()}` };
  }

  async restore(): Promise<string[]> {
    return [];
  }
}

/**
 * Sceglie l'implementazione.
 *
 * Il caricamento di quella nativa è dinamico di proposito: `billing.native.ts`
 * importa il plugin di Capacitor, che sul web non esiste. Un `import` normale
 * romperebbe la build della pagina.
 */
export async function createBilling(): Promise<Billing> {
  const native = typeof window !== 'undefined'
    && (window as { Capacitor?: { isNativePlatform?: () => boolean } }).Capacitor
      ?.isNativePlatform?.();
  if (!native) return new WebBilling();

  try {
    const mod = await import(/* @vite-ignore */ './billing.native.js');
    return await (mod as { createNativeBilling: () => Promise<Billing> }).createNativeBilling();
  } catch {
    // Meglio un negozio che dice «non disponibile» di una schermata bianca.
    return new WebBilling();
  }
}
