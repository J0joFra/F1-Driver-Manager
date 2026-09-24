import { describe, expect, it } from 'vitest';
import { TRACKS, getTrack } from '../src/engine/data/tracks.js';
import {
  NEUTRAL_MIX, carPaceOn, carWeights, driverInfluence, driverSkillOn,
  layoutName, mixTotal, overtakingFrom, tyreWearFrom, type SectorMix,
} from '../src/engine/layout.js';
import type { CarRating } from '../src/engine/types.js';
import type { RaceEntry } from '../src/engine/race.js';

const car = (engine: number, aero: number, chassis: number): CarRating =>
  ({ engine, aero, chassis, reliability: 90 });

const driver = (over: Partial<RaceEntry> = {}): RaceEntry => ({
  driverId: 'd', teamId: 't', carPace: 80, reliability: 90,
  speed: 80, consistency: 80, tyres: 80, starts: 80, wet: 80,
  composure: 80, technical: 80, pitCrew: 80, grid: 1, ...over,
});

const MONZA: SectorMix = { straight: 0.60, slow: 0.15, medium: 0.15, fast: 0.10 };
const MONACO: SectorMix = { straight: 0.15, slow: 0.50, medium: 0.28, fast: 0.07 };
const SILVERSTONE: SectorMix = { straight: 0.22, slow: 0.14, medium: 0.24, fast: 0.40 };

describe('la forma del circuito', () => {
  it('ogni tracciato descrive un giro intero', () => {
    for (const t of TRACKS) {
      expect(mixTotal(t.layout), t.id).toBeCloseTo(1, 6);
      for (const [key, value] of Object.entries(t.layout)) {
        expect(value, `${t.id}.${key}`).toBeGreaterThanOrEqual(0);
      }
      expect(t.width, t.id).toBeGreaterThanOrEqual(0);
      expect(t.width, t.id).toBeLessThanOrEqual(1);
      expect(t.drsZones, t.id).toBeGreaterThanOrEqual(0);
    }
  });

  it('i pesi della monoposto sommano sempre a uno', () => {
    for (const mix of [MONZA, MONACO, SILVERSTONE, NEUTRAL_MIX, ...TRACKS.map((t) => t.layout)]) {
      const w = carWeights(mix);
      expect(w.engine + w.aero + w.chassis).toBeCloseTo(1, 6);
    }
  });

  it('un tracciato non rende le macchine più veloci, sposta chi è veloce', () => {
    // Una monoposto media vale uguale ovunque: cambia solo chi la batte.
    const media = car(80, 80, 80);
    for (const mix of [MONZA, MONACO, SILVERSTONE]) {
      expect(carPaceOn(media, mix)).toBeCloseTo(80, 6);
    }
  });

  it('la potenza vince dove ci sono rettilinei, il telaio fra i muretti', () => {
    const motore = car(95, 70, 70);
    const telaio = car(70, 70, 95);
    const ala = car(70, 95, 70);

    expect(carPaceOn(motore, MONZA)).toBeGreaterThan(carPaceOn(telaio, MONZA));
    expect(carPaceOn(telaio, MONACO)).toBeGreaterThan(carPaceOn(motore, MONACO));
    expect(carPaceOn(ala, SILVERSTONE)).toBeGreaterThan(carPaceOn(motore, SILVERSTONE));
    // E la stessa macchina cambia valore da un posto all'altro: è il punto.
    // Sei punti di passo sono mezzo secondo al giro (× 0.092 s/punto): la
    // differenza fra essere in lotta per la vittoria e lottare per i punti.
    const swing = carPaceOn(motore, MONZA) - carPaceOn(motore, MONACO);
    expect(swing).toBeGreaterThan(5);
    expect(swing * 0.092).toBeGreaterThan(0.45);
  });

  it('il pilota conta più fra i muretti che in rettilineo', () => {
    expect(driverInfluence(MONACO)).toBeGreaterThan(driverInfluence(MONZA));
    expect(driverInfluence(MONZA)).toBeGreaterThan(0.5);
    expect(driverInfluence(MONACO)).toBeLessThan(1.5);
  });

  it('la velocità pura resta il peso maggiore ovunque', () => {
    // Diluirla appiattiva le differenze fra piloti: decideva solo la
    // macchina, e in quarant'anni una scuderia vinceva 36 titoli su 40.
    for (const mix of [MONZA, MONACO, SILVERSTONE, NEUTRAL_MIX]) {
      const base = driverSkillOn(driver(), mix, false);
      const veloce = driverSkillOn(driver({ speed: 90 }), mix, false);
      const tecnico = driverSkillOn(driver({ technical: 90 }), mix, false);
      const freddo = driverSkillOn(driver({ composure: 90 }), mix, false);
      expect(veloce - base, 'velocità').toBeGreaterThan(tecnico - base);
      expect(veloce - base, 'velocità').toBeGreaterThan(freddo - base);
    }
    // Ma la forma sposta il peso: il tecnico rende di più fra i muretti.
    const guadagnoLento = driverSkillOn(driver({ technical: 90 }), MONACO, false)
      - driverSkillOn(driver(), MONACO, false);
    const guadagnoDritto = driverSkillOn(driver({ technical: 90 }), MONZA, false)
      - driverSkillOn(driver(), MONZA, false);
    expect(guadagnoLento).toBeGreaterThan(guadagnoDritto);
  });

  it('si passa sui rettilinei larghi, non fra i muretti', () => {
    const largo = overtakingFrom(MONZA, 0.9, 2);
    const stretto = overtakingFrom(MONZA, 0.1, 2);
    // Stessa forma, larghezza diversa: è la larghezza a decidere.
    expect(largo).toBeGreaterThan(stretto * 1.5);
    expect(overtakingFrom(MONACO, 0.1, 1)).toBeLessThan(overtakingFrom(MONZA, 0.9, 2));
    // Il DRS aiuta, ma non ribalta un tracciato impossibile.
    expect(overtakingFrom(MONACO, 0.1, 3)).toBeLessThan(0.35);
  });

  it('le curve veloci mangiano le gomme più dei rettilinei', () => {
    expect(tyreWearFrom(SILVERSTONE, 35)).toBeGreaterThan(tyreWearFrom(MONZA, 35));
    for (const t of TRACKS) {
      expect(t.tyreWear, t.id).toBeGreaterThan(0.6);
      expect(t.tyreWear, t.id).toBeLessThan(1.6);
    }
  });

  it('i valori derivati coprono una banda giocabile', () => {
    const over = TRACKS.map((t) => t.overtaking);
    // Se tutti i circuiti si somigliassero, la forma non servirebbe a niente.
    expect(Math.min(...over)).toBeLessThan(0.28);
    expect(Math.max(...over)).toBeGreaterThan(0.55);
    // Il cittadino stretto è il più difficile di tutti.
    const vallmar = getTrack('vallmar');
    expect(vallmar.overtaking).toBe(Math.min(...over));
  });

  it('ogni tracciato ha un carattere riconoscibile', () => {
    expect(layoutName(MONZA)).toBe('Potenza');
    expect(layoutName(MONACO)).toBe('Guidato');
    expect(layoutName(SILVERSTONE)).toBe('Carico aerodinamico');
    // E nel calendario vero ci sono tutti e quattro i caratteri.
    expect(new Set(TRACKS.map((t) => layoutName(t.layout))).size).toBeGreaterThanOrEqual(3);
  });
});
