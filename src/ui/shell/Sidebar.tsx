import {
  BookOpen, Building2, CalendarDays, Gauge, Trophy, Users, Wallet, Wrench, UserPlus,
} from 'lucide-react';
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
  { id: 'scuderia', label: 'Scuderia', icon: Building2 },
  { id: 'sviluppo', label: 'Sviluppo', icon: Wrench },
  { id: 'piloti', label: 'I tuoi piloti', icon: Users },
  { id: 'mercato', label: 'Mercato piloti', icon: UserPlus },
  { id: 'calendario', label: 'Calendario', icon: CalendarDays },
  { id: 'finanze', label: 'Bilancio', icon: Wallet },
  { id: 'classifiche', label: 'Classifiche', icon: Trophy },
  { id: 'storia', label: 'Storia', icon: BookOpen },
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
    </nav>
  );
}
