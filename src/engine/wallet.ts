/**
 * Il portafoglio del giocatore, e perché non vive dentro la partita.
 *
 * Tre valute, e tutte e tre **sopravvivono alle carriere**. È un vincolo, non
 * una scelta di comodo: se compri venti gettoni con un euro e poi cominci una
 * scuderia nuova, quei gettoni devono esserci ancora. Metterli dentro `World`
 * — che è il salvataggio di *una* carriera — significherebbe cancellare con un
 * pulsante qualcosa che è stato pagato, ed è il modo più rapido di finire in
 * un negozio di applicazioni con una recensione da una stella e ragione.
 *
 * Quindi il profilo è un oggetto suo, in una chiave sua, con la sua
 * migrazione. La partita lo legge e lo scrive, ma non lo possiede.
 *
 * ## Le tre valute, e cosa comprano
 *
 * | | Come si guadagna | Dove si spende |
 * |---|---|---|
 * | **Crediti** (€) | accessi, obiettivi, fine stagione | cassa della scuderia |
 * | **Gettoni abilità** | obiettivi, titoli | punti sull'albero di un tuo pilota |
 * | **Gettoni ricerca** | accessi, obiettivi | settimane in meno su un progetto aperto |
 *
 * Tenerle separate serve: una sola valuta per tutto vuol dire che ogni scelta
 * si riduce a «quanto ne ho», e le tre cose che il giocatore decide — soldi,
 * piloti, macchina — tornerebbero a essere la stessa cosa.
 */

export type Currency = 'credits' | 'skill' | 'research';

export const CURRENCIES: readonly Currency[] = ['credits', 'skill', 'research'];

export interface Wallet {
  /** crediti, in euro: entrano nella cassa della scuderia */
  credits: number;
  /** gettoni abilità: un gettone, un punto sull'albero */
  skill: number;
  /** gettoni ricerca: tolgono settimane a un progetto in corso */
  research: number;
}

export const CURRENCY_LABEL: Record<Currency, { name: string; short: string; hint: string }> = {
  credits: {
    name: 'Crediti',
    short: '€',
    hint: 'Finanziano la scuderia: entrano direttamente in cassa.',
  },
  skill: {
    name: 'Gettoni abilità',
    short: 'AB',
    hint: 'Un gettone vale un punto sull’albero di un tuo pilota.',
  },
  research: {
    name: 'Gettoni ricerca',
    short: 'RIC',
    hint: 'Accorciano un progetto di reparto già aperto.',
  },
};

export function emptyWallet(): Wallet {
  return { credits: 0, skill: 0, research: 0 };
}

/**
 * Con cosa si comincia.
 *
 * Non zero. Un portafoglio vuoto alla prima apertura non insegna niente: il
 * giocatore non sa che le tre valute esistono, non sa a cosa servono, e la
 * prima volta che ne incontra una è dentro un negozio. Questi bastano per
 * usarne una di ciascuna e capire cosa fanno.
 */
export function startingWallet(): Wallet {
  return { credits: 8_000_000, skill: 3, research: 2 };
}

export function canAfford(wallet: Wallet, cost: Partial<Wallet>): boolean {
  return CURRENCIES.every((c) => wallet[c] >= (cost[c] ?? 0));
}

/** Toglie quanto indicato. Restituisce false — senza toccare niente — se non basta. */
export function spend(wallet: Wallet, cost: Partial<Wallet>): boolean {
  if (!canAfford(wallet, cost)) return false;
  for (const c of CURRENCIES) wallet[c] -= cost[c] ?? 0;
  return true;
}

export function grant(wallet: Wallet, amount: Partial<Wallet>): void {
  for (const c of CURRENCIES) wallet[c] += amount[c] ?? 0;
}

/** Una ricompensa da mostrare: le voci a zero non si disegnano. */
export function rewardEntries(amount: Partial<Wallet>): { currency: Currency; amount: number }[] {
  return CURRENCIES
    .filter((c) => (amount[c] ?? 0) > 0)
    .map((c) => ({ currency: c, amount: amount[c]! }));
}
