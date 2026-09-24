import { useState } from 'react';
import { Flag, Timer } from 'lucide-react';
import { useGame } from '../../state/useGame.js';
import { nextRace, player, teamOf } from '../../engine/selectors.js';
import { getTrack } from '../../engine/data/tracks.js';
import { layoutName } from '../../engine/layout.js';
import {
  COMPOUNDS, DEFAULT_PLAN, OUT_LAPS, TIMINGS,
  type Choice, type QualifyingPlan,
} from '../../engine/qualifying.js';
import { Panel } from '../components/kit.js';

/**
 * La qualifica, sabato.
 *
 * Un giro secco non si guida a comandi: si prepara. Quello che un pilota
 * decide davvero è quando uscire, su che gomma e come scaldarla — e poi il
 * giro è la conseguenza. Tre scelte, nessuna con una risposta giusta: ognuna
 * scambia decimi contro rischio.
 *
 * Quanto rischio convenga dipende da dove si corre, ed è per questo che il
 * pannello di destra dice quanto è difficile sorpassare: su un cittadino la
 * pole vale una gara, su una pista di potenza molto meno.
 */
export function Qualifying({ onDone }: { onDone: () => void }) {
  const world = useGame((s) => s.world)!;
  const setPlan = useGame((s) => s.setQualifyingPlan);
  const me = player(world)!;
  const team = teamOf(world, me);
  const race = nextRace(world);
  const track = race ? getTrack(race.trackId) : null;
  const [plan, setLocal] = useState<QualifyingPlan>(world.qualifyingPlan ?? DEFAULT_PLAN);

  if (!track) return null;

  const pick = <K extends keyof QualifyingPlan>(key: K, value: QualifyingPlan[K]) =>
    setLocal({ ...plan, [key]: value });

  const go = () => { setPlan(plan); onDone(); };

  return (
    <div className="h-full flex flex-col gap-2 min-h-0">
      <div className="shrink-0 panel flex items-center gap-3 px-3 py-2"
        style={{ borderLeft: `3px solid ${team?.colour ?? '#888'}` }}
      >
        <Timer className="w-4 h-4 text-primary" />
        <div className="min-w-0">
          <div className="font-display text-lg font-bold leading-none">Qualifica</div>
          <div className="font-mono text-2xs text-muted truncate">
            {track.name} · {layoutName(track.layout)}
          </div>
        </div>
        <span className="flex-1" />
        <div className="text-center px-2">
          <div className="font-display text-lg font-bold leading-none tnum">
            {Math.round(track.overtaking * 100)}%
          </div>
          <div className="field-label mt-0.5">Sorpassi</div>
        </div>
        <p className="font-mono text-[9px] text-dim leading-tight max-w-[190px] hidden md:block">
          {track.overtaking < 0.32
            ? 'Qui in gara non si passa: la pole vale doppio, conviene rischiare.'
            : track.overtaking > 0.52
              ? 'Qui si sorpassa: una fila persa si recupera, non serve strafare.'
              : 'Tracciato onesto: la posizione conta, ma non decide tutto.'}
        </p>
      </div>

      <div className="flex-1 grid grid-cols-3 gap-2 min-h-0">
        <Decision title="Quando uscire" choices={TIMINGS}
          value={plan.timing} onPick={(v) => pick('timing', v)} />
        <Decision title="Mescola" choices={COMPOUNDS}
          value={plan.compound} onPick={(v) => pick('compound', v)} />
        <Decision title="Giro di lancio" choices={OUT_LAPS}
          value={plan.outLap} onPick={(v) => pick('outLap', v)} />
      </div>

      <button
        type="button"
        data-testid="go-qualifying"
        onClick={go}
        className="h-[38px] shrink-0 rounded bg-primary text-white font-sans text-sm font-bold
          inline-flex items-center justify-center gap-2 hover:brightness-110 transition"
      >
        <Flag className="w-4 h-4" />
        Vai in pista
      </button>
    </div>
  );
}

function Decision<T extends string>({ title, choices, value, onPick }: {
  title: string;
  choices: readonly Choice<T>[];
  value: T;
  onPick: (v: T) => void;
}) {
  return (
    <Panel title={title} bodyClass="p-1.5 flex flex-col gap-1.5 scroll-y">
      {choices.map((c) => {
        const active = c.value === value;
        return (
          <button
            key={c.value}
            type="button"
            data-testid={`qual-${c.value}`}
            onClick={() => onPick(c.value)}
            className={`flex-1 rounded border px-2 py-1.5 text-left transition
              ${active ? 'bg-primary/8 border-primary' : 'bg-panel2 border-line hover:border-dim'}`}
          >
            <div className={`font-sans text-xs font-bold ${active ? 'text-primary' : 'text-ink'}`}>
              {c.label}
            </div>
            <div className="font-mono text-[9px] text-dim leading-tight mt-0.5">{c.effect}</div>
          </button>
        );
      })}
    </Panel>
  );
}
