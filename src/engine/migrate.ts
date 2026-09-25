import type { World } from './types.js';
import { POTENTIAL_ANCHOR } from './market.js';
import { initialCash } from './regulations.js';
import { TEAM_SEEDS } from './data/teams.js';
import {
  buildCalendar, capacityOf, seasonStartDay, SEASON_WEEKS, type SeasonWeek,
} from './calendar.js';
import { createRng, hashSeed } from './rng.js';

/**
 * Salvataggi scritti da versioni precedenti.
 *
 * Il mondo è un oggetto che cresce a ogni funzione nuova: `offers` non
 * esisteva prima dei contratti, `talentAnchor` prima dell'anti-inflazione,
 * `short` sulle scuderie prima delle colonne strette. Un salvataggio vecchio
 * non li ha, e leggerli manda in crash l'app all'avvio — schermo nero, senza
 * un modo per uscirne.
 *
 * Qui i campi mancanti vengono riempiti con un valore sensato. Quando il
 * salvataggio è troppo rovinato per essere recuperato si restituisce `null`,
 * e l'app riparte dalla creazione di una carriera invece di rompersi.
 */
export function migrateWorld(raw: unknown): World | null {
  if (!raw || typeof raw !== 'object') return null;
  const w = raw as Partial<World> & Record<string, unknown>;

  // Senza questi non c'è un mondo da recuperare.
  if (!w.drivers || !w.teams || typeof w.year !== 'number' || !Array.isArray(w.schedule)) {
    return null;
  }

  // Il calendario ha cambiato forma due volte: prima era una lista di id di
  // circuito, poi quaranta settimane ancorate a febbraio, ora quarantaquattro
  // ancorate al calendario vero. In tutti e tre i casi si ricostruisce
  // mantenendo il numero di gare, e la settimana corrente si riporta in scala
  // sulla nuova lunghezza: il giocatore ritrova la stagione al punto in cui
  // l'aveva lasciata, anche se le date sotto sono cambiate.
  const schedule = w.schedule as unknown[];
  const first = schedule[0] as Partial<SeasonWeek> | string | null | undefined;
  const legacyList = schedule.length > 0 && (typeof first === 'string' || first === null);
  const staleShape = !legacyList && schedule.length > 0
    && (schedule.length !== SEASON_WEEKS
      || (first as Partial<SeasonWeek>)?.startDay !== seasonStartDay(w.year));

  if (legacyList || staleShape) {
    const races = legacyList
      ? schedule.filter((x) => typeof x === 'string').length || 20
      : schedule.filter((x) => (x as Partial<SeasonWeek>)?.trackId != null).length || 20;
    const progress = typeof w.week === 'number' ? w.week / Math.max(1, schedule.length) : 0;
    w.schedule = buildCalendar(w.year, races, createRng(hashSeed('calendario', w.seed ?? w.year)));
    w.week = Math.min(SEASON_WEEKS - 1, Math.round(progress * SEASON_WEEKS));
  }

  // La capienza di allenamento è diventata una proprietà della settimana
  // quando le pause hanno preso l'alternanza. Un salvataggio più vecchio non
  // ce l'ha: si ricalcola dal tipo e dalla posizione dentro il blocco di
  // pausa, senza rigenerare il calendario e perdere il punto della stagione.
  const schedule2 = w.schedule as SeasonWeek[];
  if (schedule2.some((week) => typeof week?.training !== 'number')) {
    let offset = 0;
    for (let i = 0; i < schedule2.length; i++) {
      const week = schedule2[i]!;
      offset = schedule2[i - 1]?.kind === week.kind ? offset + 1 : 0;
      week.training = capacityOf(week.kind, offset);
    }
  }

  if (typeof w.talentAnchor !== 'number') w.talentAnchor = POTENTIAL_ANCHOR;
  if (!Array.isArray(w.academy)) w.academy = [];
  if (!Array.isArray(w.results)) w.results = [];
  if (!Array.isArray(w.champions)) w.champions = [];
  if (!w.standings) w.standings = {};
  if (!w.constructorStandings) w.constructorStandings = {};
  if (w.lastMinigame === undefined) w.lastMinigame = null;
  if (typeof w.week !== 'number') w.week = 0;
  // Il tempo scorreva a settimane: un salvataggio vecchio riparte dal lunedì.
  if (typeof w.dayOfWeek !== 'number') w.dayOfWeek = 0;
  if (w.qualifyingPlan === undefined) w.qualifyingPlan = null;
  if (typeof w.round !== 'number') w.round = 0;
  if (!w.seat) w.seat = { mode: 'osservatore' };
  // C'era una Modalità Pilota, e i salvataggi che la usavano esistono ancora.
  //
  // Non si può proseguire quella carriera — la modalità non c'è più — ma si
  // può non buttare via il mondo: il giocatore prende in mano la scuderia del
  // pilota che guidava, con tutto quello che c'era attorno. Se era senza
  // sedile si riparte dalla creazione, che è l'unica cosa onesta da fare.
  const legacy = w.seat as { mode: string; driverId?: string };
  if (legacy.mode === 'pilota') {
    const teamId = legacy.driverId ? w.drivers[legacy.driverId]?.teamId : null;
    if (!teamId || !w.teams[teamId]) return null;
    w.seat = { mode: 'scuderia', teamId };
  }
  // Il mercato si faceva dal lato del pilota: le offerte in attesa non hanno
  // più un destinatario.
  delete (w as Record<string, unknown>).offers;
  if (!w.regulations) {
    w.regulations = { lastResetYear: w.year, nextResetYear: w.year + 5 };
  }

  for (const team of Object.values(w.teams)) {
    // La cassa e i progetti sono arrivati con lo sviluppo a reparti. Una
    // squadra senza cassa non potrebbe aprire un cantiere e resterebbe ferma
    // per sempre: si parte da quanto il suo prestigio giustifica.
    if (typeof team.cash !== 'number') team.cash = initialCash(team.prestige ?? 40);
    if (!Array.isArray(team.projects)) team.projects = [];
    // Sponsor e investitori sono arrivati dopo. Senza questi due campi la
    // schermata del bilancio legge `undefined` e non si apre più.
    if (team.sponsor === undefined) team.sponsor = null;
    if (team.investor === undefined) team.investor = null;
    delete (team as unknown as Record<string, unknown>).futureFocus;

    // `short` è arrivato dopo: senza, le colonne strette mostrano "undefined".
    if (!team.short) {
      const seed = TEAM_SEEDS.find((t) => t.id === team.id);
      team.short = seed?.short ?? team.name.replace(/^Scuderia\s+/i, '').split(' ')[0] ?? team.name;
    }
  }

  for (const driver of Object.values(w.drivers)) {
    if (!Array.isArray(driver.staff)) driver.staff = [];
    if (!Array.isArray(driver.history)) driver.history = [];
    if (typeof driver.money !== 'number') driver.money = 0;
    // Arrivati con il modello di progressione: stanchezza e esperienza.
    if (typeof driver.fatigue !== 'number') driver.fatigue = 0;
    // L'albero delle abilità è arrivato dopo: un pilota già in carriera
    // riceve i punti che avrebbe accumulato, non un albero vuoto.
    if (!Array.isArray(driver.perks)) driver.perks = [];
    if (typeof driver.skillPoints !== 'number') {
      driver.skillPoints = Math.floor((driver.career?.starts ?? 0) / 5)
        + (driver.career?.podiums ?? 0) + (driver.career?.wins ?? 0) * 2;
    }
    // La crescita mostrata nel profilo ha bisogno di un punto di partenza.
    // Un salvataggio vecchio non ce l'ha: si parte da dove il pilota è
    // adesso, così la prima stagione dopo l'aggiornamento mostra zero invece
    // di un guadagno inventato.
    if (!driver.seasonStartAttrs) driver.seasonStartAttrs = { ...driver.attrs };
    // Stesso discorso per le stagioni già archiviate: l'overall di allora non
    // è ricostruibile, e zero sarebbe un grafico che crolla. Si omette il
    // punto, e la curva parte da quando il dato esiste.
    for (const season of driver.history) {
      if (typeof season.overall !== 'number') season.overall = 0;
    }
    if (typeof driver.experience !== 'number') {
      // Si stima dalle gare già disputate, così un veterano non riparte da
      // zero: l'esperienza è ciò che lo tiene competitivo.
      driver.experience = Math.min(1000, (driver.career?.starts ?? 0) * 4);
    }
  }

  return w as World;
}
