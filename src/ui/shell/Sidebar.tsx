import {
  BarChart3, ChevronLeft, ChevronRight, ClipboardList, Dumbbell,
  History, LayoutDashboard, User, Wallet, Wrench,
} from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { useGame, type Screen } from '../../state/useGame.js';

/**
 * Navigazione laterale, per gruppi.
 *
 * In orizzontale la larghezza abbonda e l'altezza no, quindi le sezioni stanno
 * sul fianco e non in alto. Si può ridurre a sole icone quando serve spazio:
 * su 844×390 la versione estesa costa 136 px, che restano abbondanti.
 */

interface Item {
  id: Screen;
  label: string;
  icon: LucideIcon;
}

const GROUPS: { title: string; items: Item[] }[] = [
  {
    title: 'Carriera',
    items: [
      { id: 'paddock', label: 'Paddock', icon: LayoutDashboard },
      { id: 'pilota', label: 'Pilota', icon: User },
      { id: 'allenamento', label: 'Allena', icon: Dumbbell },
      { id: 'finanze', label: 'Finanze', icon: Wallet },
    ],
  },
  {
    title: 'Mondo',
    items: [
      { id: 'scuderia', label: 'Scuderia', icon: Wrench },
      { id: 'classifiche', label: 'Classifica', icon: BarChart3 },
      { id: 'storia', label: 'Storia', icon: History },
    ],
  },
];

export function Sidebar() {
  const screen = useGame((s) => s.screen);
  const goTo = useGame((s) => s.goTo);
  const collapsed = useGame((s) => s.sidebarCollapsed);
  const toggle = useGame((s) => s.toggleSidebar);

  return (
    <nav
      className={`shrink-0 bg-panel border-r border-line flex flex-col transition-[width] duration-200 ${
        collapsed ? 'w-[52px]' : 'w-[146px]'
      }`}
      aria-label="Sezioni"
    >
      <div className={`shrink-0 border-b border-line flex items-center ${collapsed ? 'justify-center px-1 py-2' : 'justify-between px-2.5 py-2'}`}>
        {!collapsed && (
          <div className="min-w-0">
            <div className="font-display text-base font-bold uppercase tracking-[0.1em] text-accent leading-none">
              F1 Driver
            </div>
            <div className="font-display text-2xs uppercase tracking-[0.18em] text-dim leading-none mt-0.5">
              Manager
            </div>
          </div>
        )}
        <button
          type="button"
          onClick={toggle}
          aria-label={collapsed ? 'Espandi il menu' : 'Riduci il menu'}
          className="rounded-md p-1 text-dim hover:text-ink hover:bg-white/5 transition-colors"
        >
          {collapsed ? <ChevronRight className="w-4 h-4" /> : <ChevronLeft className="w-4 h-4" />}
        </button>
      </div>

      <div className="flex-1 min-h-0 scroll-y py-1">
        {GROUPS.map((group) => (
          <div key={group.title} className="mb-1">
            {!collapsed && (
              <div className="px-2.5 pt-2 pb-1 font-display text-2xs font-bold uppercase tracking-[0.18em] text-dim">
                {group.title}
              </div>
            )}
            {collapsed && <div className="mx-3 my-1.5 border-t border-line" />}
            {group.items.map((item) => {
              const Icon = item.icon;
              const active = screen === item.id;
              return (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => goTo(item.id)}
                  data-testid={`nav-${item.id}`}
                  aria-current={active ? 'page' : undefined}
                  title={collapsed ? item.label : undefined}
                  className={`w-full flex items-center transition-colors ${
                    collapsed ? 'justify-center py-2' : 'gap-2.5 px-2.5 py-1.5'
                  } ${active ? 'bg-panel2 text-ink' : 'text-muted hover:text-ink hover:bg-white/5'}`}
                >
                  <span className={`shrink-0 ${active ? 'text-accent' : ''}`}>
                    <Icon className="w-[18px] h-[18px]" />
                  </span>
                  {!collapsed && (
                    <span className="font-display text-sm font-semibold uppercase tracking-[0.06em] truncate">
                      {item.label}
                    </span>
                  )}
                </button>
              );
            })}
          </div>
        ))}
      </div>

      {!collapsed && (
        <div className="shrink-0 border-t border-line px-2.5 py-1.5 flex items-center gap-1.5 text-dim">
          <ClipboardList className="w-3 h-3 shrink-0" />
          <span className="font-mono text-2xs truncate">salvataggio auto</span>
        </div>
      )}
    </nav>
  );
}
