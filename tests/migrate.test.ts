import { describe, expect, it } from 'vitest';
import { migrateWorld } from '../src/engine/migrate.js';
import { startCareer } from '../src/engine/career.js';

/**
 * Regressione: aggiungere `world.offers` senza una migrazione mandava in crash
 * l'app all'avvio su ogni salvataggio esistente — schermo nero, nessuna via
 * d'uscita. Ogni campo nuovo del mondo deve avere un valore di ripiego.
 */
describe('salvataggi di versioni precedenti', () => {
  function oldSave() {
    const w = startCareer({ seed: 5, name: 'L. Marchetti', nationality: 'ITA' }) as unknown as Record<string, unknown>;
    // Com'era il mondo prima dei contratti, dell'anti-inflazione e dei nomi brevi.
    delete w.offers;
    delete w.talentAnchor;
    for (const team of Object.values(w.teams as Record<string, Record<string, unknown>>)) {
      delete team.short;
    }
    return w;
  }

  it('riempie i campi che non esistevano', () => {
    const migrated = migrateWorld(oldSave());
    expect(migrated).not.toBeNull();
    expect(migrated!.offers).toEqual([]);
    expect(typeof migrated!.talentAnchor).toBe('number');
    for (const team of Object.values(migrated!.teams)) {
      expect(team.short, team.name).toBeTruthy();
    }
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
    const w = startCareer({ seed: 9, name: 'Test', nationality: 'ITA' });
    const migrated = migrateWorld(structuredClone(w))!;
    expect(migrated.offers).toEqual(w.offers);
    expect(migrated.talentAnchor).toBe(w.talentAnchor);
  });
});
