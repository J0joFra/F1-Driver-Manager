import type { CarRating, Team } from './types.js';
import { CAR_KEYS } from './types.js';
import { clamp } from './rng.js';

/**
 * Le fasce delle monoposto.
 *
 * ## Perché una fascia e non un numero per squadra
 *
 * Prima ogni scuderia aveva i suoi quattro valori, scritti a mano nel seme e
 * poi liberi di andare dove lo sviluppo li portava. Funzionava, ma rispondeva
 * alla domanda sbagliata: la differenza fra due scuderie era **la macchina**,
 * e il pilota era una correzione di contorno.
 *
 * Qui la macchina è una proprietà della fascia. Due squadre in fascia B hanno
 * la stessa monoposto, e quello che le separa in pista sono i piloti — con i
 * loro allenamenti — e lo staff tecnico che le segue. La macchina decide in
 * che campionato corri; il resto decide dove arrivi dentro quel campionato.
 *
 * ## La banda
 *
 * «Stessa monoposto» non vuol dire «sviluppo inutile»: dentro la fascia una
 * squadra può staccarsi di `DEV_BAND` punti per reparto, in più o in meno. È
 * poco — due punti valgono poco più di un decimo al giro — ma è abbastanza
 * perché valga la pena scegliere *dove* svilupparsi, e soprattutto è la
 * misura che decide se a fine anno si sale di fascia.
 *
 * Il prodotto che conta è sempre quello: undici punti fra la fascia A e la D,
 * per `CAR_PACE_PER_POINT`, fanno circa sei decimi al giro fra la prima e
 * l'ultima monoposto. È la stessa larghezza di griglia di prima, ridisegnata
 * a scalini invece che a pendenza continua.
 */

export type Tier = 'A' | 'B' | 'C' | 'D';

export const TIERS: readonly Tier[] = ['A', 'B', 'C', 'D'];

/**
 * Il blocco di valori di ogni fascia.
 *
 * I quattro reparti non sono identici fra loro nemmeno dentro una fascia:
 * l'affidabilità resta un po' più alta del passo puro perché una monoposto che
 * si rompe una gara su tre non è una monoposto, è un aneddoto. Ma due squadre
 * della stessa fascia hanno gli stessi identici quattro numeri.
 */
export const TIER_CAR: Record<Tier, CarRating> = {
  A: { aero: 90, engine: 90, chassis: 89, reliability: 89 },
  B: { aero: 86, engine: 86, chassis: 86, reliability: 87 },
  C: { aero: 83, engine: 83, chassis: 82, reliability: 84 },
  D: { aero: 80, engine: 80, chassis: 79, reliability: 82 },
};

/** Quanto lo sviluppo può staccare una monoposto dal blocco della sua fascia. */
export const DEV_BAND = 2;

export function tierCar(tier: Tier): CarRating {
  return { ...TIER_CAR[tier] };
}

export function tierFloor(tier: Tier, area: keyof CarRating): number {
  return TIER_CAR[tier][area] - DEV_BAND;
}

export function tierCeiling(tier: Tier, area: keyof CarRating): number {
  return TIER_CAR[tier][area] + DEV_BAND;
}

/**
 * Riporta la monoposto dentro la banda della sua fascia.
 *
 * Si chiama ovunque lo sviluppo tocchi i valori: è il muro che rende la fascia
 * una fascia invece di un suggerimento. Senza, un progetto maggiore riuscito
 * bene porterebbe una squadra di fascia C dentro i valori della A senza che
 * nessuno l'abbia promossa.
 */
export function clampToTier(car: CarRating, tier: Tier): CarRating {
  const out = { ...car };
  for (const k of CAR_KEYS) {
    out[k] = clamp(out[k], tierFloor(tier, k), tierCeiling(tier, k));
  }
  return out;
}

/**
 * Dove sta la monoposto dentro la sua banda: −1 in fondo, +1 in cima.
 *
 * È il numero che si mostra come barra di avanzamento, ed è lo stesso che a
 * fine stagione decide la promozione. Una cosa sola, non due: quello che il
 * giocatore guarda crescere è letteralmente la condizione per salire.
 */
export function tierProgress(team: Team): number {
  const sum = CAR_KEYS.reduce((s, k) => s + (team.car[k] - TIER_CAR[team.tier][k]), 0);
  return clamp(sum / (CAR_KEYS.length * DEV_BAND), -1, 1);
}

/**
 * Quanto è piena la banda, 0–1, per la barra nell'interfaccia.
 *
 * Non è «quanto manca alla promozione», perché la promozione è un sorpasso e
 * non una soglia: è quanto hai costruito, e se basta lo dice chi hai davanti.
 */
export function promotionProgress(team: Team): number {
  return clamp((tierProgress(team) + 1) / 2, 0, 1);
}

export function tierUp(tier: Tier): Tier {
  const i = TIERS.indexOf(tier);
  return TIERS[Math.max(0, i - 1)]!;
}

export function tierDown(tier: Tier): Tier {
  const i = TIERS.indexOf(tier);
  return TIERS[Math.min(TIERS.length - 1, i + 1)]!;
}

/**
 * Quante scuderie stanno in ogni fascia. Le quote non cambiano mai.
 *
 * ## Perché a quote fisse e non a soglia
 *
 * Il primo tentativo promuoveva chiunque riempisse la propria banda e
 * retrocedeva chiunque la lasciasse scivolare. Misurato: **cinquantanove
 * scuderie su sessanta finivano in fascia A in dodici stagioni**. Ovvio, col
 * senno di poi — tutte sviluppano, quindi tutte riempiono, quindi tutte
 * salgono, e la retrocessione non scattava mai perché richiedeva di peggiorare
 * la macchina sul serio. Era la vecchia inflazione dei rating, tornata sotto
 * forma di etichette.
 *
 * Con le quote fisse salire costa a qualcun altro il posto. Non è una soglia
 * da superare: è un sorpasso. Ed è anche quello che succede in Formula 1, dove
 * «scuderia di vertice» non è un titolo che si conquista ma un posto che si
 * toglie a qualcuno.
 */
export const TIER_QUOTA: Record<Tier, number> = { A: 2, B: 3, C: 3, D: 3 };

export interface TierMove {
  teamId: string;
  from: Tier;
  to: Tier;
}

interface Contender {
  id: string;
  tier: Tier;
  fill: number;
}

/**
 * Il passaggio di fascia, a fine stagione: uno scambio per confine.
 *
 * Su ogni confine fra due fasce si confronta chi ha riempito di più la banda
 * nella fascia di sotto con chi l'ha riempita di meno in quella di sopra. Se
 * lo sfidante ha fatto meglio, si scambiano. Al massimo tre scambi a stagione,
 * e le quote restano quelle per sempre.
 *
 * Il margine serve a non far rimbalzare le stesse due squadre ogni anno su una
 * differenza di nulla: per scambiarsi bisogna aver fatto **sensibilmente**
 * meglio, non appena meglio.
 */
export const SWAP_MARGIN = 0.3;

export function reviewTiers(teams: readonly Team[]): TierMove[] {
  const by = (tier: Tier): Contender[] => teams
    .filter((t) => t.tier === tier)
    .map((t) => ({ id: t.id, tier, fill: tierProgress(t) }))
    .sort((a, b) => b.fill - a.fill);

  const moves: TierMove[] = [];
  for (let i = 0; i < TIERS.length - 1; i++) {
    const upper = TIERS[i]!;
    const lower = TIERS[i + 1]!;
    const challenger = by(lower)[0];
    const incumbent = by(upper).at(-1);
    if (!challenger || !incumbent) continue;
    if (challenger.fill < incumbent.fill + SWAP_MARGIN) continue;
    moves.push({ teamId: challenger.id, from: lower, to: upper });
    moves.push({ teamId: incumbent.id, from: upper, to: lower });
  }
  return moves;
}

/**
 * Applica il passaggio, riscrivendo i valori ai bordi della fascia nuova.
 *
 * Il salto **non** è un salto nei numeri. Chi sale arriva vicino al fondo della
 * fascia di sopra, chi scende vicino alla cima di quella di sotto: una
 * scuderia di fascia C col massimo sviluppo vale 84,7 di passo e da promossa in
 * B ne vale 85,0. Quello che cambia di colpo è l'etichetta e la banda in cui
 * d'ora in poi si lavora. Se la promozione regalasse anche tre punti di passo,
 * salire di fascia sarebbe l'unico obiettivo del gioco e tutto il resto
 * diventerebbe attesa.
 *
 * Il mezzo punto di margine non è arrotondamento: con l'atterraggio esatto sul
 * bordo della banda la promozione faceva **perdere** due decimi di passo — il
 * tetto della fascia sotto sta più in alto del pavimento di quella sopra — e
 * una ricompensa che peggiora la macchina è un bug, non una scelta di
 * bilanciamento. Un test lo sorveglia.
 *
 * C'è anche una conseguenza voluta: chi sale è il più debole della fascia
 * nuova, quindi il candidato naturale alla retrocessione dell'anno dopo. La
 * gerarchia non si congela da sola.
 */
export function moveToTier(team: Team, tier: Tier): void {
  const promotion = TIERS.indexOf(tier) < TIERS.indexOf(team.tier);
  team.tier = tier;
  for (const k of CAR_KEYS) {
    team.car[k] = promotion ? tierFloor(tier, k) + 1 : tierCeiling(tier, k) - 1;
  }
}

/**
 * Il rimescolamento da cambio di regolamento: le fasce si ridistribuiscono.
 *
 * Il primo tentativo faceva salire o scendere ogni scuderia per conto suo, con
 * un tiro di dadi a testa. Risultato misurato: le quote si sfaldavano — dopo
 * dodici stagioni e sei mondi la fascia A ne conteneva ventiquattro invece di
 * dodici, e la D cinque invece di diciotto. Un regolamento nuovo non crea
 * scuderie di vertice dal nulla: **rimescola chi occupa quei posti**.
 *
 * Quindi si tiene l'insieme delle fasce che c'è — qualunque sia — e lo si
 * riassegna in base a un punteggio: metà quanto hai lavorato, metà sorte. Chi
 * arriva al cambio con la banda piena ha molte più probabilità di salire di chi
 * ci arriva fermo, ma nessuno è al sicuro: è questo che rende l'azzeramento
 * un'occasione per chi insegue e una minaccia per chi comanda.
 */
export function reshuffleTiers(
  teams: readonly Team[],
  roll: (team: Team) => number,
): TierMove[] {
  // Le fasce disponibili sono esattamente quelle in uso: nessuna nasce, nessuna
  // sparisce.
  const slots = teams.map((t) => t.tier).sort((a, b) => TIERS.indexOf(a) - TIERS.indexOf(b));
  const ranked = [...teams]
    .map((t) => ({ team: t, score: tierProgress(t) * 0.9 + roll(t) }))
    .sort((a, b) => b.score - a.score);

  const moves: TierMove[] = [];
  ranked.forEach((entry, i) => {
    const to = slots[i]!;
    if (to !== entry.team.tier) moves.push({ teamId: entry.team.id, from: entry.team.tier, to });
  });
  return moves;
}

/**
 * Il riassorbimento di fine stagione: la banda si svuota a metà.
 *
 * Senza, la banda si riempie e resta piena per sempre. Misurato: dalla seconda
 * stagione in poi **tutte e dieci le scuderie** stavano a banda 1,00, il
 * confronto per la promozione era fra numeri identici e la scala delle fasce si
 * bloccava a 0,06 scambi a stagione. Un vantaggio tecnico conquistato una volta
 * non vale per sempre: gli altri copiano, il regolamento si stringe, e quello
 * che l'anno scorso era un'ala speciale quest'anno ce l'hanno tutti.
 *
 * Quindi a fine anno si torna a metà strada verso il blocco della fascia. Chi
 * vuole stare in cima alla banda deve ricostruirsi il vantaggio ogni stagione,
 * ed è esattamente la domanda che deve tenere aperto il cantiere.
 */
export const BAND_DECAY = 0.5;

export function decayBand(team: Team): void {
  for (const k of CAR_KEYS) {
    const offset = team.car[k] - TIER_CAR[team.tier][k];
    team.car[k] = TIER_CAR[team.tier][k] + offset * BAND_DECAY;
  }
}
