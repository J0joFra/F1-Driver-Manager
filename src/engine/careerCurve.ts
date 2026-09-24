/**
 * La forma di una carriera, misurata sui campionati veri.
 *
 * Il gioco aveva un difetto preciso: chi iniziava la carriera restava in coda
 * per sempre. Allenarsi non si vedeva, correre non si vedeva, e in otto
 * stagioni un pilota realizzava due punti dei dodici che aveva di margine.
 * Per correggerlo serviva sapere che forma ha davvero una carriera, e quella
 * non si indovina: si misura.
 *
 * ## Da dove vengono questi numeri
 *
 * Dallo storico dei campionati del mondo conservato su Supabase (progetto
 * `dati-json`, tabella `season_driver_standing`, 1681 righe). La misura è il
 * **percentile in classifica**: 0 = campione, 1 = ultimo. È l'unica grandezza
 * confrontabile fra un mondiale a 13 piloti e uno a 26.
 *
 * Contare tutti i piloti non serviva: la curva che ne esce (0.712 al primo
 * anno, 0.406 all'ottavo) mescola la crescita vera con il fatto che chi va
 * male smette — 388 esordienti diventano 30 veterani, e la media migliora da
 * sola perché i peggiori escono dal conto. La coorte qui sotto è invece
 * **fissa**: i 73 piloti che hanno corso almeno otto stagioni, seguiti uno per
 * uno. Quello che resta è crescita, non sopravvivenza.
 */

/**
 * Percentile medio in classifica, per stagione di carriera.
 *
 * Coorte fissa di 73 piloti con almeno otto stagioni. σ ≈ 0.24 in ogni
 * stagione: la varianza fra piloti è enorme, ed è il motivo per cui la
 * posizione non va garantita al giocatore. Il picco è alla sesta stagione;
 * la risalita finale è l'età, non un errore.
 */
export const CAREER_PERCENTILE = [
  0.634, 0.431, 0.404, 0.349, 0.344, 0.311, 0.365, 0.415,
] as const;

/**
 * Quanto spesso un pilota migliora davvero da una stagione all'altra.
 *
 * Solo il primo passo è affidabile: il 63% dei piloti fa meglio al secondo
 * anno che al primo. Dopo si oscilla attorno al 52%, cioè poco più di una
 * monetina, perché il risultato in pista lo decide soprattutto la macchina.
 *
 * Da qui la regola di progetto del gioco: **l'abilità cresce in modo
 * affidabile e visibile, la posizione no**. Il pilota deve vedersi migliorare
 * — attributi, offerte, prestigio della squadra — anche in un anno in cui la
 * classifica gli va peggio. Garantire la classifica sarebbe irreale; non
 * garantire niente è il difetto da cui siamo partiti.
 */
export const IMPROVEMENT_RATE = [0.63, 0.51, 0.52, 0.54, 0.53, 0.35] as const;

/**
 * I limiti entro cui deve stare una carriera simulata.
 *
 * Non sono i numeri veri copiati: due differenze sono volute e vanno
 * spiegate, perché senza spiegazione sembrerebbero errori.
 *
 * 1. **La prima stagione è più dura del vero** (il gioco sta sopra 0.75, la
 *    realtà a 0.634). Una carriera comincia sempre sul sedile della scuderia
 *    meno prestigiosa; la coorte vera contiene esordienti entrati ovunque,
 *    anche in macchine da podio.
 * 2. **Le ultime stagioni sono migliori del vero** (il gioco sotto 0.40, la
 *    realtà risale a 0.415). Alla ottava stagione il pilota del gioco ha 26
 *    anni ed è nel suo momento migliore; la coorte vera a quel punto contiene
 *    anche chi ha debuttato a trent'anni ed è già in calo.
 *
 * Quello che deve combaciare è la **forma**: partenza netta, gradino grande
 * fra la prima e la seconda stagione, miglioramento che continua ma rallenta.
 */
export const CAREER_BOUNDS = {
  /** Il primo anno è duro, ma non è un anno perso. */
  season1: [0.72, 0.95],
  /** All'ottava stagione il pilota è nella metà alta, senza essere garantito campione. */
  season8: [0.12, 0.42],
  /** Il gradino più grande è sempre il primo. */
  minFirstStep: 0.18,
  /** Quanto overall guadagna dalla partenza all'ottava stagione, come minimo. */
  minOverallGain: 12,
  /** Quante volte si migliora, in media, da una stagione all'altra. */
  improvementRate: [0.45, 0.82],
  /**
   * Quanto spesso si chiude negli ultimi due posti, dalla seconda stagione in
   * poi. È la misura del difetto originale: «finisce sempre ultimo».
   */
  maxTailRate: 0.08,
} as const;
