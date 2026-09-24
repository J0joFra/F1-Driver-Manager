import { Dumbbell, RotateCcw, Sparkles, User, UserPlus } from 'lucide-react';
import { useGame, defaultPlan } from '../../state/useGame.js';
import { currentWeek, myDrivers, myTeam, weekLabel } from '../../engine/selectors.js';
import { WEEK_LABEL } from '../../engine/calendar.js';
import type { AttributeKey, TrainingCategory } from '../../engine/types.js';
import {
  CATEGORY_EFFECTS, MINIGAME_AUTO, TRAINING_CATEGORIES, emptyPlan,
  pickMinigame, planTotal, trainingLimits,
} from '../../engine/training.js';
import { previewTraining } from '../../engine/progression.js';
import { overall } from '../../engine/driver.js';
import { ATTRIBUTE_COLOURS, Bar, Btn, Note, Panel, Pips } from '../components/kit.js';
import { ATTR_LABELS, CATEGORY_LABELS, MINIGAME_LABELS } from '../format.js';

/** L'attributo su cui ogni categoria pesa di più: è quello che il giocatore vede muoversi. */
function primaryAttribute(category: TrainingCategory): AttributeKey | null {
  const entries = Object.entries(CATEGORY_EFFECTS[category]) as [AttributeKey, number][];
  if (entries.length === 0) return null;
  return entries.sort((a, b) => b[1] - a[1])[0]![0];
}

/**
 * I tuoi piloti, e cosa fanno questa settimana.
 *
 * In alto si sceglie il pilota, sotto si distribuiscono le sue sessioni e si
 * vede dove vanno a finire. Il programma è **per pilota** e non per squadra:
 * mandare uno al simulatore e l'altro in palestra è la decisione, e un piano
 * unico la cancellerebbe.
 *
 * Far crescere i piloti che hai è la leva veloce della scuderia — la
 * monoposto è quella lenta — ed è il motivo per cui un giovane con potenziale
 * vale più di un veterano già fatto.
 */
export function Drivers({ onAdvance }: { onAdvance: () => void }) {
  const world = useGame((s) => s.world)!;
  const team = myTeam(world)!;
  const roster = myDrivers(world);
  const goTo = useGame((s) => s.goTo);
  const select = useGame((s) => s.select);
  const selected = useGame((s) => s.selected);
  const plans = useGame((s) => s.plans);
  const setPlanFor = useGame((s) => s.setPlan);

  const me = roster.find((d) => d.id === selected) ?? roster[0];

  if (!me) {
    return (
      <Panel title="I tuoi piloti">
        <div className="max-w-sm">
          <Note tone="warn">
            Non hai piloti sotto contratto. Senza, la scuderia non prende il via e non segna punti.
          </Note>
          <Btn variant="green" className="mt-2" onClick={() => goTo('mercato')} testId="goto-market">
            <UserPlus className="w-3.5 h-3.5" /> Vai al mercato
          </Btn>
        </div>
      </Panel>
    );
  }

  const plan = plans[me.id] ?? defaultPlan();
  const setPlan = (next: typeof plan) => setPlanFor(me.id, next);

  const week = currentWeek(world);
  const kind = week?.kind ?? 'free';
  const raceWeek = kind === 'race';
  const limits = trainingLimits(me, week?.training ?? 0);
  const resting = limits.total === 0;
  const free = limits.total - planTotal(plan);
  const minigame = pickMinigame(plan, world.lastMinigame);

  const bump = (c: TrainingCategory, delta: number) => {
    const next = { ...plan, [c]: plan[c] + delta };
    if (next[c] < 0 || next[c] > limits.perCategory[c] || planTotal(next) > limits.total) return;
    setPlan(next);
  };

  // L'anteprima arriva dal motore: è la stessa funzione che poi applica la
  // crescita, quindi quello che si legge qui è quello che succede davvero.
  const preview = previewTraining(me, plan, limits.perCategory, limits.total, MINIGAME_AUTO);
  const gainOf = (key: AttributeKey) => preview.gains[key] ?? 0;

  return (
    <div className="h-full flex flex-col gap-2 min-h-0">
      {/* Chi stai programmando. Con due monoposto la scheda va scelta, non
          indovinata dal contesto. */}
      <div className="shrink-0 flex items-stretch gap-2">
        {roster.map((d, i) => (
          <button
            key={d.id}
            type="button"
            onClick={() => select(d.id)}
            data-testid={`driver-tab-${i}`}
            className={`flex-1 panel px-3 py-1.5 flex items-center gap-2.5 text-left transition
              ${d.id === me.id ? 'border-primary' : 'hover:border-dim'}`}
            style={d.id === me.id ? { borderLeft: `3px solid ${team.colour}` } : undefined}
          >
            <div className="min-w-0 flex-1">
              <div className="font-sans text-xs font-bold truncate">{d.name}</div>
              <div className="font-mono text-[9px] text-dim truncate">
                {d.age} anni · contratto {d.contractYears > 0 ? `${d.contractYears} anni` : 'in scadenza'}
              </div>
            </div>
            <div className="text-center shrink-0">
              <div className="font-display text-base font-bold leading-none tnum">
                {Math.round(overall(d.attrs))}
              </div>
              <div className="field-label">ovr</div>
            </div>
            {d.skillPoints > 0 && (
              <span className="shrink-0 inline-flex items-center gap-0.5 rounded border border-primary/60
                px-1 py-px font-mono text-[8.5px] text-primary">
                <Sparkles className="w-2.5 h-2.5" />{d.skillPoints}
              </span>
            )}
          </button>
        ))}
        <Btn onClick={() => { select(me.id); goTo('profilo'); }} className="shrink-0" testId="open-profile">
          <User className="w-3 h-3" /> Scheda
        </Btn>
        <Btn onClick={() => { select(me.id); goTo('abilita'); }} className="shrink-0" testId="open-skills">
          <Sparkles className="w-3 h-3" /> Abilità
        </Btn>
      </div>

      <div className="flex-1 grid grid-cols-[264px_1fr] gap-2 min-h-0">
      <Panel
        title="Piano settimanale"
        tag={
          resting
            ? <span className="text-accent">riposo</span>
            : <span className={free > 0 ? 'text-accent' : 'text-primary'}>{free}/{limits.total} libere</span>
        }
        bodyClass="p-2.5 flex flex-col min-h-0"
      >
        <div className="flex items-baseline justify-between pb-1.5 border-b border-line">
          <span className="font-mono text-2xs text-muted">{weekLabel(world)}</span>
          <span className="font-mono text-2xs text-dim">max {limits.perCategory.simulator} per categoria</span>
        </div>

        <div className="flex-1 min-h-0 scroll-y -mx-0.5 px-0.5">
          {resting && (
            <div className="mt-2">
              <Note tone="warn">
                {WEEK_LABEL[kind]}: non si lavora. La stanchezza scende da sola, ed è l'unico
                momento dell'anno in cui succede.
              </Note>
            </div>
          )}
          {!resting && TRAINING_CATEGORIES.map((c) => {
            const key = primaryAttribute(c);
            return (
              <div key={c} className="bg-panel2 border border-line rounded mt-1.5 px-2.5 py-2">
                <div className="flex items-center justify-between gap-2">
                  <div className="min-w-0">
                    <div className="font-sans text-xs font-semibold truncate">{CATEGORY_LABELS[c]!.name}</div>
                    <div className="font-mono text-[8.5px] text-dim truncate">
                      {key ? `Allena: ${ATTR_LABELS[key]}` : 'Allena: reputazione'}
                    </div>
                  </div>
                  <div className="flex items-center gap-1.5 shrink-0">
                    <button
                      type="button" aria-label={`Meno ${CATEGORY_LABELS[c]!.name}`}
                      onClick={() => bump(c, -1)} disabled={plan[c] <= 0}
                      className="w-6 h-6 rounded bg-panel3 border border-line text-ink font-mono text-sm leading-none disabled:opacity-25"
                    >−</button>
                    <span className="font-display text-base font-bold w-4 text-center tnum">{plan[c]}</span>
                    <button
                      type="button" aria-label={`Più ${CATEGORY_LABELS[c]!.name}`}
                      onClick={() => bump(c, 1)} disabled={free <= 0 || plan[c] >= limits.perCategory[c]}
                      className="w-6 h-6 rounded bg-panel3 border border-line text-ink font-mono text-sm leading-none disabled:opacity-25"
                    >+</button>
                  </div>
                </div>
                <div className="mt-1.5">
                  <Pips filled={plan[c]} total={limits.perCategory[c]} colour={key ? ATTRIBUTE_COLOURS[key] : '#10B981'} />
                </div>
              </div>
            );
          })}
        </div>

        <div className="flex items-center gap-2 pt-2 mt-1 border-t border-line shrink-0">
          <Btn onClick={() => setPlan(emptyPlan())} className="px-2.5">
            <RotateCcw className="w-3 h-3" />Azzera
          </Btn>
          <Btn variant="green" onClick={onAdvance} className="flex-1" testId="train-advance">
            <Dumbbell className="w-3.5 h-3.5" />
            {resting ? 'Riposa e avanza' : raceWeek ? 'Allena e vai alla gara' : 'Allena e avanza'}
          </Btn>
        </div>
      </Panel>

      <div className="flex flex-col gap-2 min-h-0">
        <Panel title="Attributi allenati" tag="al prossimo weekend" className="flex-1" bodyClass="px-3 py-1.5 scroll-y">
          {TRAINING_CATEGORIES.map((c) => {
            const key = primaryAttribute(c);
            if (!key) return null;
            const gain = gainOf(key);
            return (
              <div key={c} className="py-1.5 border-b border-line/50 last:border-0">
                <div className="flex items-baseline justify-between gap-2">
                  <span className="font-sans text-xs text-ink truncate">
                    {CATEGORY_LABELS[c]!.name} <span className="text-dim">→</span> {ATTR_LABELS[key]}
                  </span>
                  <span className="flex items-baseline gap-2 shrink-0">
                    {gain > 0 && <span className="font-mono text-2xs text-primary">+{gain.toFixed(2)}</span>}
                    <b className="font-display text-base font-bold tnum leading-none">{Math.round(me.attrs[key])}</b>
                  </span>
                </div>
                <div className="mt-1">
                  <Bar value={me.attrs[key]} colour={ATTRIBUTE_COLOURS[key]} height={5} />
                </div>
                <div className="font-mono text-[8.5px] text-dim mt-[3px]">Potenziale: {Math.round(me.caps[key])}</div>
              </div>
            );
          })}
        </Panel>

        <div className="shrink-0 flex flex-col gap-1.5">
          <div className="panel px-2.5 py-2">
            <div className="flex items-baseline justify-between gap-2">
              <span className="field-label">Stanchezza</span>
              <span className="font-mono text-2xs tnum">
                <span className={me.fatigue > 70 ? 'text-bad' : me.fatigue > 40 ? 'text-accent' : 'text-primary'}>
                  {Math.round(me.fatigue)}
                </span>
                <span className="text-dim">
                  {' '}{preview.fatigueGain >= 0 ? '+' : '−'}{Math.abs(preview.fatigueGain).toFixed(0)} questa sett.
                </span>
              </span>
            </div>
            <div className="mt-1">
              <Bar
                value={me.fatigue}
                colour={me.fatigue > 70 ? '#E8283C' : me.fatigue > 40 ? '#FBBF24' : '#10B981'}
                height={4}
              />
            </div>
            <p className="font-mono text-[8.5px] text-dim mt-1 leading-relaxed">
              Oltre l'85% del monte si cresce di meno; la stanchezza fa sbagliare in gara.
            </p>
          </div>
          {minigame && (
            <div className="panel px-2.5 py-2 flex items-center justify-between gap-2">
              <div className="min-w-0">
                <div className="field-label">Minigioco della settimana</div>
                <div className="font-sans text-xs font-semibold text-vantar truncate">{MINIGAME_LABELS[minigame]}</div>
              </div>
              <span className="font-mono text-[8.5px] text-dim text-right shrink-0 leading-tight">
                dalla categoria<br />più investita
              </span>
            </div>
          )}
          {free > 0 && (
            <Note tone="warn">
              {free} session{free > 1 ? 'i' : 'e'} non assegnate: vanno perse.
            </Note>
          )}
        </div>
      </div>
      </div>
    </div>
  );
}
