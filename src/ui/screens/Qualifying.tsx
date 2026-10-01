import { useMemo, useState } from 'react';
import { Flag, Timer } from 'lucide-react';
import { PALETTE } from '../palette.js';
import { useGame } from '../../state/useGame.js';
import { nextRace } from '../../engine/selectors.js';
import {
  affordable, COMPOUNDS, cutAt, currentSegment, DEFAULT_PLAN, isOver, OUT_LAPS,
  pressureOf, TIMINGS,
  type Choice, type QualCompound, type QualifyingPlan, type QualiSession,
} from '../../engine/qualifying.js';
import {
  beginQualifyingFor, qualifyingGrid, runQualifyingSegment,
} from '../../state/qualiSession.js';
import { lapTime } from '../format.js';

const COMPOUND_COLOUR: Record<QualCompound, string> = {
  S: '#E8283C', Su: '#9B2030', M: '#F5C518',
};

/**
 * La qualifica, sabato: tre manche, non un modulo da compilare.
 *
 * Prima era una schermata sola: si sceglievano tre cose una volta, si premeva
 * un pulsante e la griglia compariva già fatta. Le manche esistevano nel
 * motore — `SEGMENTS`, `segmentFor`, `pressureOf` — e non le usava nessuno:
 * erano state scritte per una qualifica che poi non è mai stata costruita.
 *
 * Adesso si gioca Q1, Q2 e Q3 una alla volta. Fra una e l'altra si vede dove
 * si è finiti, chi è fuori e quanti treni di morbida restano, e **poi** si
 * decide la manche dopo. È la differenza fra scegliere e indovinare: la stessa
 * decisione presa sapendo di essere quartultimo non è la stessa decisione.
 */
export function Qualifying({ onDone }: { onDone: () => void }) {
  const world = useGame((s) => s.world)!;
  const finish = useGame((s) => s.finishQualifying);
  const race = nextRace(world);

  const session = useMemo(
    () => (race ? beginQualifyingFor(world, race.trackId) : null),
    // La sessione si costruisce una volta per gara: ricrearla a ogni render
    // rigirerebbe le manche già corse.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [race?.trackId],
  );

  const myIds = world.seat.mode === 'scuderia'
    ? world.teams[world.seat.teamId]?.driverIds ?? []
    : [];

  const [plans, setPlans] = useState<Record<string, QualifyingPlan>>(
    () => Object.fromEntries(myIds.map((id) => [id, DEFAULT_PLAN])),
  );
  // `tick` esiste perché la sessione è un oggetto mutato in posto, fuori da
  // React: senza, correre una manche non ridisegnerebbe niente.
  const [tick, setTick] = useState(0);
  const [shown, setShown] = useState(false);

  if (!session || !race) return null;
  const seg = currentSegment(session);

  const run = () => {
    runQualifyingSegment(session, plans);
    setShown(true);
    setTick(tick + 1);
  };

  const next = () => {
    if (isOver(session)) {
      finish(qualifyingGrid(session));
      onDone();
      return;
    }
    setShown(false);
    setTick(tick + 1);
  };

  return (
    <div className="h-full flex flex-col gap-2 min-h-0">
      <Header session={session} shown={shown} />

      <div className="flex-1 grid grid-cols-[minmax(0,1fr)_minmax(0,300px)] gap-2 min-h-0">
        <Standings session={session} mine={myIds} shown={shown} />

        <div className="flex flex-col gap-1.5 min-h-0">
          <div className="flex-1 min-h-0 scroll-y flex flex-col gap-1.5">
            {myIds.map((id) => (
              <DriverPlan
                key={id}
                session={session}
                driverId={id}
                plan={plans[id] ?? DEFAULT_PLAN}
                locked={shown}
                onPick={(p) => setPlans({ ...plans, [id]: p })}
              />
            ))}
          </div>

          <button
            type="button"
            data-testid={shown ? 'qual-next' : 'go-qualifying'}
            onClick={shown ? next : run}
            className="h-[36px] shrink-0 rounded bg-primary text-white font-sans text-sm font-bold
              inline-flex items-center justify-center gap-2 hover:brightness-110 transition"
          >
            <Flag className="w-4 h-4" />
            {!shown ? `Vai in pista · ${seg?.key ?? ''}`
              : isOver(session) ? 'Alla griglia'
                : `Avanti · ${currentSegment(session)?.key ?? ''}`}
          </button>
        </div>
      </div>
    </div>
  );
}

/** Che manche è, cosa c'è in palio e dov'è la linea. */
function Header({ session, shown }: { session: QualiSession; shown: boolean }) {
  // Dopo il giro la sessione è già avanzata alla manche dopo, ma quello che si
  // sta guardando è l'esito di quella appena corsa: l'intestazione deve dire
  // Q1 mentre si legge il risultato di Q1, non Q2.
  const seg = shown ? session.segments[session.segment - 1] ?? null : currentSegment(session);
  const track = session.track;
  return (
    <div className="shrink-0 panel flex items-center gap-3 px-3 py-1.5">
      <Timer className="w-4 h-4 text-primary shrink-0" />
      <div className="min-w-0">
        <div className="font-display text-base font-bold leading-none">
          {seg ? seg.key : 'Griglia'} · {track.name}
        </div>
        <div className="font-mono text-2xs text-muted truncate">
          {shown ? 'Manche chiusa' : seg ? seg.stake : 'La qualifica è chiusa'}
          {session.wet && ' · pista bagnata'}
        </div>
      </div>
      <span className="flex-1" />
      <div className="text-center px-2 shrink-0">
        <div className="font-display text-base font-bold leading-none tnum">
          {Math.round(track.overtaking * 100)}%
        </div>
        <div className="field-label mt-0.5">Sorpassi</div>
      </div>
      {/*
        * Quanto convenga rischiare non è una costante: dipende da quanto è
        * difficile rimediare la domenica. Su un cittadino la pole vale una
        * gara, su una pista di potenza una fila persa si recupera al primo
        * rettilineo.
        */}
      <p className="font-mono text-[9px] text-dim leading-tight max-w-[168px] hidden md:block shrink-0">
        {shown ? 'Guarda dove sei finito, poi decidi la manche dopo.'
          : track.overtaking < 0.32
            ? 'Qui in gara non si passa: la pole vale doppio, conviene rischiare.'
            : track.overtaking > 0.52
              ? 'Qui si sorpassa: una fila persa si recupera, non serve strafare.'
              : 'Tracciato onesto: la posizione conta, ma non decide tutto.'}
      </p>
    </div>
  );
}

/**
 * La classifica della manche, con la linea del taglio dove cade davvero.
 *
 * Prima del primo giro non c'è niente da ordinare: si mostra chi è in pista
 * nell'ordine in cui è arrivato dalla manche precedente, che è l'informazione
 * che serve a decidere.
 */
function Standings({ session, mine, shown }: {
  session: QualiSession; mine: readonly string[]; shown: boolean;
}) {
  const world = useGame((s) => s.world)!;
  const cut = cutAt(session);
  const rows = shown || isOver(session)
    ? [...session.alive, ...session.tail.slice(0, session.tail.length)]
    : session.alive;
  // Dopo una manche la lista è già tagliata: i superstiti stanno in `alive` e
  // chi è uscito in `tail`, quindi la linea cade sulla lunghezza di `alive`.
  const line = shown || isOver(session) ? session.alive.length : cut;
  const best = session.state[rows[0] ?? '']?.lap ?? 0;

  return (
    <section className="panel flex flex-col min-h-0">
      <header className="panel-head shrink-0">
        <h2 className="panel-title">{shown ? 'Esito della manche' : 'In pista'}</h2>
        <span className="font-mono text-2xs text-dim tnum">
          {rows.length} vetture
        </span>
      </header>
      <div className="flex-1 min-h-0 scroll-y">
        {rows.map((id, i) => {
          const d = world.drivers[id];
          const team = d?.teamId ? world.teams[d.teamId] : null;
          const st = session.state[id]!;
          const ours = mine.includes(id);
          const out = i >= line;
          return (
            <div key={id}>
              {i === line && line < rows.length && (
                <div className="flex items-center gap-2 px-2.5 py-0.5 bg-bad/10">
                  <span className="h-px flex-1 bg-bad/50" />
                  <span className="font-display text-[9px] tracking-[0.14em] uppercase text-bad">
                    taglio
                  </span>
                  <span className="h-px flex-1 bg-bad/50" />
                </div>
              )}
              <div
                className={`grid grid-cols-[18px_3px_1fr_auto_auto] items-center gap-2 px-2.5 py-1
                  border-b border-line last:border-0 ${ours ? 'bg-aurora/15' : ''} ${
                  out ? 'opacity-45' : ''}`}
              >
                <span className={`font-display text-xs font-bold text-right tnum ${
                  ours ? 'text-ink' : 'text-dim'}`}
                >
                  {i + 1}
                </span>
                <i className="block w-[3px] h-3.5 rounded-sm"
                  style={{ background: team?.colour ?? PALETTE.dim }} />
                <span className="font-display text-xs tracking-wide truncate">
                  {d?.name ?? id}
                </span>
                {st.compound && (
                  <i className="w-2 h-2 rounded-full"
                    style={{ background: COMPOUND_COLOUR[st.compound] }} />
                )}
                <span className="font-mono text-[9px] text-dim tnum">
                  {st.lap === null ? '—'
                    : i === 0 ? lapTime(st.lap)
                      : `+${(st.lap - best).toFixed(3)}`}
                </span>
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
}

/**
 * Le tre decisioni di un pilota, più quello che gli resta da spendere.
 *
 * I treni si mostrano perché la mescola è una decisione solo se si sa quanti
 * ne restano: offrire «Soft nuova» quando non ce n'è più è un modo elegante di
 * mentire, quindi il tasto si disabilita e `affordable` racconta su cosa si
 * finirebbe davvero.
 */
function DriverPlan({ session, driverId, plan, locked, onPick }: {
  session: QualiSession;
  driverId: string;
  plan: QualifyingPlan;
  locked: boolean;
  onPick: (p: QualifyingPlan) => void;
}) {
  const world = useGame((s) => s.world)!;
  const st = session.state[driverId]!;
  const d = world.drivers[driverId];
  const seg = currentSegment(session);
  const rank = session.alive.indexOf(driverId) + 1;
  const alive = rank > 0;
  const danger = seg && alive ? pressureOf(seg, rank, session.alive.length) : 0;

  return (
    <div className={`panel p-2 shrink-0 ${alive ? '' : 'opacity-50'}`}>
      <div className="flex items-baseline gap-1.5">
        <span className="font-display text-xs font-bold truncate">{d?.name ?? driverId}</span>
        {/* Il pericolo sta accanto al nome e non su una riga sua: due righe di
            avviso, una per pilota, mangiavano lo spazio delle decisioni. */}
        {alive && !locked && danger > 0.7 && (
          <span className="font-display text-[9px] uppercase tracking-wide text-bad shrink-0">
            a rischio
          </span>
        )}
        <span className="flex-1" />
        {/* I treni di morbida che restano: due per tre manche, quindi una la si
            fa comunque di media o su una rimontata. */}
        <span className="font-mono text-[9px] text-dim tnum">
          {'●'.repeat(st.softNew)}{'○'.repeat(Math.max(0, 2 - st.softNew))} soft
        </span>
      </div>

      {!alive ? (
        <p className="font-mono text-[9px] text-dim mt-1">Eliminato · {st.note}</p>
      ) : locked ? (
        <p className={`font-mono text-[9px] mt-1 leading-tight ${
          st.note?.includes('compromesso') ? 'text-bad' : 'text-kestrel'}`}
        >
          P{rank} · {st.note}
        </p>
      ) : (
        <>
          <Row label="Uscita" choices={TIMINGS} value={plan.timing}
            onPick={(v) => onPick({ ...plan, timing: v })} driverId={driverId} />
          <Row
            label="Gomma"
            choices={COMPOUNDS}
            value={plan.compound}
            onPick={(v) => onPick({ ...plan, compound: v })}
            driverId={driverId}
            disabled={(v) => affordable(v, st) !== v}
          />
          <Row label="Lancio" choices={OUT_LAPS} value={plan.outLap}
            onPick={(v) => onPick({ ...plan, outLap: v })} driverId={driverId} />
        </>
      )}
    </div>
  );
}

function Row<T extends string>({ label, choices, value, onPick, driverId, disabled }: {
  label: string;
  choices: readonly Choice<T>[];
  value: T;
  onPick: (v: T) => void;
  driverId: string;
  disabled?: (v: T) => boolean;
}) {
  return (
    <div className="grid grid-cols-[42px_minmax(0,1fr)] items-center gap-1.5 mt-1">
      <span className="field-label">{label}</span>
      <div className="grid grid-cols-3 gap-1">
        {choices.map((c) => {
          const off = disabled?.(c.value) ?? false;
          const active = c.value === value;
          return (
            <button
              key={c.value}
              type="button"
              disabled={off}
              title={c.effect}
              data-testid={`qual-${driverId}-${c.value}`}
              onClick={() => onPick(c.value)}
              aria-pressed={active}
              className={`rounded border py-1 font-display text-[10px] font-bold uppercase
                tracking-wide truncate px-1 transition ${
                active ? 'bg-primary border-primary text-white'
                  : off ? 'bg-panel2 border-line text-line'
                    : 'bg-panel2 border-line text-dim hover:border-dim'}`}
            >
              {c.label}
            </button>
          );
        })}
      </div>
    </div>
  );
}
