import { PALETTE } from '../palette.js';
import { breaksCompoundRule } from '../../engine/rules.js';
import type { Compound } from '../../engine/types.js';
import type { LiveCar, LiveRace } from '../../engine/liveRace.js';
import { ERS_MAX, order, tyreLapsLeft } from '../../engine/liveRace.js';

/**
 * Le due monoposto, in basso, una scheda ciascuna.
 *
 * Prima si vedeva una vettura sola e si passava all'altra da un pulsante nella
 * riga di stato. Ma una scuderia ne schiera due, e le decisioni che contano
 * sono quasi sempre **relative**: chiamo questa ai box adesso o aspetto che
 * passi l'altra? Con una vettura sola sullo schermo quella domanda non si può
 * nemmeno formulare.
 *
 * Ogni scheda dice tre cose e nient'altro: dove sei, quanto ti restano le
 * gomme, quanta carica hai. Sono le tre che decidono tutto il resto.
 */

const TYRE_COLOUR: Record<Compound, string> = {
  S: PALETTE.tyreSoft, M: PALETTE.tyreMedium, H: PALETTE.tyreHard,
};

/** Quanti giri di gomma si considerano «tanti»: oltre, la barra è piena. */
const FULL_STINT = 18;

/**
 * Da quando avvisare che manca la seconda mescola.
 *
 * Non dal primo giro. All'inizio della gara *nessuno* ha ancora usato due
 * mescole, quindi l'avviso era acceso sempre — e un allarme sempre acceso non
 * è un allarme, è una decorazione. Si accende nell'ultimo terzo, quando
 * scordarsene comincia davvero a costare.
 */
const WARN_FROM = 0.66;

export function CarCards({
  race, cars, focusId, driverName, nextCompound, onFocus, onBox, onCompound,
}: {
  race: LiveRace;
  cars: LiveCar[];
  focusId: string | null;
  driverName: (id: string) => string;
  nextCompound: Compound;
  onFocus: (id: string) => void;
  onBox: (car: LiveCar) => void;
  onCompound: (c: Compound) => void;
}) {
  const table = order(race);

  return (
    <div className="shrink-0 grid gap-1.5" style={{
      height: 70, gridTemplateColumns: `repeat(${Math.max(1, cars.length)}, minmax(0, 1fr))`,
    }}>
      {cars.map((car) => {
        const id = car.entry.driverId;
        const focused = id === focusId;
        const pos = table.indexOf(car) + 1;
        const laps = tyreLapsLeft(race, car);
        const ers = car.ers / ERS_MAX;
        // La regola delle due mescole si dice prima, non si scopre a fine
        // gara: una penalità che non potevi vedere arrivare è una punizione.
        const late = car.lap / race.track.laps >= WARN_FROM;
        const mustChange = late && !race.wet
          && breaksCompoundRule([...car.compounds, car.tyre.compound], race.wet);

        return (
          <div
            key={id}
            className={`panel px-2 py-1 flex flex-col gap-1 transition ${
              focused ? 'border-primary' : ''
            } ${car.dnf ? 'opacity-45' : ''}`}
          >
            {/* Tre righe e non quattro: a 390 px di altezza la quarta
                sfondava di nove pixel, e la batteria sta benissimo accanto al
                nome — è un indicatore da guardare, non da leggere. */}
            <button
              type="button"
              onClick={() => onFocus(id)}
              data-testid={`card-${id}`}
              className="flex items-center gap-1.5 text-left min-w-0"
            >
              <span className="font-display text-sm font-bold tnum shrink-0">
                {car.dnf ? '—' : `P${pos}`}
              </span>
              <span className="font-sans text-2xs font-semibold truncate">
                {driverName(id).split(' ').at(-1)}
              </span>
              <span className="flex-1" />
              <span className="font-display text-[8px] font-bold text-vantar shrink-0">ERS</span>
              <span className="w-[42px] h-[6px] rounded-sm bg-panel3 overflow-hidden shrink-0">
                <span
                  className="block h-full rounded-sm transition-[width] duration-200"
                  style={{ width: `${ers * 100}%`, background: PALETTE.vantar }}
                />
              </span>
              <span className="font-mono text-[9px] text-dim tnum shrink-0 w-[26px] text-right">
                {Math.round(ers * 100)}%
              </span>
            </button>

            {/* Le gomme, in giri. È il numero su cui si decide. */}
            <div className="flex items-center gap-1.5">
              <span
                className="w-[16px] h-[16px] rounded-full grid place-items-center shrink-0
                  font-display text-[9px] font-bold text-white"
                style={{ background: TYRE_COLOUR[car.tyre.compound] }}
              >
                {car.tyre.compound}
              </span>
              <div className="flex-1 h-[7px] rounded-sm bg-panel3 overflow-hidden">
                <div
                  className="h-full rounded-sm transition-[width] duration-300"
                  style={{
                    width: `${Math.min(100, (laps / FULL_STINT) * 100)}%`,
                    background: laps < 2 ? PALETTE.bad : laps < 5 ? PALETTE.warn : PALETTE.good,
                  }}
                />
              </div>
              <span className={`font-mono text-2xs tnum shrink-0 ${laps < 2 ? 'text-bad' : ''}`}>
                {laps >= 20 ? '20+' : laps.toFixed(1)}
                <span className="text-dim"> giri</span>
              </span>
            </div>

            <div className="flex items-center gap-1 mt-auto">
              {/* La mescola della prossima sosta si sceglie qui accanto al
                  pulsante che la monta: separarli faceva armare il box con la
                  gomma scelta per l'altra vettura. */}
              {(['S', 'M', 'H'] as const).map((c) => (
                <button
                  key={c}
                  type="button"
                  onClick={() => { onFocus(id); onCompound(c); }}
                  aria-pressed={focused && nextCompound === c}
                  data-testid={`compound-${c}`}
                  className="w-[19px] h-[19px] rounded-full border font-display text-[9px] font-bold shrink-0"
                  style={focused && nextCompound === c
                    ? { background: TYRE_COLOUR[c], borderColor: TYRE_COLOUR[c], color: '#FFFFFF' }
                    : { borderColor: '#D5DAE2', color: TYRE_COLOUR[c] }}
                >
                  {c}
                </button>
              ))}
              <button
                type="button"
                onClick={() => onBox(car)}
                disabled={car.dnf}
                data-testid={`box-${id}`}
                title={mustChange
                  ? 'Servono due mescole diverse: 25″ di penalità se finisci senza'
                  : undefined}
                className={`flex-1 rounded font-display text-2xs font-bold uppercase tracking-[0.08em]
                  py-1 border transition disabled:opacity-30 ${
                    car.pitArmed
                      ? 'bg-warn border-warn text-white'
                      : mustChange
                        ? 'bg-panel2 border-warn text-warn'
                        : 'bg-ink border-ink text-white'
                  }`}
              >
                {car.pitArmed ? `Box · ${car.pitArmed}` : mustChange ? 'Box · 2ª mescola' : 'Pit stop'}
              </button>
            </div>
          </div>
        );
      })}
    </div>
  );
}
