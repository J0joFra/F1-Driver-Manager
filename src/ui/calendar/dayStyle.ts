import {
  Bed, CalendarDays, Dumbbell, Flag, HeartPulse, Moon, Plane, Sun, Timer, Wrench,
} from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import type { DayKind } from '../../engine/days.js';

/**
 * Come si vede una giornata.
 *
 * Il colore porta informazione, non decorazione: il weekend è acceso perché è
 * quello che il giocatore cerca scorrendo il mese, il riposo è spento perché
 * non chiede niente. Con caselle alte trenta pixel il colore si legge prima
 * del testo, quindi deve dire la verità da solo.
 */
export const DAY_STYLE: Record<DayKind, { chip: string; icon: LucideIcon }> = {
  race:       { chip: 'bg-aurora/25 text-aurora border-l-2 border-aurora', icon: Flag },
  qualifying: { chip: 'bg-nordvik/20 text-nordvik border-l-2 border-nordvik', icon: Timer },
  practice:   { chip: 'bg-solaro/18 text-solaro border-l-2 border-solaro', icon: Timer },
  training:   { chip: 'bg-vantar/15 text-vantar', icon: Dumbbell },
  test:       { chip: 'bg-panel3 text-muted', icon: Wrench },
  minigame:   { chip: 'bg-accent/15 text-accent', icon: Timer },
  recovery:   { chip: 'bg-primary/15 text-primary', icon: HeartPulse },
  travel:     { chip: 'text-dim', icon: Plane },
  rest:       { chip: 'text-dim', icon: Bed },
  break:      { chip: 'bg-accent/10 text-accent/70', icon: Sun },
};

export const FALLBACK_STYLE = { chip: 'text-dim', icon: CalendarDays };
export const NIGHT_ICON = Moon;
