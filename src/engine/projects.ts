import type { CarKey, Project, ProjectSize, Team, World } from './types.js';
import { CAR_KEYS } from './types.js';
import { clamp, type Rng } from './rng.js';
import { carPace } from './regulations.js';

/**
 * Lo sviluppo della monoposto, a progetti di reparto.
 *
 * È il cuore del gestionale, e sostituisce lo sviluppo automatico di fine
 * stagione che il gioco aveva prima. Quello era un numero che arrivava a
 * dicembre: nessuna decisione, nessun rischio, nessun modo di sbagliare. Qui
 * la macchina cresce perché qualcuno ha deciso di spendere, su quale reparto,
 * e ha aspettato.
 *
 * ## Tre vincoli, e la decisione sta dove si incrociano
 *
 * 1. **Un reparto alla volta.** Aerodinamica, motore, telaio e affidabilità
 *    lavorano in parallelo, ma ciascuno su un progetto solo: aprire il secondo
 *    significa chiudere il primo, e quello che era a metà è perso.
 * 2. **Le settimane.** Un progetto grande occupa il reparto per mezza
 *    stagione. Deciderlo a marzo vuol dire vederlo in pista ad agosto — e nel
 *    frattempo gli altri hanno portato due pacchetti piccoli.
 * 3. **I soldi.** Qui sta il vincolo vero. Tenere i quattro reparti al lavoro
 *    tutto l'anno costa tre volte quello che una scuderia incassa. Il
 *    calendario non ti ferma: ti ferma la cassa.
 *
 * ## Il rischio non è decorazione
 *
 * Un progetto non rende quello che prometteva: rende quello che prometteva
 * moltiplicato per come è andata. I progetti grandi hanno la varianza più
 * alta e **possono peggiorare la macchina**, ed è quello che li rende una
 * scommessa invece di un acquisto. Chi non rischia mai resta dov'è, perché il
 * resto della griglia nel frattempo si muove.
 */

/** Quanto costa, quanto dura e quanto promette ogni taglia di progetto. */
export const PROJECT_SIZES: Record<ProjectSize, {
  label: string;
  weeks: number;
  cost: number;
  /** guadagno atteso in punti di rating, prima di ogni correttivo */
  gain: number;
  /** deviazione della resa attorno a 1: quanto può andare diversa dalle attese */
  spread: number;
  hint: string;
}> = {
  piccolo: {
    label: 'Pacchetto',
    weeks: 6, cost: 1_600_000, gain: 0.27, spread: 0.30,
    hint: 'Sei settimane. Poco, ma quasi sicuro.',
  },
  medio: {
    label: 'Aggiornamento',
    weeks: 12, cost: 4_000_000, gain: 0.63, spread: 0.45,
    hint: 'Tre mesi. Il ritmo normale di una scuderia che lavora.',
  },
  grande: {
    label: 'Progetto maggiore',
    weeks: 22, cost: 8_400_000, gain: 1.38, spread: 0.72,
    hint: 'Mezza stagione e un quinto del bilancio. Può anche andare male.',
  },
};

export const PROJECT_SIZE_KEYS: readonly ProjectSize[] = ['piccolo', 'medio', 'grande'];

export const AREA_LABEL: Record<CarKey, string> = {
  aero: 'Aerodinamica',
  engine: 'Motore',
  chassis: 'Telaio',
  reliability: 'Affidabilità',
};

/** Spesa settimanale di un progetto: il costo è distribuito sulla durata. */
export function weeklyCost(project: Project): number {
  return project.cost / Math.max(1, project.weeks);
}

/** Quanto sta spendendo in sviluppo una scuderia, a settimana. */
export function developmentBurn(team: Team): number {
  return team.projects.reduce((s, p) => s + weeklyCost(p), 0);
}

/**
 * Perché un reparto potrebbe rifiutare il progetto che gli chiedi.
 *
 * Restituisce `null` quando si può fare. Le ragioni sono tutte e sole quelle
 * che il giocatore deve poter leggere prima di premere, non dopo.
 */
export function startRefusal(team: Team, area: CarKey, size: ProjectSize): string | null {
  if (team.projects.some((p) => p.area === area)) {
    return `${AREA_LABEL[area]} sta già lavorando a un progetto`;
  }
  const spec = PROJECT_SIZES[size];
  // Basta la prima settimana in cassa: il resto si paga strada facendo, e un
  // progetto che resta senza fondi si ferma da solo (vedi `advanceProjects`).
  if (team.cash < spec.cost / spec.weeks) {
    return 'Non ci sono soldi nemmeno per la prima settimana';
  }
  return null;
}

/** Avvia un progetto. Restituisce false se il reparto non può prenderlo. */
export function startProject(
  team: Team, area: CarKey, size: ProjectSize, year: number, week: number,
): boolean {
  if (startRefusal(team, area, size) !== null) return false;
  const spec = PROJECT_SIZES[size];
  team.projects.push({
    id: `${team.id}-${area}-${year}-${week}`,
    area, size,
    weeks: spec.weeks,
    weeksLeft: spec.weeks,
    cost: spec.cost,
    spent: 0,
  });
  return true;
}

/**
 * Chiude un progetto prima del tempo.
 *
 * Quello che è stato speso resta speso: è il prezzo di aver cambiato idea, ed
 * è quello che rende la scelta iniziale una scelta.
 */
export function cancelProject(team: Team, projectId: string): boolean {
  const before = team.projects.length;
  team.projects = team.projects.filter((p) => p.id !== projectId);
  return team.projects.length !== before;
}

export interface Delivery {
  teamId: string;
  area: CarKey;
  size: ProjectSize;
  /** punti di rating effettivamente guadagnati; può essere negativo */
  gain: number;
  /** resa rispetto alle attese: 1 = come previsto */
  quality: number;
}

/**
 * Quanto rende davvero un progetto consegnato.
 *
 * Tre correttivi, e ognuno risponde a un difetto che il simulatore a
 * quarant'anni aveva mostrato prima che esistessero:
 *
 * - **Rendimenti calanti.** Portare l'aerodinamica da 70 a 71 è lavoro
 *   normale; da 95 a 96 è mezza stagione. Senza, la scuderia di vertice
 *   accumula all'infinito.
 * - **Handicap al vincitore.** Chi ha vinto sviluppa meno, come le ore di
 *   galleria del vento assegnate al contrario della classifica. È la
 *   contromisura vera al congelamento della griglia.
 * - **Il reparto tecnico.** Gli stessi soldi in mani migliori rendono di più:
 *   è ciò che rende il personale una spesa e non un numero decorativo.
 * - **Il recupero.** Chi è molto indietro guadagna di più per ogni euro. È il
 *   correttivo più importante dei quattro e l'avevo perso strada facendo: la
 *   sonda mostrava una scuderia nuova che restava nona per otto stagioni di
 *   fila, perché il suo bilancio da ultima classificata comprava due
 *   aggiornamenti all'anno contro gli otto di chi stava davanti. Senza
 *   recupero, la classifica di partenza è la classifica per sempre — e quella
 *   non è difficoltà, è l'assenza di un gioco.
 */
export function deliveredGain(
  world: World, team: Team, project: Project, standingOrder: string[], rng: Rng,
): Delivery {
  const spec = PROJECT_SIZES[project.size];
  const teamCount = Math.max(1, Object.keys(world.teams).length - 1);
  const rank = standingOrder.indexOf(team.id);
  const handicap = rank < 0 ? 1.15 : clamp(0.74 + (rank / teamCount) * 0.60, 0.7, 1.4);

  const headroom = clamp((99 - team.car[project.area]) / 30, 0.22, 1.25);
  const efficiency = 0.55 + (team.crew.technical / 100) * 0.7;

  const teamsList = Object.values(world.teams);
  const mean = teamsList.reduce((t, x) => t + carPace(x.car), 0) / teamsList.length;
  const catchUp = clamp(1 + (mean - carPace(team.car)) * 0.18, 0.8, 2.4);

  // La resa. Il taglio a −0.45 è quello che permette a un progetto grande di
  // peggiorare davvero la macchina: senza, «rischio» sarebbe solo una parola
  // per «guadagni un po' meno».
  const quality = clamp(1 + rng.normal() * spec.spread, -0.45, 2.1);

  return {
    teamId: team.id,
    area: project.area,
    size: project.size,
    gain: spec.gain * quality * handicap * headroom * efficiency * catchUp,
    quality,
  };
}

/**
 * Una settimana di lavoro dei reparti, per tutte le scuderie.
 *
 * Paga le fatture, scala le settimane e consegna quello che è pronto. Un
 * progetto rimasto senza fondi non va avanti: non si annulla e non indebita
 * la scuderia, semplicemente si ferma finché la cassa non torna. È il freno
 * che rende la cassa una risorsa e non un contatore.
 */
export function advanceProjects(world: World, standingOrder: string[], rng: Rng): Delivery[] {
  const delivered: Delivery[] = [];

  for (const team of Object.values(world.teams)) {
    const done: string[] = [];
    for (const project of team.projects) {
      const due = weeklyCost(project);
      if (team.cash < due) continue;
      team.cash -= due;
      project.spent += due;
      project.weeksLeft -= 1;
      if (project.weeksLeft > 0) continue;

      const delivery = deliveredGain(world, team, project, standingOrder, rng);
      team.car[project.area] = clamp(team.car[project.area] + delivery.gain, 40, 99);
      delivered.push(delivery);
      done.push(project.id);
    }
    if (done.length > 0) team.projects = team.projects.filter((p) => !done.includes(p.id));
  }

  return delivered;
}

/**
 * Cosa apre una scuderia gestita dal computer.
 *
 * Sceglie il reparto in cui è più indietro rispetto alla griglia — non quello
 * in cui è più debole in assoluto, che sarebbe sempre l'affidabilità — e la
 * taglia più grande che la cassa regge con un margine. Senza il margine le
 * scuderie svuoterebbero la cassa a marzo e resterebbero ferme da luglio, che
 * è esattamente l'errore che farebbe un giocatore alle prime armi.
 */
export function aiProjectPlan(world: World, team: Team, rng: Rng): void {
  const free = CAR_KEYS.filter((k) => !team.projects.some((p) => p.area === k));
  if (free.length === 0) return;

  const teams = Object.values(world.teams);
  const deficit = (k: CarKey) => {
    const mean = teams.reduce((s, t) => s + t.car[k], 0) / teams.length;
    return mean - team.car[k];
  };

  // Un po' di carattere: non tutte scelgono il reparto giusto, e le priorità
  // sbagliate sono metà del motivo per cui la gerarchia si muove.
  const area = free
    .map((k) => ({ k, score: deficit(k) + rng.normal() * 2.2 }))
    .sort((a, b) => b.score - a.score)[0]!.k;

  // Un progetto non si paga il giorno in cui si apre: si paga a settimane. La
  // riserva da tenere è quella dei progetti già aperti, non il costo pieno di
  // quello nuovo. Chiedendo il costo intero più dieci settimane di riserva —
  // com'era — una scuderia di coda non riusciva mai ad aprirne un secondo, e
  // la sonda mostrava una macchina che saliva a metà del ritmo possibile.
  const runway = team.cash - developmentBurn(team) * 6;
  for (const size of ['grande', 'medio', 'piccolo'] as const) {
    const spec = PROJECT_SIZES[size];
    if (runway < spec.cost * 0.35) continue;
    startProject(team, area, size, world.year, world.week);
    return;
  }
}
