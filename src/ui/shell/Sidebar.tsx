import { BookOpen, CalendarDays, FileText, Flag, Gauge, Trophy, User, Wrench } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { useGame, type Screen } from '../../state/useGame.js';

/**
 * Barra delle sezioni: sole icone, sul bordo sinistro.
 *
 * In orizzontale l'altezza è la risorsa scarsa, quindi le sezioni stanno di
 * fianco; e sole icone perché 48 px di larghezza restituiscono l'intero
 * schermo al contenuto. Il nome compare nel tooltip e nell'etichetta ARIA.
 */
const ITEMS: { id: Screen; label: string; icon: LucideIcon }[] = [
  { id: 'paddock', label: 'Paddock', icon: Gauge },
  { id: 'pilota', label: 'Pilota', icon: User },
  { id: 'allenamento', label: 'Allenamento', icon: Flag },
  { id: 'finanze', label: 'Finanze', icon: CalendarDays },
  { id: 'scuderia', label: 'Scuderia', icon: Wrench },
  { id: 'classifiche', label: 'Classifiche', icon: FileText },
  { id: 'storia', label: 'Storia', icon: Trophy },
];

export function Sidebar() {
  const screen = useGame((s) => s.screen);
  const goTo = useGame((s) => s.goTo);

  return (
    <nav className="w-12 shrink-0 bg-panel border-r border-line flex flex-col items-center py-1.5 gap-0.5" aria-label="Sezioni">
      {ITEMS.map((item) => {
        const Icon = item.icon;
        const active = screen === item.id;
        return (
          <button
            key={item.id}
            type="button"
            onClick={() => goTo(item.id)}
            data-testid={`nav-${item.id}`}
            aria-current={active ? 'page' : undefined}
            aria-label={item.label}
            title={item.label}
            className={`relative w-9 h-9 grid place-items-center rounded transition-colors ${
              active ? 'bg-panel3 text-ink' : 'text-dim hover:text-muted hover:bg-white/5'
            }`}
          >
            {active && <span className="absolute left-[-6px] top-1.5 bottom-1.5 w-[2px] rounded-sm bg-primary" />}
            <Icon className="w-[17px] h-[17px]" strokeWidth={1.7} />
          </button>
        );
      })}
      <span className="flex-1" />
      <div className="text-dim/60" title="F1 Driver Manager">
        <BookOpen className="w-[17px] h-[17px]" strokeWidth={1.7} />
      </div>
    </nav>
  );
}
