import type { RaceEvent } from '../../engine/liveRace.js';

const COMPOUND_LABEL: Record<string, string> = { S: 'soft', M: 'medium', H: 'hard' };

/**
 * Compone la frase da mostrare per un evento di gara.
 *
 * Il motore emette dati (chi, cosa, quando); la lingua vive qui, così un
 * giorno si traduce senza toccare la simulazione.
 */
export function eventText(e: RaceEvent, name: (driverId: string) => string): string {
  const [a, b] = e.drivers;
  switch (e.kind) {
    case 'start':
      return 'Semaforo verde';
    case 'overtake':
      return `${name(a ?? '')} passa ${name(b ?? '')}`;
    case 'pit':
      return `${name(a ?? '')} ai box · ${COMPOUND_LABEL[e.compound ?? 'M'] ?? e.compound}`;
    case 'retire':
      return `${name(a ?? '')} si ritira`;
    case 'safetyCarOut':
      return 'SAFETY CAR IN PISTA';
    case 'safetyCarIn':
      return 'La safety car rientra';
  }
}
