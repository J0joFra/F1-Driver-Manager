/** Formattazioni condivise. In orizzontale ogni carattere in meno è spazio guadagnato. */

export function money(v: number): string {
  const abs = Math.abs(v);
  const sign = v < 0 ? '−' : '';
  if (abs >= 1_000_000) return `${sign}${(abs / 1_000_000).toFixed(2).replace('.', ',')}M`;
  if (abs >= 1_000) return `${sign}${Math.round(abs / 1_000)}k`;
  return `${sign}${Math.round(abs)}`;
}

export function gap(seconds: number | null): string {
  if (seconds === null) return 'RIT';
  if (seconds < 0.05) return '—';
  return `+${seconds.toFixed(3)}`;
}

export function lapTime(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = seconds - m * 60;
  return `${m}:${s.toFixed(3).padStart(6, '0')}`;
}

export function ordinal(n: number): string {
  return n > 0 ? `P${n}` : '—';
}

export const ATTR_LABELS: Record<string, string> = {
  speed: 'Velocità pura',
  consistency: 'Costanza',
  tyres: 'Gestione gomme',
  starts: 'Partenze',
  wet: 'Guida sul bagnato',
  technical: 'Feedback tecnico',
  composure: 'Sangue freddo',
};

export const CATEGORY_LABELS: Record<string, { name: string; hint: string }> = {
  simulator: { name: 'Simulatore', hint: 'Ripeti i giri del prossimo circuito' },
  fitness: { name: 'Preparazione fisica', hint: 'Collo, resistenza, recupero' },
  engineering: { name: 'Lavoro con gli ingegneri', hint: 'Assetto e lettura dei dati' },
  media: { name: 'Media e sponsor', hint: 'Interviste, eventi, immagine' },
};

export const MINIGAME_LABELS: Record<string, string> = {
  thermal: 'Banda termica',
  reaction: 'Semaforo di partenza',
  sequence: 'Sequenza luci',
};
