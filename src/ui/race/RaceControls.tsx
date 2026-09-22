import type { Compound, EngineMode } from '../../engine/types.js';
import type { LiveCar, LiveRace } from '../../engine/liveRace.js';
import { ATTACK_COOLDOWN, isAttacking } from '../../engine/liveRace.js';

const COMPOUNDS: { k: Compound; label: string; colour: string }[] = [
  { k: 'S', label: 'Soft', colour: '#E8283C' },
  { k: 'M', label: 'Medium', colour: '#F5C518' },
  { k: 'H', label: 'Hard', colour: '#E8EBF0' },
];

const MODES: { k: EngineMode; label: string }[] = [
  { k: 'conserve', label: 'Gestisci' },
  { k: 'normal', label: 'Standard' },
  { k: 'push', label: 'Push' },
];

/** I comandi della gara: gomme, motore, attacco. Tutto a portata di pollice. */
export function RaceControls({
  race, car, nextCompound, gapAhead, attackReadyAt,
  onCompound, onBox, onMode, onAttack,
}: {
  race: LiveRace;
  car: LiveCar;
  nextCompound: Compound;
  gapAhead: number | null;
  attackReadyAt: number;
  onCompound: (c: Compound) => void;
  onBox: () => void;
  onMode: (m: EngineMode) => void;
  onAttack: () => void;
}) {
  const attacking = isAttacking(race, car);
  const cooling = race.t < attackReadyAt;
  const canAttack = gapAhead !== null && gapAhead < 1 && !cooling && !attacking && !car.dnf;
  const wear = Math.min(100, car.tyre.wear);
  const wearColour = wear > 80 ? '#E8283C' : wear > 55 ? '#F5C518' : '#2FD98A';

  return (
    <div className="shrink-0 grid grid-cols-[1.15fr_1fr_0.9fr] gap-1.5" style={{ height: 74 }}>
      <div className="panel px-2 py-1.5 flex flex-col justify-between">
        <div className="flex items-center justify-between gap-2">
          <div className="flex gap-1">
            {COMPOUNDS.map((c) => (
              <button
                key={c.k}
                type="button"
                onClick={() => onCompound(c.k)}
                aria-pressed={nextCompound === c.k}
                className="font-display text-2xs font-bold uppercase tracking-wider px-2 py-1 rounded-sm border"
                style={
                  nextCompound === c.k
                    ? { background: c.colour, borderColor: c.colour, color: '#0D1114' }
                    : { background: '#1C232B', borderColor: '#293240', color: '#8B95A2' }
                }
              >
                {c.k}
              </button>
            ))}
          </div>
          <span className="font-mono text-2xs text-dim tnum">
            {car.tyre.compound} · {Math.round(car.tyre.wear)}%
          </span>
        </div>
        <div className="h-1.5 bg-panel2 rounded-sm overflow-hidden">
          <div className="h-full transition-[width] duration-300" style={{ width: `${wear}%`, background: wearColour }} />
        </div>
        <button
          type="button"
          onClick={onBox}
          className={`font-display text-xs font-bold uppercase tracking-[0.1em] py-1.5 rounded-sm border ${
            car.pitArmed ? 'bg-warn border-warn text-[#2B2200]' : 'bg-panel2 border-line text-ink'
          }`}
        >
          {car.pitArmed ? `Box armato · ${car.pitArmed}` : 'Box a fine giro'}
        </button>
      </div>

      <div className="panel px-2 py-1.5 flex flex-col justify-between">
        <span className="font-display text-2xs uppercase tracking-[0.15em] text-dim">Motore</span>
        <div className="grid grid-cols-3 gap-1">
          {MODES.map((m) => (
            <button
              key={m.k}
              type="button"
              onClick={() => onMode(m.k)}
              aria-pressed={car.mode === m.k}
              className={`font-display text-2xs font-bold uppercase tracking-wider py-1.5 rounded-sm border ${
                car.mode === m.k ? 'bg-ink border-ink text-ground' : 'bg-panel2 border-line text-muted'
              }`}
            >
              {m.label}
            </button>
          ))}
        </div>
        <span className="font-mono text-[9px] text-dim leading-tight">
          Push: −0.35s/giro, degrado +35%
        </span>
      </div>

      <div className="panel px-2 py-1.5 flex flex-col justify-between">
        <button
          type="button"
          onClick={onAttack}
          disabled={!canAttack}
          className="font-display text-sm font-bold uppercase tracking-[0.1em] py-2 rounded-sm border bg-aurora border-aurora text-white disabled:opacity-30"
        >
          {attacking ? 'In attacco' : cooling ? `Recupero ${Math.ceil(attackReadyAt - race.t)}s` : 'Attacca'}
        </button>
        <div className="font-mono text-[9px] text-dim leading-tight">
          {attacking
            ? '+30% sorpasso, degrado +50%'
            : gapAhead === null
              ? 'Sei al comando'
              : gapAhead < 1
                ? `DRS aperto · ${gapAhead.toFixed(2)}s`
                : `Davanti a ${gapAhead.toFixed(1)}s · serve < 1.00s`}
        </div>
        <span className="font-mono text-[9px] text-dim">Ricarica {ATTACK_COOLDOWN}s</span>
      </div>
    </div>
  );
}
