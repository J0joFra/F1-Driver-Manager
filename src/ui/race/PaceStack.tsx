import { ChevronsDown, ChevronsRight, ChevronsUp, Zap } from 'lucide-react';
import { PALETTE } from '../palette.js';
import type { EngineMode } from '../../engine/types.js';
import type { LiveCar, LiveRace } from '../../engine/liveRace.js';
import { canAttack, isAttacking } from '../../engine/liveRace.js';

/**
 * Il passo, come colonna sul bordo.
 *
 * Tre livelli impilati, verde in basso e rosso in alto, sempre visibili e
 * sempre nello stesso posto. Prima erano tre pulsanti con su scritto
 * «Gestisci / Standard / Push» dentro un pannello in fondo allo schermo: si
 * leggevano, il che è il problema — durante una gara non si legge, si guarda.
 *
 * Le frecce dicono da sole quale spinge di più, il colore dice quanto costa, e
 * la posizione verticale dice che sono una scala e non tre opzioni qualunque.
 * Sta sul bordo perché è lì che arriva il pollice mentre l'altra mano tiene il
 * telefono.
 */
const LEVELS: { k: EngineMode; icon: typeof ChevronsUp; colour: string; hint: string }[] = [
  { k: 'push', icon: ChevronsUp, colour: PALETTE.bad, hint: 'Spinta: −0,35s al giro, gomme +35%, batteria giù' },
  { k: 'normal', icon: ChevronsRight, colour: PALETTE.warn, hint: 'Standard: passo di riferimento, batteria ferma' },
  { k: 'conserve', icon: ChevronsDown, colour: PALETTE.good, hint: 'Gestisci: più lento, gomme e batteria si recuperano' },
];

export function PaceStack({ race, car, onMode, onAttack }: {
  race: LiveRace;
  car: LiveCar;
  onMode: (m: EngineMode) => void;
  onAttack: () => void;
}) {
  const attacking = isAttacking(race, car);
  const ready = canAttack(race, car);
  // A batteria scarica la spinta non spinge: il livello resta scelto, ma va
  // detto — chi non lo vede pensa che il gioco lo stia ignorando.
  const flat = car.mode === 'push' && car.ers <= 0;

  return (
    <div className="flex flex-col gap-1 justify-center shrink-0 w-[46px]">
      {LEVELS.map((level) => {
        const active = car.mode === level.k;
        const Icon = level.icon;
        return (
          <button
            key={level.k}
            type="button"
            onClick={() => onMode(level.k)}
            aria-pressed={active}
            title={level.hint}
            data-testid={`pace-${level.k}`}
            className={`h-[38px] rounded-md border grid place-items-center transition ${
              active ? '' : 'bg-panel2 border-line'
            } ${active && flat ? 'animate-pulse' : ''}`}
            style={active
              ? { background: level.colour, borderColor: level.colour, color: '#FFFFFF' }
              : { color: level.colour }}
          >
            <Icon className="w-5 h-5" strokeWidth={2.4} />
          </button>
        );
      })}

      <button
        type="button"
        onClick={onAttack}
        disabled={!ready}
        title={attacking
          ? 'In attacco: +30% sorpasso'
          : ready ? 'Attacca: scarica la batteria in cambio di un sorpasso'
          : 'Serve più carica'}
        data-testid="attack"
        className={`h-[38px] rounded-md border grid place-items-center transition
          disabled:opacity-25 ${attacking
            ? 'bg-vantar border-vantar text-white animate-pulse'
            : 'bg-panel2 border-line text-vantar'}`}
      >
        <Zap className="w-5 h-5" strokeWidth={2.4} />
      </button>
    </div>
  );
}
