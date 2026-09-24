import { describe, expect, it } from 'vitest';
import { migrateWorld } from '../src/engine/migrate.js';
import { startTeam } from '../src/engine/team.js';

/**
 * Regressione: aggiungere `world.offers` senza una migrazione mandava in crash
 * l'app all'avvio su ogni salvataggio esistente — schermo nero, nessuna via
 * d'uscita. Ogni campo nuovo del mondo deve avere un valore di ripiego.
 */
describe('salvataggi di versioni precedenti', () => {
  function oldSave() {
    const w = startTeam({
      seed: 5, name: 'Prova', short: 'PRV', colour: '#C8102E', budget: 'indipendente',
    }) as unknown as Record<string, unknown>;
    // Com'era il mondo prima dei contratti, dell'anti-inflazione e dei nomi brevi.
    w.offers = [];
    delete w.talentAnchor;
    for (const team of Object.values(w.teams as Record<string, Record<string, unknown>>)) {
      delete team.short;
      delete team.cash;
      delete team.projects;
      team.futureFocus = 0;
    }
    for (const d of Object.values(w.drivers as Record<string, Record<string, unknown>>)) {
      delete d.fatigue;
      delete d.experience;
    }
    return w;
  }

  it('riempie i campi che non esistevano', () => {
    const migrated = migrateWorld(oldSave());
    expect(migrated).not.toBeNull();
    expect((migrated as unknown as Record<string, unknown>).offers).toBeUndefined();
    expect(typeof migrated!.talentAnchor).toBe('number');
    for (const team of Object.values(migrated!.teams)) {
      expect(team.short, team.name).toBeTruthy();
      expect(typeof team.cash, team.name).toBe('number');
      expect(Array.isArray(team.projects), team.name).toBe(true);
    }
    for (const d of Object.values(migrated!.drivers)) {
      expect(typeof d.fatigue, d.name).toBe('number');
      expect(typeof d.experience, d.name).toBe('number');
    }
  });

  it("stima l'esperienza dalle gare già disputate", () => {
    const w = oldSave();
    const drivers = w.drivers as Record<string, { career: { starts: number } }>;
    const veteranId = Object.keys(drivers)[0]!;
    drivers[veteranId]!.career.starts = 120;
    const migrated = migrateWorld(w)!;
    // Un veterano non riparte da zero: l'esperienza è ciò che lo tiene in pista.
    expect(migrated.drivers[veteranId]!.experience).toBeGreaterThan(300);
  });

  it('conserva la carriera: non è un reset mascherato', () => {
    const before = oldSave();
    const migrated = migrateWorld(before)!;
    expect(migrated.year).toBe(before.year);
    expect(Object.keys(migrated.drivers)).toHaveLength(Object.keys(before.drivers as object).length);
    expect(migrated.seat).toEqual(before.seat);
  });

  it('rifiuta quello che non è un mondo', () => {
    expect(migrateWorld(null)).toBeNull();
    expect(migrateWorld(undefined)).toBeNull();
    expect(migrateWorld('ciao')).toBeNull();
    expect(migrateWorld({})).toBeNull();
    expect(migrateWorld({ drivers: {}, teams: {} })).toBeNull();
  });

  it('un mondo già aggiornato resta uguale', () => {
    const w = startTeam({
      seed: 9, name: 'Test', short: 'TST', colour: '#C8102E', budget: 'indipendente',
    });
    const migrated = migrateWorld(structuredClone(w))!;
    expect(migrated.talentAnchor).toBe(w.talentAnchor);
    expect(migrated.seat).toEqual(w.seat);
  });

  /**
   * C'era una Modalità Pilota, e chi ci stava giocando ha ancora il suo
   * salvataggio. Non si può proseguire quella carriera, ma buttare via il
   * mondo sarebbe la cosa peggiore da fare: si prende in mano la scuderia di
   * quel pilota, e tutto il resto resta dov'era.
   */
  describe('salvataggi della Modalità Pilota', () => {
    function pilotSave() {
      const w = startTeam({
        seed: 77, name: 'Prova', short: 'PRV', colour: '#C8102E', budget: 'indipendente',
      }) as unknown as Record<string, unknown>;
      const drivers = w.drivers as Record<string, { id: string; teamId: string | null }>;
      const seated = Object.values(drivers).find((d) => d.teamId)!;
      w.seat = { mode: 'pilota', driverId: seated.id };
      return { save: w, driverId: seated.id, teamId: seated.teamId! };
    }

    it('il giocatore prende in mano la scuderia del suo pilota', () => {
      const { save, teamId } = pilotSave();
      const migrated = migrateWorld(save)!;
      expect(migrated).not.toBeNull();
      expect(migrated.seat).toEqual({ mode: 'scuderia', teamId });
      // Il mondo resta intero: non è un reset mascherato da migrazione.
      expect(Object.keys(migrated.drivers).length).toBeGreaterThan(10);
    });

    it('un pilota senza sedile non ha una scuderia da ereditare', () => {
      const { save, driverId } = pilotSave();
      (save.drivers as Record<string, { teamId: string | null }>)[driverId]!.teamId = null;
      expect(migrateWorld(save)).toBeNull();
    });
  });
});
