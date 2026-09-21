import type { ReactNode } from 'react';

/** Primitive dell'interfaccia. Densità pensata per il telefono in orizzontale. */

export function Panel({
  title, tag, children, className = '', bodyClass = '',
}: {
  title?: string; tag?: ReactNode; children: ReactNode; className?: string; bodyClass?: string;
}) {
  return (
    <section className={`panel flex flex-col min-h-0 ${className}`}>
      {title && (
        <header className="panel-head shrink-0">
          <h2 className="panel-title">{title}</h2>
          {tag && <div className="font-mono text-2xs text-dim tnum">{tag}</div>}
        </header>
      )}
      <div className={`min-h-0 flex-1 ${bodyClass || 'p-3'}`}>{children}</div>
    </section>
  );
}

export function Btn({
  children, onClick, variant = 'ghost', disabled, className = '', title, testId,
}: {
  children: ReactNode; onClick?: () => void;
  variant?: 'ghost' | 'primary' | 'danger'; disabled?: boolean;
  className?: string; title?: string; testId?: string;
}) {
  const base =
    'font-display uppercase tracking-[0.1em] font-bold rounded-sm border px-3 py-2 text-sm disabled:opacity-35 disabled:cursor-not-allowed';
  const look =
    variant === 'primary'
      ? 'bg-aurora border-aurora text-white'
      : variant === 'danger'
        ? 'bg-transparent border-line text-bad'
        : 'bg-panel2 border-line text-ink';
  return (
    <button type="button" data-testid={testId} title={title} className={`${base} ${look} ${className}`} onClick={onClick} disabled={disabled}>
      {children}
    </button>
  );
}

export function Stat({ value, label, hint, accent }: { value: ReactNode; label: string; hint?: string; accent?: string }) {
  return (
    <div className="flex flex-col gap-0.5">
      <b className="font-display text-2xl font-bold leading-none tnum" style={accent ? { color: accent } : undefined}>
        {value}
      </b>
      <span className="text-2xs uppercase tracking-[0.14em] text-dim">{label}</span>
      {hint && <span className="font-mono text-2xs text-muted">{hint}</span>}
    </div>
  );
}

/**
 * Barra a valore singolo. L'estremità del dato è arrotondata e ancorata alla
 * base, il resto della traccia resta recessivo.
 */
export function Bar({ value, max = 100, colour = '#8B95A2', height = 8 }: { value: number; max?: number; colour?: string; height?: number }) {
  const pct = Math.max(0, Math.min(100, (value / max) * 100));
  return (
    <div className="w-full bg-panel2 rounded-sm overflow-hidden" style={{ height }}>
      <div className="h-full transition-[width] duration-300" style={{ width: `${pct}%`, background: colour, borderRadius: '0 4px 4px 0' }} />
    </div>
  );
}

export function Row({ label, value, sub }: { label: ReactNode; value: ReactNode; sub?: string }) {
  return (
    <div className="flex items-center justify-between gap-3 py-1.5 border-b border-line last:border-0">
      <div className="min-w-0">
        <div className="text-sm truncate">{label}</div>
        {sub && <div className="text-2xs text-dim truncate">{sub}</div>}
      </div>
      <div className="font-mono text-sm text-muted tnum shrink-0">{value}</div>
    </div>
  );
}

export function Note({ children, tone = 'info' }: { children: ReactNode; tone?: 'info' | 'good' | 'warn' }) {
  const look =
    tone === 'good'
      ? 'bg-good/10 border-good text-good'
      : tone === 'warn'
        ? 'bg-warn/10 border-warn text-warn'
        : 'bg-vantar/10 border-vantar text-vantar';
  return <div className={`border-l-2 px-3 py-2 text-xs leading-relaxed rounded-sm ${look}`}>{children}</div>;
}

export function TeamDot({ colour, className = '' }: { colour: string; className?: string }) {
  return <i className={`block w-[3px] h-4 rounded-sm shrink-0 ${className}`} style={{ background: colour }} />;
}
