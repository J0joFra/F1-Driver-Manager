import { PALETTE } from '../palette.js';
import { useState } from 'react';
import type { Compound } from '../../engine/types.js';
import { applyStrategy, carOf, fastForward, liveResults } from '../../engine/liveRace.js';
import {
  DEFAULT_STRATEGY, STRATEGY_IDS, strategyFor, type StrategyId,
} from '../../engine/strategy.js';
import { SOFT_SETS } from '../../engine/qualifying.js';
import { currentRace } from '../../state/raceSession.js';
import { useGame } from '../../state/useGame.js';
import { Btn } from '../components/kit.js';
import { lapTime } from '../format.js';

const COMPOUND_COLOUR: Record<Compound, string> = { S: '#E8283C', M: '#F5C518', H: '#E8EBF0' };

const STRATEGIES: Record<StrategyId, { short: string; note: string }> = {
  conservativa: { short: 'Cons', note: 'una sosta, dura al via: niente crolli, ma paghi passo' },
  equilibrata: { short: 'Equil', note: 'una sosta, media poi dura: il compromesso' },
  aggressiva: { short: 'Aggr', note: 'due soste, morbida al via e in volata: veloce e fragile' },
};

/**
 * La griglia di partenza: l'unico momento in cui la qualifica si vede.
 *
 * Qui si scelgono le due strategie — una per pilota, non una per la scuderia —
 * e si decide se correre o simulare. La scelta serve perché le soste avvengano
 * da sole: una gara guardata senza premere niente deve restare una gara corsa.
 * Chi non tocca nulla parte con la strategia predefinita, già montata da
 * `createLiveRace`.
 */
export function GridScreen() {
  const world = useGame((s) => s.world)!;
  const startRace = useGame((s) => s.startRace);
  const completeRace = useGame((s) => s.completeRace);
  const session = currentRace();
  const [picks, setPicks] = useState<Record<string, StrategyId>>({});
  if (!session) return null;

  const { prepared, race } = session;
  // Le tue due monoposto, e quella che stai guardando. Gestendo una scuderia
  // non c'è «la tua macchina»: ce ne sono due, e la strategia si decide per
  // ciascuna.
  const myIds = world.seat.mode === 'scuderia'
    ? world.teams[world.seat.teamId]?.driverIds ?? []
    : [];
  const focus = useGame((s) => s.selected);
  const playerId = myIds.includes(focus ?? '') ? focus : myIds[0] ?? null;
  const myGrid = prepared.qualifying.find((q) => q.driverId === playerId)?.position ?? 0;
  const pole = prepared.qualifying[0];
  const myNote = prepared.qualifying.find((q) => q.driverId === playerId)?.note ?? null;

  // La strategia si applica alla vettura giusta, non a quella inquadrata: la
  // seconda monoposto è tua quanto la prima, e prima restava con la gomma
  // che le aveva dato il motore.
  const choose = (driverId: string, id: StrategyId) => {
    const car = carOf(race, driverId);
    if (!car) return;
    applyStrategy(car, strategyFor(prepared.track, id, car.entry.tyres));
    setPicks((p) => ({ ...p, [driverId]: id }));
  };

  const simulate = () => {
    fastForward(race);
    completeRace(liveResults(race), race.safetyCarsUsed);
  };

  return (
    <div className="h-full grid grid-cols-[1fr_1fr] gap-2 p-2 min-h-0">
      <div className="panel flex flex-col min-h-0">
        <div className="panel-head shrink-0">
          <h2 className="panel-title">Griglia di partenza</h2>
          <span className="font-mono text-2xs text-dim">
            {prepared.wet ? 'bagnato' : 'asciutto'} · {prepared.track.laps} giri
          </span>
        </div>
        <div className="flex-1 min-h-0 scroll-y">
          {prepared.qualifying.map((q) => {
            const d = world.drivers[q.driverId];
            const team = d?.teamId ? world.teams[d.teamId] : null;
            const mine = q.driverId === playerId;
            return (
              <div
                key={q.driverId}
                className={`grid grid-cols-[18px_3px_1fr_auto] items-center gap-2 px-2.5 py-1 border-b border-line last:border-0 ${
                  mine ? 'bg-aurora/15' : ''
                }`}
              >
                <span className={`font-display text-xs font-bold text-right tnum ${mine ? 'text-ink' : 'text-dim'}`}>
                  {q.position}
                </span>
                <i className="block w-[3px] h-3.5 rounded-sm" style={{ background: team?.colour ?? PALETTE.dim }} />
                <span className="font-display text-xs tracking-wide truncate">{d?.name ?? q.driverId}</span>
                <span className="font-mono text-[9px] text-dim tnum">
                  {q.position === 1
                    ? lapTime(q.lapTime)
                    : `+${(q.lapTime - (pole?.lapTime ?? q.lapTime)).toFixed(3)}`}
                </span>
              </div>
            );
          })}
        </div>
      </div>

      <div className="flex flex-col gap-2 min-h-0">
        <div className="panel p-3">
          <div className="font-display text-2xs tracking-[0.16em] text-aurora font-bold uppercase">
            Round {world.round + 1} · qualifica chiusa
          </div>
          <h1 className="font-display text-xl font-bold leading-tight mt-1">{prepared.track.name.toUpperCase()}</h1>
          <div className="font-mono text-2xs text-dim mt-1">
            Parti {myGrid ? `P${myGrid}` : '—'} su {prepared.qualifying.length}
            {prepared.wet && ' · pista bagnata'}
          </div>
          {/* L'esito delle tre decisioni di sabato: senza questo il giocatore
              sceglie al buio e non impara mai cosa gli è costato cosa. */}
          {myNote && (
            <div className={`font-mono text-2xs mt-1.5 ${
              myNote.includes('compromesso') ? 'text-bad' : 'text-kestrel'}`}
            >
              {myNote}
            </div>
          )}
        </div>

        <div className="panel p-3 flex-1 min-h-0 scroll-y">
          <h3 className="panel-title mb-2">Strategia</h3>
          {myIds.map((id) => {
            const d = world.drivers[id];
            const car = carOf(race, id);
            const pick = picks[id] ?? DEFAULT_STRATEGY;
            const plan = strategyFor(prepared.track, pick, car?.entry.tyres ?? 70);
            const stints: Compound[] = [plan.start, ...plan.fit];
            // Quello che il sabato ha lasciato: i treni di morbida nuova che
            // restano e l'usura con cui si va in griglia. Senza, la strategia
            // si sceglie ignorando metà delle premesse — e l'usura si scopre
            // in gara, quando non si può più farci niente.
            const q = prepared.qualifying.find((x) => x.driverId === id);
            const left = q?.softLeft ?? SOFT_SETS;
            const wear = Math.round(q?.startWear ?? 0);
            return (
              <div key={id} className="mb-2 last:mb-0">
                <div className="flex items-baseline gap-1.5 mb-1">
                  <span className="font-display text-2xs tracking-wide truncate">
                    {d?.name ?? id}
                  </span>
                  <span className="flex-1" />
                  {/* A nove pixel due pallini vuoti si leggono come un otto
                      coricato: i treni vanno scritti in cifre. */}
                  <span className="font-mono text-[9px] text-dim tnum shrink-0">
                    <span className={left === 0 ? 'text-bad' : ''}>{left}/{SOFT_SETS} soft</span>
                    {wear > 0 && (
                      <span className={wear >= 8 ? 'text-bad ml-1' : 'ml-1'}>· usura {wear}%</span>
                    )}
                  </span>
                </div>
                <div className="grid grid-cols-3 gap-1">
                  {STRATEGY_IDS.map((sid) => (
                    <button
                      key={sid}
                      type="button"
                      onClick={() => choose(id, sid)}
                      aria-pressed={pick === sid}
                      data-testid={`strategy-${id}-${sid}`}
                      className={`font-display text-2xs font-bold uppercase tracking-wider py-1.5 rounded-sm border ${
                        pick === sid
                          ? 'bg-aurora border-aurora text-ink'
                          : 'bg-panel2 border-line text-dim'
                      }`}
                    >
                      {STRATEGIES[sid].short}
                    </button>
                  ))}
                </div>
                {/* Il piano in chiaro: mescole e giri di sosta. Una strategia
                    che non dici quando ti ferma non è una scelta. */}
                <div className="flex items-center gap-1 mt-1 font-mono text-[9px] text-dim">
                  {stints.map((c, i) => (
                    <span key={i} className="flex items-center gap-1">
                      {i > 0 && <span className="text-line">›</span>}
                      <i
                        className="inline-block w-2 h-2 rounded-full"
                        style={{ background: COMPOUND_COLOUR[c] }}
                      />
                      {c}
                    </span>
                  ))}
                  <span className="ml-1 tnum">
                    {plan.stops.length > 0 ? `box g. ${plan.stops.join(', ')}` : 'nessuna sosta'}
                  </span>
                </div>
              </div>
            );
          })}
          <p className="font-mono text-2xs text-dim mt-1 leading-relaxed">
            {STRATEGIES[picks[playerId ?? ''] ?? DEFAULT_STRATEGY].note}
          </p>
        </div>

        <div className="flex gap-2 shrink-0">
          <Btn variant="primary" onClick={startRace} className="flex-1 py-3" testId="go-racing">Vai in pista</Btn>
          <Btn onClick={simulate} className="py-3" testId="simulate-race">Simula</Btn>
        </div>
      </div>
    </div>
  );
}
