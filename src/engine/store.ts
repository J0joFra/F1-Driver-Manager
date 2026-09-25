import type { Wallet } from './wallet.js';

/**
 * Il catalogo dei prodotti acquistabili.
 *
 * Sta nel motore e non nell'interfaccia perché è **dati di gioco**: quanto
 * vale un euro in gettoni è una decisione di bilanciamento, e va letta
 * accanto a quello che i gettoni fanno, non dentro un componente React.
 *
 * ## Gli `id` devono combaciare con la Play Console
 *
 * Ogni `id` qui sotto è lo stesso identificatore che va creato in Google Play
 * Console sotto *Monetizza → Prodotti in-app*. Se non combaciano, l'acquisto
 * parte e il gioco non accredita niente — che è il difetto peggiore possibile,
 * perché il giocatore ha pagato. `catalogProblems` verifica che siano tutti
 * minuscoli, senza spazi e senza duplicati come pretende Google, e un test lo
 * esegue a ogni `npm test`.
 *
 * ## I prezzi qui sono indicativi
 *
 * Il prezzo vero lo fissa la Play Console, per paese e valuta, e arriva dal
 * negozio a runtime: `price` serve solo a mostrare qualcosa mentre il negozio
 * non ha ancora risposto, e va sostituito da quello che risponde. Mostrare un
 * prezzo diverso da quello che viene addebitato è, oltre che scorretto,
 * vietato dalle regole di Google.
 */

export type ProductKind = 'consumable' | 'nonConsumable';

export interface Product {
  /** l'id della Play Console: minuscolo, senza spazi */
  id: string;
  kind: ProductKind;
  name: string;
  hint: string;
  /** cosa accredita al portafoglio */
  grants: Partial<Wallet>;
  /** prezzo indicativo, sostituito da quello vero del negozio */
  price: string;
  /** il taglio consigliato, evidenziato una volta sola nell'elenco */
  featured?: boolean;
}

export const PRODUCTS: readonly Product[] = [
  {
    id: 'tokens_20', kind: 'consumable',
    name: '20 gettoni ricerca',
    hint: 'Quaranta settimane di lavoro in meno, distribuite come vuoi.',
    grants: { research: 20 }, price: '0,99 €',
  },
  {
    id: 'tokens_60', kind: 'consumable',
    name: '60 gettoni ricerca',
    hint: 'Tre volte il primo taglio, al prezzo di due e mezzo.',
    grants: { research: 60 }, price: '2,49 €', featured: true,
  },
  {
    id: 'skill_10', kind: 'consumable',
    name: '10 gettoni abilità',
    hint: 'Dieci punti sull’albero, da dare al pilota che vuoi.',
    grants: { skill: 10 }, price: '1,99 €',
  },
  {
    id: 'credits_100m', kind: 'consumable',
    name: '100 milioni di crediti',
    hint: 'Due stagioni di sviluppo pagate in anticipo.',
    grants: { credits: 100_000_000 }, price: '3,99 €',
  },
  {
    id: 'bundle_start', kind: 'consumable',
    name: 'Pacchetto fondatore',
    hint: 'Crediti, gettoni e ricerca per far partire una scuderia nuova.',
    grants: { credits: 60_000_000, skill: 8, research: 25 }, price: '4,99 €',
  },
  {
    id: 'no_ads', kind: 'nonConsumable',
    name: 'Sostieni lo sviluppo',
    hint: 'Una volta sola. Non sblocca niente: il gioco è già tutto qui.',
    grants: { credits: 25_000_000, skill: 5, research: 10 }, price: '5,99 €',
  },
];

export function productById(id: string): Product | undefined {
  return PRODUCTS.find((p) => p.id === id);
}

/**
 * Cosa non va nel catalogo. Vuoto se è a posto.
 *
 * Gli identificatori di Google accettano solo minuscole, cifre, punti e
 * trattini bassi, devono cominciare con una lettera e non si possono
 * riutilizzare nemmeno dopo averli cancellati. Sbagliarli si scopre a
 * pubblicazione fatta, quindi si controllano qui.
 */
export function catalogProblems(products: readonly Product[] = PRODUCTS): string[] {
  const problems: string[] = [];
  const seen = new Set<string>();
  for (const p of products) {
    if (!/^[a-z][a-z0-9_.]*$/.test(p.id)) {
      problems.push(`${p.id}: Google accetta solo minuscole, cifre, punti e trattini bassi`);
    }
    if (seen.has(p.id)) problems.push(`${p.id}: id duplicato`);
    seen.add(p.id);
    const total = (p.grants.credits ?? 0) + (p.grants.skill ?? 0) + (p.grants.research ?? 0);
    if (total <= 0) problems.push(`${p.id}: non accredita niente`);
  }
  return problems;
}
