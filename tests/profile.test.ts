import { describe, expect, it } from 'vitest';
import {
  claimableDay, claimDaily, claimObjective, claimable, CYCLE_LENGTH,
  migrateProfile, newProfile, OBJECTIVES, progressOf, today,
} from '../src/engine/profile.js';
import { applyTally } from '../src/engine/tracking.js';
import { canAfford, spend, startingWallet } from '../src/engine/wallet.js';
import { catalogProblems, PRODUCTS } from '../src/engine/store.js';
import {
  injectCash, MIN_INJECTION, researchRoom, rushCost, rushProject, rushRefusal,
  WEEKS_PER_RESEARCH_TOKEN,
} from '../src/engine/boosts.js';
import { startTeam, playerTeam } from '../src/engine/team.js';
import { startProject } from '../src/engine/projects.js';

describe('il portafoglio', () => {
  it('non spende quello che non ha, e non lascia mezzi pagamenti', () => {
    const w = { credits: 10, skill: 1, research: 0 };
    expect(canAfford(w, { credits: 5, research: 1 })).toBe(false);
    expect(spend(w, { credits: 5, research: 1 })).toBe(false);
    // Il difetto da evitare: togliere i crediti e poi accorgersi che i
    // gettoni non bastavano.
    expect(w).toEqual({ credits: 10, skill: 1, research: 0 });
  });
});

describe('le ricompense giornaliere', () => {
  it('si ritirano una volta al giorno', () => {
    const p = newProfile();
    expect(claimDaily(p, '2031-03-10')).not.toBeNull();
    expect(claimDaily(p, '2031-03-10')).toBeNull();
    expect(claimableDay(p.daily, '2031-03-10')).toBeNull();
  });

  it('la serie continua di giorno in giorno e il ciclo gira', () => {
    const p = newProfile();
    const days = [
      '2031-03-10', '2031-03-11', '2031-03-12', '2031-03-13',
      '2031-03-14', '2031-03-15', '2031-03-16', '2031-03-17',
    ];
    const claimed = days.map((d) => claimDaily(p, d)?.day);
    expect(claimed).toEqual([0, 1, 2, 3, 4, 5, 6, 0]);
    expect(p.daily.streak).toBe(CYCLE_LENGTH + 1);
  });

  it('saltare un giorno riporta alla prima casella', () => {
    const p = newProfile();
    claimDaily(p, '2031-03-10');
    claimDaily(p, '2031-03-11');
    expect(claimDaily(p, '2031-03-13')?.day).toBe(0);
    expect(p.daily.streak).toBe(1);
  });

  it('il premio finisce nel portafoglio', () => {
    const p = newProfile();
    const before = { ...p.wallet };
    const claim = claimDaily(p, '2031-03-10')!;
    expect(p.wallet.credits).toBe(before.credits + (claim.reward.credits ?? 0));
  });

  it('«oggi» è una data locale, non UTC', () => {
    // Una data scritta a mano e riletta deve tornare uguale: se `today`
    // passasse per UTC, chi gioca la sera in Italia vedrebbe il giorno dopo.
    const d = new Date(2031, 2, 10, 23, 30);
    expect(today(d)).toBe('2031-03-10');
  });
});

describe('gli obiettivi', () => {
  it('si riscuotono una volta sola', () => {
    const p = newProfile();
    p.stats.wins = 1;
    const win = OBJECTIVES.find((o) => o.id === 'first-win')!;
    expect(claimable(p, win)).toBe(true);
    expect(claimObjective(p, 'first-win')).toBe(true);
    expect(claimObjective(p, 'first-win')).toBe(false);
    expect(claimable(p, win)).toBe(false);
  });

  it('la posizione costruttori va al contrario, e zero non è primo', () => {
    const podium = OBJECTIVES.find((o) => o.id === 'podium-team')!;
    const p = newProfile();
    // Nessuna stagione chiusa: non deve risultare già raggiunto.
    expect(progressOf(p.stats, podium)).toBe(0);
    p.stats.bestConstructorPosition = 5;
    expect(progressOf(p.stats, podium)).toBe(0);
    p.stats.bestConstructorPosition = 2;
    expect(progressOf(p.stats, podium)).toBe(podium.target);
  });

  it('la miglior posizione è un minimo, non una somma', () => {
    const p = newProfile();
    applyTally(p.stats, { seasons: 1 }, 3);
    applyTally(p.stats, { seasons: 1 }, 6);
    expect(p.stats.seasons).toBe(2);
    expect(p.stats.bestConstructorPosition).toBe(3);
  });
});

describe('il catalogo del negozio', () => {
  it('rispetta le regole degli identificatori di Google', () => {
    expect(catalogProblems()).toEqual([]);
  });

  it('ogni prodotto accredita qualcosa', () => {
    for (const p of PRODUCTS) {
      const total = (p.grants.credits ?? 0) + (p.grants.skill ?? 0) + (p.grants.research ?? 0);
      expect(total, p.id).toBeGreaterThan(0);
    }
  });

  it('un catalogo con un id sbagliato viene respinto', () => {
    const problems = catalogProblems([
      { id: 'Tokens 20', kind: 'consumable', name: 'x', hint: '', grants: { skill: 1 }, price: '' },
    ]);
    expect(problems.length).toBeGreaterThan(0);
  });
});

describe('le scorciatoie comprate', () => {
  function team() {
    const w = startTeam({
      seed: 3, name: 'Prova', short: 'PRV', colour: '#D21E1E', budget: 'indipendente',
    });
    return { world: w, team: playerTeam(w)! };
  }

  it('i crediti entrano in cassa solo sopra il taglio minimo', () => {
    const { team: t } = team();
    const wallet = startingWallet();
    const cash = t.cash;
    expect(injectCash(wallet, t, MIN_INJECTION - 1)).toBe(false);
    expect(t.cash).toBe(cash);
    expect(injectCash(wallet, t, MIN_INJECTION)).toBe(true);
    expect(t.cash).toBe(cash + MIN_INJECTION);
    expect(wallet.credits).toBe(startingWallet().credits - MIN_INJECTION);
  });

  it('accorciare un progetto costa anche il lavoro saltato', () => {
    const { world, team: t } = team();
    startProject(t, 'aero', 'grande', world.year, 0);
    const project = t.projects[0]!;
    const wallet = { credits: 0, skill: 0, research: 10 };
    const cash = t.cash;
    const weeks = project.weeksLeft;
    const cost = rushCost(project, 2);

    expect(cost).toBeGreaterThan(0);
    expect(rushProject(wallet, t, project, 2)).toBe(true);
    expect(project.weeksLeft).toBe(weeks - 2 * WEEKS_PER_RESEARCH_TOKEN);
    // Il punto: il gettone compra tempo, non lavoro. Senza questo addebito,
    // accorciare sarebbe uno sconto travestito da fretta.
    expect(t.cash).toBe(cash - cost);
    expect(project.spent).toBe(cost);
    expect(wallet.research).toBe(8);
  });

  it('un progetto non si può comprare fino alla consegna', () => {
    const { world, team: t } = team();
    startProject(t, 'engine', 'piccolo', world.year, 0);
    const project = t.projects[0]!;
    const wallet = { credits: 0, skill: 0, research: 99 };

    // Resta sempre almeno una settimana: è il limite che impedisce di aprire
    // un progetto e vederlo consegnato lo stesso pomeriggio.
    const room = researchRoom(project);
    expect(rushRefusal(wallet, t, project, room + 1)).not.toBeNull();
    rushProject(wallet, t, project, room);
    expect(project.weeksLeft).toBeGreaterThanOrEqual(1);
  });
});

describe('la migrazione del profilo', () => {
  it('un profilo illeggibile non cancella niente, ne crea uno nuovo', () => {
    expect(migrateProfile(null).wallet).toEqual(startingWallet());
    expect(migrateProfile('rotto').claimed).toEqual([]);
  });

  it('un portafoglio esistente si conserva, anche a zero', () => {
    const p = migrateProfile({ wallet: { credits: 0, skill: 0, research: 0 } });
    expect(p.wallet).toEqual({ credits: 0, skill: 0, research: 0 });
  });

  it('valori assurdi non diventano un credito infinito', () => {
    const p = migrateProfile({ wallet: { credits: -50, skill: 'tanti', research: Infinity } });
    expect(p.wallet.credits).toBe(0);
    expect(p.wallet.skill).toBe(0);
    expect(p.wallet.research).toBe(0);
  });
});
