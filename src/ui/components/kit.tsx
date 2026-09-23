import { PALETTE } from '../palette.js';
import type { ReactNode } from 'react';
import type { AttributeKey } from '../../engine/types.js';

/**
 * Primitive dell'interfaccia.
 *
 * Densità pensata per il telefono in orizzontale: ~390 px di altezza, quindi
 * ogni riga vale, e le schede non hanno margini decorativi.
 */

export function Panel({
  title, tag, children, className = '', bodyClass = 'p-2.5',
}: {
  title?: string; tag?: ReactNode; children: ReactNode; className?: string; bodyClass?: string;
}) {
  return (
    <section className={`panel flex flex-col min-h-0 ${className}`}>
      {title && (
        <header className="panel-head">
          <h2 className="panel-title">{title}</h2>
          {tag && <div className="font-mono text-2xs text-dim tnum">{tag}</div>}
        </header>
      )}
      <div className={`min-h-0 flex-1 ${bodyClass}`}>{children}</div>
    </section>
  );
}

export function Btn({
  children, onClick, variant = 'ghost', disabled, className = '', title, testId,
}: {
  children: ReactNode; onClick?: () => void;
  variant?: 'ghost' | 'primary' | 'green' | 'danger'; disabled?: boolean;
  className?: string; title?: string; testId?: string;
}) {
  const look = {
    ghost: 'bg-panel2 border-line text-muted hover:text-ink hover:border-dim',
    primary: 'bg-ink border-ink text-white',
    green: 'bg-primary border-primary text-white font-semibold',
    danger: 'bg-transparent border-line text-bad hover:border-bad',
  }[variant];
  return (
    <button
      type="button" data-testid={testId} title={title} onClick={onClick} disabled={disabled}
      className={`inline-flex items-center justify-center gap-1.5 rounded border px-3 py-1.5 text-xs
        font-sans font-semibold disabled:opacity-35 disabled:cursor-not-allowed transition ${look} ${className}`}
    >
      {children}
    </button>
  );
}

/** Etichetta piccola sopra un numero grande. È il blocco che porta i dati chiave. */
export function Stat({
  value, label, tone, className = '',
}: {
  value: ReactNode; label: string; tone?: 'accent' | 'green' | 'muted'; className?: string;
}) {
  const colour = tone === 'accent' ? 'text-accent' : tone === 'green' ? 'text-primary' : tone === 'muted' ? 'text-muted' : 'text-ink';
  return (
    <div className={`flex flex-col gap-0.5 ${className}`}>
      <span className="field-label">{label}</span>
      <b className={`font-display text-xl font-bold leading-none tnum ${colour}`}>{value}</b>
    </div>
  );
}

/** Riga chiave-valore: etichetta a sinistra, numero a destra. */
export function KeyRow({
  label, value, sub, tone,
}: {
  label: ReactNode; value: ReactNode; sub?: string; tone?: 'accent' | 'green' | 'bad';
}) {
  const colour = tone === 'accent' ? 'text-accent' : tone === 'green' ? 'text-primary' : tone === 'bad' ? 'text-bad' : 'text-ink';
  return (
    <div className="flex items-baseline justify-between gap-3 py-[5px] border-b border-line/60 last:border-0">
      <div className="min-w-0">
        <div className="font-mono text-2xs text-muted truncate">{label}</div>
        {sub && <div className="font-mono text-[8.5px] text-dim truncate">{sub}</div>}
      </div>
      <div className={`font-mono text-2xs tnum shrink-0 ${colour}`}>{value}</div>
    </div>
  );
}

export function Bar({
  value, max = 100, colour = PALETTE.muted, height = 5, track = true,
}: { value: number; max?: number; colour?: string; height?: number; track?: boolean }) {
  const pct = Math.max(0, Math.min(100, (value / max) * 100));
  return (
    <div className={`w-full rounded-sm overflow-hidden ${track ? 'bg-panel3' : ''}`} style={{ height }}>
      <div className="h-full rounded-sm transition-[width] duration-300" style={{ width: `${pct}%`, background: colour }} />
    </div>
  );
}

/**
 * Riga di attributo: nome, valore, barra.
 *
 * Ogni attributo ha la propria tinta, presa dalla stessa scala validata per
 * daltonismo dei colori scuderia. Il colore non identifica nulla da solo: il
 * nome dell'attributo è sempre accanto alla barra.
 */
export const ATTRIBUTE_COLOURS: Record<AttributeKey, string> = {
  speed: PALETTE.aurora,
  consistency: PALETTE.vantar,
  tyres: PALETTE.kestrel,
  starts: PALETTE.mirage,
  wet: PALETTE.nordvik,
  technical: PALETTE.solaro,
  composure: PALETTE.brandt,
};

export function AttrRow({
  label, value, cap, colour, compact = false,
}: { label: string; value: number; cap?: number; colour: string; compact?: boolean }) {
  if (compact) {
    return (
      <div className="grid grid-cols-[1fr_auto] items-center gap-2 py-[3px]">
        <div className="min-w-0">
          <div className="font-mono text-[9.5px] text-muted truncate mb-[3px]">{label}</div>
          <Bar value={value} colour={colour} height={4} />
        </div>
        <span className="font-mono text-2xs text-ink tnum w-5 text-right">{Math.round(value)}</span>
      </div>
    );
  }
  return (
    <div className="py-1.5 border-b border-line/50 last:border-0">
      <div className="flex items-baseline justify-between gap-2">
        <span className="font-sans text-xs font-medium text-ink truncate">{label}</span>
        <span className="flex items-baseline gap-2 shrink-0">
          {cap !== undefined && <span className="font-mono text-[8.5px] text-dim">pot. {Math.round(cap)}</span>}
          <b className="font-display text-base font-bold tnum leading-none">{Math.round(value)}</b>
        </span>
      </div>
      <div className="mt-1">
        <Bar value={value} colour={colour} height={5} />
      </div>
      {cap !== undefined && (
        <div className="font-mono text-[8.5px] text-dim mt-[3px]">
          {cap - value > 0.05 ? `+${(cap - value).toFixed(1)} al potenziale` : 'al proprio tetto'}
        </div>
      )}
    </div>
  );
}

/** Pastiglia rotonda con la sigla del pilota, nel colore della scuderia. */
export function DriverBadge({ name, colour, size = 40 }: { name: string; colour: string; size?: number }) {
  const code = (name.split(' ').pop() ?? name).slice(0, 3).toUpperCase();
  return (
    <div
      className="rounded-full grid place-items-center shrink-0 font-display font-bold text-white"
      style={{ width: size, height: size, background: colour, fontSize: size * 0.34 }}
    >
      {code}
    </div>
  );
}

/** Riquadro con l'iniziale della scuderia. */
export function TeamBadge({ name, colour, size = 34 }: { name: string; colour: string; size?: number }) {
  return (
    <div
      className="rounded grid place-items-center shrink-0 font-display font-bold text-white"
      style={{ width: size, height: size, background: colour, fontSize: size * 0.45 }}
    >
      {name.replace(/^Scuderia\s+/i, '').charAt(0).toUpperCase()}
    </div>
  );
}

/** Pip di allocazione: quante sessioni su quante disponibili. */
export function Pips({ filled, total, colour = PALETTE.primary }: { filled: number; total: number; colour?: string }) {
  return (
    <div className="flex gap-[3px]">
      {Array.from({ length: total }, (_, i) => (
        <span
          key={i}
          className="h-[3px] flex-1 rounded-sm"
          style={{ background: i < filled ? colour : PALETTE.panel3 }}
        />
      ))}
    </div>
  );
}

export function Note({ children, tone = 'info' }: { children: ReactNode; tone?: 'info' | 'good' | 'warn' }) {
  const look = {
    info: 'bg-vantar/8 border-vantar text-vantar',
    good: 'bg-kestrel/8 border-kestrel text-kestrel',
    warn: 'bg-accent/8 border-accent text-accent',
  }[tone];
  return <div className={`border-l-2 px-2.5 py-2 text-[10.5px] leading-relaxed rounded-sm ${look}`}>{children}</div>;
}

/** Punto colorato della scuderia, usato nelle classifiche. */
export function TeamDot({ colour }: { colour: string }) {
  return <i className="block w-2 h-2 rounded-full shrink-0" style={{ background: colour }} />;
}
