import { useGame, type Screen } from '../../state/useGame.js';
import { Icon } from './icons.js';

const ITEMS: { id: Screen; label: string }[] = [
  { id: 'paddock', label: 'Paddock' },
  { id: 'pilota', label: 'Pilota' },
  { id: 'allenamento', label: 'Allena' },
  { id: 'finanze', label: 'Soldi' },
  { id: 'scuderia', label: 'Team' },
  { id: 'classifiche', label: 'Classif.' },
  { id: 'storia', label: 'Storia' },
];

/**
 * Navigazione verticale sul bordo sinistro: in orizzontale la larghezza
 * abbonda e l'altezza no, quindi la barra delle sezioni non può stare in alto.
 */
export function NavRail() {
  const screen = useGame((s) => s.screen);
  const goTo = useGame((s) => s.goTo);

  return (
    <nav className="w-[58px] shrink-0 border-r border-line bg-panel flex flex-col" aria-label="Sezioni">
      <div className="h-9 shrink-0 grid place-items-center border-b border-line">
        <span className="font-display text-lg font-bold text-aurora leading-none">F1</span>
      </div>
      <div className="flex-1 min-h-0 scroll-y py-1">
        {ITEMS.map((item) => {
          const active = screen === item.id;
          return (
            <button
              key={item.id}
              type="button"
              onClick={() => goTo(item.id)}
              aria-current={active ? 'page' : undefined}
              className={`w-full flex flex-col items-center gap-0.5 py-2 border-l-2 ${
                active ? 'border-aurora text-ink bg-panel2' : 'border-transparent text-dim'
              }`}
            >
              <Icon name={item.id} />
              <span className="text-2xs tracking-wide">{item.label}</span>
            </button>
          );
        })}
      </div>
    </nav>
  );
}
