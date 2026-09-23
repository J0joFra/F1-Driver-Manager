import { useState } from 'react';
import { Check, Lock, Sparkles } from 'lucide-react';
import { useGame } from '../../state/useGame.js';
import { player } from '../../engine/selectors.js';
import {
  BRANCHES, SKILL_TREE, prerequisiteOf, skillEffects, unlockRefusal,
  type SkillNode,
} from '../../engine/skills.js';
import { Panel } from '../components/kit.js';

/**
 * L'albero delle abilità.
 *
 * Sei rami tutti visibili insieme invece che a schede: a questa larghezza ci
 * stanno, e il colpo d'occhio sull'albero intero è metà del motivo per cui un
 * albero esiste. Con le schede si vedrebbe un ramo alla volta e la domanda
 * vera — *quale ramo percorro per primo* — resterebbe senza contesto.
 *
 * Un nodo si sblocca solo dopo quello sopra: è la regola che rende la scelta
 * costosa, perché arrivare in cima a un ramo significa non aver toccato gli
 * altri.
 */
export function Skills() {
  const world = useGame((s) => s.world)!;
  const unlock = useGame((s) => s.unlockSkill);
  const me = player(world)!;
  const [selected, setSelected] = useState<string>(SKILL_TREE[0]!.id);

  const node = SKILL_TREE.find((n) => n.id === selected)!;
  const refusal = unlockRefusal(me, node);
  const owned = me.perks.length;
  const effects = skillEffects(me);

  return (
    <div className="h-full flex flex-col gap-2 min-h-0">
      <div className="shrink-0 panel flex items-center gap-3 px-3 py-1.5">
        <Sparkles className="w-4 h-4 text-primary" />
        <span className="font-display text-2xl font-bold leading-none tnum text-primary">
          {me.skillPoints}
        </span>
        <span className="field-label">punti da spendere</span>
        <span className="w-px self-stretch bg-line mx-1" />
        <span className="font-mono text-2xs text-muted tnum">
          {owned}/{SKILL_TREE.length} abilità
        </span>
        <span className="flex-1" />
        <span className="font-mono text-2xs text-dim truncate hidden md:inline">
          I punti arrivano con le gare: uno ogni sei, più tre per ogni titolo.
        </span>
      </div>

      <div className="flex-1 grid grid-cols-6 gap-1.5 min-h-0">
        {BRANCHES.map((branch) => (
          <Panel key={branch.key} title={branch.name} bodyClass="p-1.5 flex flex-col gap-0 scroll-y">
            {SKILL_TREE.filter((n) => n.branch === branch.key)
              .sort((a, b) => a.tier - b.tier)
              .map((n, i) => (
                <NodeButton
                  key={n.id}
                  node={n}
                  first={i === 0}
                  state={me.perks.includes(n.id) ? 'owned'
                    : unlockRefusal(me, n) === null ? 'ready'
                    : 'locked'}
                  selected={n.id === selected}
                  onSelect={() => setSelected(n.id)}
                />
              ))}
          </Panel>
        ))}
      </div>

      <div className="h-[78px] shrink-0 grid grid-cols-[1fr_190px] gap-2">
        <Panel bodyClass="p-2.5 flex flex-col justify-center">
          <div className="flex items-baseline gap-2">
            <span className="font-sans text-sm font-bold">{node.name}</span>
            <span className="font-mono text-2xs text-dim">
              {BRANCHES.find((b) => b.key === node.branch)!.name} · livello {node.tier + 1}
            </span>
            <span className="flex-1" />
            <span className="font-mono text-2xs text-accent tnum">
              {node.cost} {node.cost === 1 ? 'punto' : 'punti'}
            </span>
          </div>
          <p className="font-mono text-2xs text-muted mt-1">{node.effect}</p>
          {refusal === 'manca il nodo precedente' && (
            <p className="font-mono text-[9px] text-dim mt-0.5">
              Prima serve «{prerequisiteOf(node)!.name}».
            </p>
          )}
        </Panel>

        <Panel bodyClass="p-2 flex flex-col justify-center gap-1.5">
          {refusal === 'già sbloccata' ? (
            <div className="flex items-center gap-1.5 justify-center font-sans text-xs font-semibold text-kestrel">
              <Check className="w-3.5 h-3.5" /> Sbloccata
            </div>
          ) : (
            <button
              type="button"
              data-testid="unlock-skill"
              onClick={() => unlock(node.id)}
              disabled={refusal !== null}
              className="w-full rounded bg-primary text-white font-sans text-xs font-semibold
                py-1.5 disabled:opacity-35 disabled:cursor-not-allowed hover:brightness-110 transition"
            >
              {refusal === 'punti insufficienti'
                ? node.cost === 1 ? 'Serve 1 punto' : `Servono ${node.cost} punti`
                : 'Sblocca'}
            </button>
          )}
          <Summary effects={effects} />
        </Panel>
      </div>
    </div>
  );
}

/** Un nodo: stato a colpo d'occhio, nome sotto. */
function NodeButton({ node, first, state, selected, onSelect }: {
  node: SkillNode;
  first: boolean;
  state: 'owned' | 'ready' | 'locked';
  selected: boolean;
  onSelect: () => void;
}) {
  const look = {
    owned: 'bg-primary border-primary text-white',
    ready: 'bg-primary/10 border-primary text-primary',
    locked: 'bg-panel2 border-line text-dim',
  }[state];

  return (
    <>
      {/* Il filo che lega un nodo al precedente: è la regola, disegnata. */}
      {!first && <span className={`w-px h-2 mx-auto ${state === 'locked' ? 'bg-line' : 'bg-primary'}`} />}
      <button
        type="button"
        onClick={onSelect}
        title={`${node.name} — ${node.effect}`}
        className={`w-full rounded border flex flex-col items-center gap-0.5 px-1 py-1 transition
          ${look} ${selected ? 'ring-2 ring-ink/25' : ''}`}
      >
        <span className="flex items-center gap-1 font-mono text-[9px] leading-none tnum">
          {state === 'owned' ? <Check className="w-2.5 h-2.5" />
            : state === 'locked' ? <Lock className="w-2.5 h-2.5" />
            : null}
          {state === 'owned' ? 'presa' : `${node.cost} pt`}
        </span>
        <span className="font-sans text-[9.5px] leading-tight text-center line-clamp-2">
          {node.name}
        </span>
      </button>
    </>
  );
}

/** Quello che l'albero sta già dando, in una riga sola. */
function Summary({ effects }: { effects: ReturnType<typeof skillEffects> }) {
  const bits: string[] = [];
  const caps = Object.values(effects.caps).reduce((s, v) => s + v, 0);
  if (caps > 0) bits.push(`+${caps} tetti`);
  if (effects.growth > 1) bits.push(`crescita +${Math.round((effects.growth - 1) * 100)}%`);
  if (effects.tyreWear < 1) bits.push(`gomme −${Math.round((1 - effects.tyreWear) * 100)}%`);
  if (effects.overtake > 0) bits.push(`sorpasso +${effects.overtake}`);
  if (effects.recovery > 0) bits.push(`recupero +${effects.recovery}`);
  return (
    <p className="font-mono text-[8.5px] text-dim leading-tight text-center">
      {bits.length > 0 ? bits.join(' · ') : 'Nessuna abilità sbloccata'}
    </p>
  );
}
