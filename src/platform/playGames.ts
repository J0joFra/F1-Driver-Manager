import { isComplete, OBJECTIVES, type Objective, type ProfileStats } from '../engine/profile.js';

/**
 * Gli obiettivi di Google Play, e cosa si può davvero fare.
 *
 * ## Prima una correzione, perché è quella che fa perdere tempo
 *
 * I **punti Google Play** non li può assegnare uno sviluppatore. Sono un
 * programma di fedeltà di Google: li guadagna chi acquista — anche sui tuoi
 * acquisti in app — e chi fa le attività che decide Google. Non esiste
 * un'API per dire «questo giocatore ha fatto una cosa, dagli cinquanta
 * punti», e non c'è un modo di aggirarla.
 *
 * Quello che si può fare, e che è quasi sempre ciò che si intendeva, sono gli
 * **obiettivi di Play Games Services**: li definisci tu nella console, hanno
 * un'icona e una descrizione, compaiono nel profilo Play del giocatore e sono
 * condivisibili. Non danno punti, danno riconoscimento — e il gioco può
 * pagarli in valuta sua, che è quello che fa `OBJECTIVES`.
 *
 * ## Come si collegano
 *
 * 1. Play Console → *Play Games Services* → configura il gioco, e collegalo
 *    alle credenziali OAuth del progetto.
 * 2. Crea un obiettivo per ciascuno di quelli in `OBJECTIVES`, e riporta
 *    l'identificatore che Google assegna nel campo `playGamesId`.
 * 3. `npm install @openforge/capacitor-google-play-games` (o un plugin
 *    equivalente), `npx cap sync android`.
 * 4. Da qui in poi `syncAchievements` fa il resto.
 *
 * Finché il punto 2 non è fatto, `playGamesId` è vuoto e questo modulo non
 * fa niente: il gioco funziona lo stesso, con i suoi obiettivi interni.
 */

interface PlayGamesPlugin {
  signIn(): Promise<{ player?: { playerId?: string } }>;
  unlockAchievement(opts: { achievementId: string }): Promise<void>;
}

const PLUGIN = '@openforge/capacitor-google-play-games';

export interface PlayGames {
  readonly available: boolean;
  signIn(): Promise<boolean>;
  unlock(achievementId: string): Promise<void>;
}

/** Quando non c'è Play Games — sul web, o prima che il plugin sia installato. */
const ABSENT: PlayGames = {
  available: false,
  async signIn() { return false; },
  async unlock() { /* non c'è niente da sbloccare */ },
};

export async function createPlayGames(): Promise<PlayGames> {
  const native = typeof window !== 'undefined'
    && (window as { Capacitor?: { isNativePlatform?: () => boolean } }).Capacitor
      ?.isNativePlatform?.();
  if (!native) return ABSENT;

  try {
    const mod = await import(/* @vite-ignore */ PLUGIN) as { GooglePlayGames: PlayGamesPlugin };
    const plugin = mod.GooglePlayGames;
    return {
      available: true,
      async signIn() {
        try {
          const res = await plugin.signIn();
          return !!res.player?.playerId;
        } catch {
          return false;
        }
      },
      async unlock(achievementId: string) {
        try {
          await plugin.unlockAchievement({ achievementId });
        } catch {
          // Un obiettivo non sbloccato non deve fermare il gioco: Play Games
          // è un di più, e la sua assenza non toglie niente a chi sta giocando.
        }
      },
    };
  } catch {
    return ABSENT;
  }
}

/** Gli obiettivi raggiunti che hanno un corrispondente su Play Games. */
export function mirrored(stats: ProfileStats): Objective[] {
  return OBJECTIVES.filter((o) => o.playGamesId && isComplete(stats, o));
}

/**
 * Rispecchia su Play Games quello che il giocatore ha già fatto.
 *
 * Si può chiamare quante volte si vuole: sbloccare un obiettivo già sbloccato
 * è un'operazione innocua, e conviene farlo all'avvio invece che tenere il
 * conto di cosa si è già mandato — una lista in più da tenere sincronizzata
 * è una lista in più che può sbagliarsi.
 */
export async function syncAchievements(games: PlayGames, stats: ProfileStats): Promise<number> {
  if (!games.available) return 0;
  const done = mirrored(stats);
  for (const objective of done) await games.unlock(objective.playGamesId!);
  return done.length;
}
