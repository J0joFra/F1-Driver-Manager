import { useGame } from '../../state/useGame.js';
import { isRaceWeek, player } from '../../engine/selectors.js';
import { ATTRIBUTE_KEYS, type AttributeKey, type TrainingCategory } from '../../engine/types.js';
import {
  CATEGORY_EFFECTS, TRAINING_CATEGORIES, planTotal, trainingLimits,
} from '../../engine/training.js';
import { staffGrowthMultiplier } from '../../engine/staff.js';
import { ageGrowthFactor } from '../../engine/driver.js';
import { pickMinigame } from '../../engine/training.js';
import { Note, Panel } from '../components/kit.js';
import { ATTR_LABELS, CATEGORY_LABELS, MINIGAME_LABELS } from '../format.js';

/**
 * La settimana di lavoro. Il tetto per categoria è il vincolo che tiene viva
 * la scelta: con 10 sessioni e un massimo di 4 devi toccarne almeno tre.
 */
export function Training() {
  const world = useGame((s) => s.world)!;
  const plan = useGame((s) => s.plan);
  const setPlan = useGame((s) => s.setPlan);
  const me = player(world)!;

  const limits = trainingLimits(me, isRaceWeek(world));
  const used = planTotal(plan);
  const free = limits.total - used;
  const minigame = pickMinigame(plan, world.lastMinigame);

  const bump = (c: TrainingCategory, delta: number) => {
    const next = { ...plan, [c]: plan[c] + delta };
    if (next[c] < 0 || next[c] > limits.perCategory[c]) return;
    if (planTotal(next) > limits.total) return;
    setPlan(next);
  };

  // Anteprima della crescita: stessa formula del motore, senza applicarla.
  const staffMult = staffGrowthMultiplier(me);
  const ageMult = ageGrowthFactor(me.age);
  const gains: Partial<Record<AttributeKey, number>> = {};
  for (const c of TRAINING_CATEGORIES) {
    if (plan[c] <= 0) continue;
    for (const [key, weight] of Object.entries(CATEGORY_EFFECTS[c]) as [AttributeKey, number][]) {
      const gap = me.caps[key] - me.attrs[key];
      if (gap <= 0) continue;
      const gapFactor = Math.max(0.12, Math.min(1, gap / 15));
      gains[key] = (gains[key] ?? 0) + 0.135 * weight * plan[c] * staffMult * ageMult * 0.95 * gapFactor;
    }
  }
  const ranked = ATTRIBUTE_KEYS.filter((k) => (gains[k] ?? 0) > 0).sort((a, b) => (gains[b] ?? 0) - (gains[a] ?? 0));

  return (
    <div className="h-full grid grid-cols-[1.3fr_1fr] gap-2 min-h-0">
      <Panel
        title={isRaceWeek(world) ? 'Settimana di gara' : 'Settimana libera'}
        tag={<span className={free > 0 ? 'text-warn' : 'text-dim'}>{free} / {limits.total} libere</span>}
        bodyClass="p-3 scroll-y"
      >
        <div className="flex flex-col">
          {TRAINING_CATEGORIES.map((c) => {
            const atMax = plan[c] >= limits.perCategory[c];
            return (
              <div key={c} className="flex items-center justify-between gap-3 py-2 border-b border-line last:border-0">
                <div className="min-w-0">
                  <div className="font-display text-base font-semibold tracking-wide">{CATEGORY_LABELS[c]!.name}</div>
                  <div className="text-2xs text-dim truncate">{CATEGORY_LABELS[c]!.hint}</div>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <button
                    type="button" aria-label={`Meno ${CATEGORY_LABELS[c]!.name}`}
                    onClick={() => bump(c, -1)} disabled={plan[c] <= 0}
                    className="w-8 h-8 rounded-sm bg-panel2 border border-line text-ink font-mono text-lg leading-none disabled:opacity-30"
                  >−</button>
                  <span className="font-display text-xl font-bold w-6 text-center tnum">{plan[c]}</span>
                  <button
                    type="button" aria-label={`Più ${CATEGORY_LABELS[c]!.name}`}
                    onClick={() => bump(c, 1)} disabled={free <= 0 || atMax}
                    className="w-8 h-8 rounded-sm bg-panel2 border border-line text-ink font-mono text-lg leading-none disabled:opacity-30"
                  >+</button>
                </div>
              </div>
            );
          })}
        </div>
        <div className="font-mono text-2xs text-dim mt-2 leading-relaxed">
          Massimo {limits.perCategory.simulator} per categoria
          {limits.perCategory.simulator > 4 && ' (il coach alza il tetto del simulatore)'}.
        </div>
      </Panel>

      <div className="flex flex-col gap-2 min-h-0">
        <Panel title="Crescita prevista" tag="al prossimo weekend" bodyClass="p-3 scroll-y" className="flex-1">
          {ranked.length === 0 ? (
            <p className="text-xs text-dim">Nessuna sessione assegnata: questa settimana non cresci.</p>
          ) : (
            <div className="flex flex-col gap-1">
              {ranked.map((k) => (
                <div key={k} className="flex justify-between font-mono text-xs">
                  <span className="text-muted">{ATTR_LABELS[k]}</span>
                  <b className="text-good font-medium tnum">+{(gains[k] ?? 0).toFixed(2)}</b>
                </div>
              ))}
              {plan.media > 0 && (
                <div className="flex justify-between font-mono text-xs border-t border-line pt-1 mt-1">
                  <span className="text-muted">Reputazione</span>
                  <b className="text-good font-medium tnum">+{(plan.media * 0.6).toFixed(1)}</b>
                </div>
              )}
            </div>
          )}
        </Panel>

        <Panel title="Minigioco della settimana" className="shrink-0">
          {minigame ? (
            <div className="flex flex-col gap-1.5">
              <div className="font-display text-lg font-bold text-vantar">{MINIGAME_LABELS[minigame]}</div>
              <p className="text-2xs text-dim leading-relaxed">
                Assegnato dalla categoria in cui hai investito di più. Non può ripetersi due settimane di fila.
              </p>
            </div>
          ) : (
            <p className="text-xs text-dim">Nessun minigioco: settimana di soli media, oppure sessioni non assegnate.</p>
          )}
        </Panel>

        {free > 0 && <Note tone="warn">Hai {free} session{free > 1 ? 'i' : 'e'} non assegnate. Vanno perse: il tempo è la risorsa che non torna.</Note>}
      </div>
    </div>
  );
}
