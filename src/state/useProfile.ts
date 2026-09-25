import { create } from 'zustand';
import {
  claimDaily, claimObjective, migrateProfile, newProfile, pendingObjectives,
  type DailyClaim, type Profile,
} from '../engine/profile.js';
import { applyTally, type SeasonTally } from '../engine/tracking.js';
import { grant, type Wallet } from '../engine/wallet.js';
import { productById } from '../engine/store.js';
import type { ProfileStats } from '../engine/profile.js';

/**
 * Il profilo, in una chiave tutta sua.
 *
 * Non passa da `useGame`: quello store salva il mondo, e il mondo si cancella
 * quando abbandoni una carriera. Qui dentro c'è quello che è stato **pagato**,
 * e non può sparire per una scelta presa dentro una partita.
 *
 * Non uso `persist` di zustand come fa `useGame`, e non è pigrizia: `persist`
 * scrive in modo asincrono dopo il render, e per un portafoglio che riceve un
 * accredito da un acquisto vero voglio che il salvataggio sia **finito** prima
 * di dire a Google che il prodotto è stato consegnato. Qui la scrittura è
 * sincrona e avviene dentro l'azione.
 */

const KEY = 'f1dm-profile-v1';

function read(): Profile {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return newProfile();
    return migrateProfile(JSON.parse(raw));
  } catch {
    // Un profilo illeggibile non deve impedire di giocare.
    return newProfile();
  }
}

function write(profile: Profile): void {
  try {
    localStorage.setItem(KEY, JSON.stringify(profile));
  } catch {
    // Spazio esaurito o scrittura negata: il gioco continua in memoria.
  }
}

export interface ProfileState {
  profile: Profile;
  /** l'ultimo premio giornaliero ritirato, da mostrare in sovrimpressione */
  lastClaim: DailyClaim | null;
  claimToday: () => DailyClaim | null;
  claimObjectiveById: (id: string) => boolean;
  /** accredita un acquisto, una volta sola per ricevuta */
  creditPurchase: (productId: string, token: string) => boolean;
  /** somma quello che una partita ha prodotto */
  track: (add: Partial<ProfileStats>, constructorPosition?: number) => void;
  trackSeason: (tally: SeasonTally) => void;
  /** toglie dal portafoglio; false se non basta */
  pay: (cost: Partial<Wallet>) => boolean;
  setLanguage: (code: string) => void;
  dismissClaim: () => void;
  reload: () => void;
}

export const useProfile = create<ProfileState>((set, get) => {
  /** Applica una modifica al profilo, la salva e la pubblica. */
  const commit = (mutate: (p: Profile) => void, extra: Partial<ProfileState> = {}) => {
    const profile = { ...get().profile, wallet: { ...get().profile.wallet } };
    mutate(profile);
    write(profile);
    set({ profile, ...extra });
  };

  return {
    profile: read(),
    lastClaim: null,

    claimToday: () => {
      let claim: DailyClaim | null = null;
      commit((p) => { claim = claimDaily(p); });
      if (claim) set({ lastClaim: claim });
      return claim;
    },

    claimObjectiveById: (id) => {
      let ok = false;
      commit((p) => { ok = claimObjective(p, id); });
      return ok;
    },

    /**
     * Accredita un acquisto.
     *
     * Il token della ricevuta viene registrato: se lo stesso acquisto arriva
     * due volte — succede, perché Play Billing può riconsegnare un acquisto
     * non consumato al riavvio dell'app — il secondo non accredita niente.
     * Senza questo controllo un riavvio al momento sbagliato regalerebbe il
     * doppio di quello che è stato pagato.
     */
    creditPurchase: (productId, token) => {
      const product = productById(productId);
      if (!product) return false;
      if (get().profile.purchases.includes(token)) return false;
      commit((p) => {
        grant(p.wallet, product.grants);
        p.purchases = [...p.purchases, token];
      });
      return true;
    },

    track: (add, constructorPosition = 0) => {
      commit((p) => {
        p.stats = { ...p.stats };
        applyTally(p.stats, add, constructorPosition);
      });
    },

    trackSeason: (tally) => {
      commit((p) => {
        p.stats = { ...p.stats };
        applyTally(p.stats, tally.add, tally.constructorPosition);
      });
    },

    pay: (cost) => {
      const wallet = get().profile.wallet;
      const enough = (['credits', 'skill', 'research'] as const)
        .every((c) => wallet[c] >= (cost[c] ?? 0));
      if (!enough) return false;
      commit((p) => {
        for (const c of ['credits', 'skill', 'research'] as const) {
          p.wallet[c] -= cost[c] ?? 0;
        }
      });
      return true;
    },

    setLanguage: (code) => commit((p) => { p.language = code; }),
    dismissClaim: () => set({ lastClaim: null }),
    reload: () => set({ profile: read() }),
  };
});

/** Quanti obiettivi sono pronti: è il numero rosso sul badge del menu. */
export function pendingCount(profile: Profile): number {
  return pendingObjectives(profile);
}
