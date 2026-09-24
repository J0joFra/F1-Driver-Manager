import { PALETTE } from '../palette.js';
import { useCallback, useEffect, useReducer, useRef, useState } from 'react';
import type { Compound, EngineMode } from '../../engine/types.js';
import {
  ATTACK_COOLDOWN, carOf, fastForward, gapBetween, isAttacking, liveResults,
  order, setMode, startAttack, stepRace, underSafetyCar,
} from '../../engine/liveRace.js';
import { currentRace } from '../../state/raceSession.js';
import { useGame } from '../../state/useGame.js';
import { TrackMap } from './TrackMap.js';
import { TimingTower } from './TimingTower.js';
import { GapStrip } from './GapStrip.js';
import { RaceControls } from './RaceControls.js';

/** Il ritmo a cui scorre la gara. 0 = in pausa. */
/**
 * La velocità si misura in **giri al secondo**, non in secondi di gara al
 * secondo reale. È l'unità che conta per chi guarda: «un giro al secondo» si
 * capisce, «otto volte più veloce» dipende da quanto è lungo il giro — a
 * Monaco erano nove secondi a giro, a Spa quindici.
 */
const SPEEDS = [0, 0.5, 1, 2] as const;
const SPEED_LABEL: Record<number, string> = { 0: 'II', 0.5: '½', 1: '1×', 2: '2×' };

/**
 * Quando succede qualcosa la gara rallenta, e qui si misura in secondi di
 * gara al secondo reale — perché quello che va guardato è un fatto che dura
 * dei secondi, non dei giri. La sosta è il momento più lento di tutti: venti
 * secondi di pit stop diventano cinque secondi veri, il tempo di vederla.
 */
const PACE_PIT = 4;
const PACE_KEY = 14;
/** Ridisegnare a 60 fps non serve: la gara si legge benissimo a 15. */
const FRAME_MS = 66;

export function RaceView({ onFinish }: { onFinish: (results: ReturnType<typeof liveResults>, safetyCars: number) => void }) {
  const session = currentRace();
  const world = useGame((s) => s.world)!;
  const [, redraw] = useReducer((x: number) => x + 1, 0);
  const [speed, setSpeed] = useState<(typeof SPEEDS)[number]>(1);
  const [nextCompound, setNextCompound] = useState<Compound>('M');
  const [attackReadyAt, setAttackReadyAt] = useState(0);
  const lastFrame = useRef(0);
  const finished = useRef(false);

  const race = session?.race ?? null;
  // Le tue due monoposto, e quella che stai guardando. Gestendo una scuderia
  // non c'è «la tua macchina»: ce ne sono due, e la strategia si decide per
  // ciascuna.
  const myIds = world.seat.mode === 'scuderia'
    ? world.teams[world.seat.teamId]?.driverIds ?? []
    : [];
  const focus = useGame((s) => s.selected);
  const select = useGame((s) => s.select);
  const playerId = myIds.includes(focus ?? '') ? focus : myIds[0] ?? null;
  const me = race && playerId ? carOf(race, playerId) ?? null : null;

  const rows = race ? order(race) : [];
  const myIndex = me ? rows.indexOf(me) : -1;
  const ahead = myIndex > 0 ? rows[myIndex - 1]! : null;
  const behind = myIndex >= 0 && myIndex < rows.length - 1 ? rows[myIndex + 1]! : null;
  const gapAhead = race && me && ahead ? gapBetween(race, ahead, me) : null;
  const gapBehind = race && me && behind ? gapBetween(race, me, behind) : null;

  /**
   * Il momento chiave: quando succede qualcosa che merita una decisione, la
   * gara rallenta da sola a 1×. È questo che rende guardabile una gara da 53
   * giri senza chiedere al giocatore di stare sempre sul pezzo.
   */
  const inPit = !!race && !!me && race.t < me.pitUntil;

  const keyMoment =
    !race || !me || me.dnf
      ? null
      : inPit
        ? 'Sosta ai box'
        : me.pitArmed
          ? 'Box a fine giro'
          : underSafetyCar(race)
            ? 'Safety car · finestra box'
            : me.tyre.wear > 84
              ? 'Gomme finite · decidi'
              : gapAhead !== null && gapAhead < 1
                ? 'In zona DRS'
                : gapBehind !== null && gapBehind < 0.8
                  ? 'Sotto attacco'
                  : null;

  useEffect(() => {
    if (!race) return;
    let raf = 0;
    let last = performance.now();
    const loop = (now: number) => {
      raf = requestAnimationFrame(loop);
      const dt = Math.min(0.1, (now - last) / 1000);
      last = now;
      if (speed > 0 && !race.finished) {
        // Fuori dai momenti chiave si va a giri al secondo; dentro, a secondi
        // di gara al secondo reale. Sono due unità diverse perché sono due
        // cose diverse: scorrere una gara e guardare un fatto.
        const rate = inPit ? PACE_PIT : keyMoment ? PACE_KEY : speed * race.track.baseLap;
        const simSeconds = dt * rate;
        // Passi piccoli e costanti: l'esito non deve dipendere dal frame rate.
        const steps = Math.max(1, Math.ceil(simSeconds / 0.25));
        for (let i = 0; i < steps; i++) stepRace(race, simSeconds / steps);
      }
      if (race.finished && !finished.current) {
        finished.current = true;
        onFinish(liveResults(race), race.safetyCarsUsed);
        return;
      }
      if (now - lastFrame.current >= FRAME_MS) {
        lastFrame.current = now;
        redraw();
      }
    };
    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
  }, [race, speed, keyMoment, inPit, onFinish]);

  const skip = useCallback(() => {
    if (!race || finished.current) return;
    fastForward(race);
    finished.current = true;
    onFinish(liveResults(race), race.safetyCarsUsed);
  }, [race, onFinish]);

  if (!race || !session) return null;

  const teamColour = (driverId: string) => {
    const teamId = race.cars.find((c) => c.entry.driverId === driverId)?.entry.teamId;
    return (teamId && world.teams[teamId]?.colour) || PALETTE.dim;
  };
  const driverName = (driverId: string) => world.drivers[driverId]?.name ?? driverId;

  return (
    <div className="h-full flex flex-col gap-1.5 p-2">
      <header className="h-7 shrink-0 flex items-center gap-2.5 text-xs">
        <span className="font-display text-base font-bold tnum">
          G{race.lap}
          <span className="text-dim text-xs">/{race.track.laps}</span>
        </span>
        <span className="font-display text-sm tracking-wide truncate max-w-[180px]">
          {session.prepared.track.name.toUpperCase()}
        </span>
        <span
          className={`font-display text-2xs font-bold uppercase tracking-[0.14em] px-2 py-0.5 rounded-sm ${
            underSafetyCar(race) ? 'bg-warn text-[#2B2200] animate-pulse' : 'bg-good text-[#06261A]'
          }`}
        >
          {underSafetyCar(race) ? 'Safety car' : 'Verde'}
        </span>
        {me && (
          <span className="font-mono text-2xs text-muted tnum">
            P{myIndex + 1} · {me.tyre.compound} {Math.round(me.tyre.wear)}%
          </span>
        )}
        <span className="flex-1" />
        <div className="flex gap-1">
          {SPEEDS.map((s) => (
            <button
              key={s}
              type="button"
              onClick={() => setSpeed(s)}
              aria-pressed={speed === s}
              className={`font-mono text-2xs px-2 py-1 rounded-sm border ${
                speed === s ? 'bg-ink border-ink text-ground' : 'bg-panel2 border-line text-muted'
              }`}
            >
              {SPEED_LABEL[s]}
            </button>
          ))}
        </div>
        {/* Le due monoposto: la strategia si decide per ciascuna, quindi da
            qui si passa dall'una all'altra senza uscire dalla gara. */}
        {myIds.length > 1 && (
          <div className="flex gap-0.5">
            {myIds.map((id, i) => {
              const d = world.drivers[id];
              const car = race ? carOf(race, id) : undefined;
              const pos = car ? order(race!).indexOf(car) + 1 : 0;
              return (
                <button
                  key={id}
                  type="button"
                  data-testid={`focus-car-${i}`}
                  onClick={() => select(id)}
                  className={`font-mono text-2xs px-2 py-1 rounded-sm border ${
                    id === playerId ? 'bg-ink border-ink text-ground' : 'bg-panel2 border-line text-muted'
                  }`}
                >
                  {(d?.name ?? '').split(' ').at(-1)}{pos > 0 ? ` P${pos}` : ''}
                </button>
              );
            })}
          </div>
        )}
        <button
          type="button"
          data-testid="skip-race"
          onClick={skip}
          className="font-display text-2xs font-bold uppercase tracking-[0.1em] px-2.5 py-1 rounded-sm border border-line bg-panel2 text-muted"
        >
          Simula il resto
        </button>
      </header>

      <div className="flex-1 min-h-0 grid grid-cols-[1fr_168px] gap-1.5">
        <div className="flex flex-col gap-1.5 min-h-0">
          <TrackMap race={race} teamColour={teamColour} driverName={driverName} playerId={playerId} keyMoment={keyMoment} />
          <GapStrip race={race} teamColour={teamColour} playerId={playerId} />
        </div>
        <TimingTower race={race} teamColour={teamColour} driverName={driverName} playerId={playerId} />
      </div>

      {me ? (
        <RaceControls
          race={race}
          car={me}
          nextCompound={nextCompound}
          gapAhead={gapAhead}
          attackReadyAt={attackReadyAt}
          onCompound={setNextCompound}
          onBox={() => {
            me.pitArmed = me.pitArmed ? null : nextCompound;
            redraw();
          }}
          onMode={(m: EngineMode) => {
            setMode(me, m);
            redraw();
          }}
          onAttack={() => {
            if (isAttacking(race, me)) return;
            startAttack(race, me);
            setAttackReadyAt(race.t + ATTACK_COOLDOWN);
          }}
        />
      ) : (
        <div className="panel shrink-0 grid place-items-center text-xs text-dim" style={{ height: 74 }}>
          Non sei in gara: stai guardando il mondo correre.
        </div>
      )}
    </div>
  );
}
