import type { Track } from '../../engine/types.js';
import { createRng, hashSeed } from '../../engine/rng.js';

/**
 * Il disegno del circuito, generato dai suoi parametri.
 *
 * Dodici tracciati disegnati a mano sarebbero dodici file da mantenere; qui la
 * forma nasce dal seed del circuito, quindi è sempre la stessa per lo stesso
 * autodromo ma diversa da tutti gli altri. Il numero di curve segue il
 * carattere della pista: dove si sorpassa poco il tracciato è più tortuoso.
 *
 * La geometria non deve essere fedele: serve a dare contesto e atmosfera.
 * I distacchi si leggono sulla striscia, non qui.
 */

export const TRACK_VIEWBOX = { w: 420, h: 250 };

export function trackPath(track: Track): string {
  const rng = createRng(hashSeed(`shape:${track.id}`));
  // Meno sorpassi = più curve. 7 nodi per una pista veloce, 12 per un cittadino.
  const nodes = Math.round(12 - track.overtaking * 9);
  const cx = TRACK_VIEWBOX.w / 2;
  const cy = TRACK_VIEWBOX.h / 2;
  const rx = TRACK_VIEWBOX.w * 0.38;
  const ry = TRACK_VIEWBOX.h * 0.36;

  const pts: { x: number; y: number }[] = [];
  for (let i = 0; i < nodes; i++) {
    const a = (i / nodes) * Math.PI * 2;
    // Il raggio varia per nodo: è questo che rende ogni circuito riconoscibile.
    const jitter = 0.62 + rng.next() * 0.55;
    pts.push({ x: cx + Math.cos(a) * rx * jitter, y: cy + Math.sin(a) * ry * jitter });
  }

  // Catmull–Rom chiusa convertita in cubiche di Bézier: curve morbide, nessuno spigolo.
  const at = (i: number) => pts[((i % nodes) + nodes) % nodes]!;
  let d = `M ${at(0).x.toFixed(1)} ${at(0).y.toFixed(1)}`;
  for (let i = 0; i < nodes; i++) {
    const p0 = at(i - 1);
    const p1 = at(i);
    const p2 = at(i + 1);
    const p3 = at(i + 2);
    const c1 = { x: p1.x + (p2.x - p0.x) / 6, y: p1.y + (p2.y - p0.y) / 6 };
    const c2 = { x: p2.x - (p3.x - p1.x) / 6, y: p2.y - (p3.y - p1.y) / 6 };
    d += ` C ${c1.x.toFixed(1)} ${c1.y.toFixed(1)}, ${c2.x.toFixed(1)} ${c2.y.toFixed(1)}, ${p2.x.toFixed(1)} ${p2.y.toFixed(1)}`;
  }
  return `${d} Z`;
}
