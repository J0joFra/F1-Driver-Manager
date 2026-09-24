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
 * Si misurano con lo stesso metodo dei dati veri — coorte fissa di piloti con
 * almeno otto stagioni — ma su una coorte che nel gioco è **più selezionata**
 * di quella reale: arrivano a otto stagioni i piloti che il mercato ha tenuto
 * in griglia, cioè i migliori. Partono quindi più in alto della coorte vera
 * (0.47 contro 0.634) e non calano alla fine, perché a otto stagioni dal
 * debutto hanno ventisette anni e sono nel loro momento migliore, mentre la
 * coorte vera contiene anche chi ha debuttato a trenta.
 *
 * Quello che deve combaciare è la **forma**, e in particolare due fatti che
 * nei dati veri sono i più netti:
 *
 * 1. il gradino più grande di una carriera è sempre il primo;
 * 2. dopo, migliorare è poco più di una monetina, perché il risultato in
 *    pista lo decide soprattutto la macchina.
 */
export const CAREER_BOUNDS = {
  /**
   * Quanto vale il primo gradino, in percentile.
   *
   * Il numero è basso perché la coorte del gioco parte già a metà griglia:
   * non c'è lo spazio di recupero che ha un esordiente vero, che parte
   * dietro. Il vincolo che conta davvero non è questa soglia ma il fatto che
   * il primo gradino sia il più grande di tutti, e quello lo verifica
   * `check:career` confrontandolo con gli altri.
   */
  minFirstStep: 0.08,
  /** Quanto overall guadagna, come minimo, in otto stagioni. */
  minOverallGain: 4,
  /** Quante volte si migliora, in media, da una stagione all'altra. */
  improvementRate: [0.45, 0.82],
} as const;
