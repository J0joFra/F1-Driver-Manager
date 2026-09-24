import { useState } from 'react';
import { Check, Lock, Sparkles } from 'lucide-react';
import { useGame } from '../../state/useGame.js';
import { focusedDriver } from '../../engine/selectors.js';
import {
  BRANCHES, GRID_COLS, SKILL_TREE, TOTAL_COST, prerequisitesOf, skillEffects,
  unlockRefusal, type BranchKey, type SkillEffects, type SkillNode,
} from '../../engine/skills.js';
import { Panel } from '../components/kit.js';

/**
 * L'albero delle abilità.
 *
 * Un'area alla volta, perché un grafo ramificato ha bisogno di spazio: quattro
 * grafi affiancati in 780 px diventerebbero quattro colonne di pallini senza
 * fili leggibili, e i fili *sono* la regola. Le schede in alto dicono a colpo
 * d'occhio quanto manca in ciascuna area, così cambiare scheda non è cercare
 * al buio.
 *
 * I nodi stanno su una griglia di quattro colonne per quattro righe e i
 * collegamenti sono disegnati in SVG sotto di loro: un nodo in fondo che
 * chiede due rami si vede subito, perché ha due fili che vi arrivano.
 */
export function Skills() {
  const world = useGame((s) => s.world)!;
  const unlock = useGame((s) => s.unlockSkill);
  const focus = useGame((s) => s.selected);
  const me = focusedDriver(world, focus);
  const [branch, setBranch] = useState<BranchKey>('pace');
  const [picked, setPicked] = useState<string>(SKILL_TREE[0]!.id);

  if (!me) {
    return (
      <Panel title="Abilità">
        <p className="font-mono text-2xs text-dim">
          Nessun pilota sotto contratto: l'albero è del pilota, non della scuderia.
        </p>
      </Panel>
    );
  }

  const nodes = SKILL_TREE.filter((n) => n.branch === branch);
  const node = SKILL_TREE.find((n) => n.id === picked) ?? nodes[0]!;
  const refusal = unlockRefusal(me, node);
  const effects = skillEffects(me);
  const spent = me.perks.reduce((s, id) => s + (SKILL_TREE.find((n) => n.id === id)?.cost ?? 0), 0);

  return (
    <div className="h-full flex flex-col gap-2 min-h-0">
      <div className="shrink-0 flex items-center gap-2">
        <div className="panel flex items-center gap-2 px-2.5 py-1">
          <Sparkles className="w-3.5 h-3.5 text-primary" />
          <span className="font-display text-xl font-bold leading-none tnum text-primary">
            {me.skillPoints}
          </span>
          <span className="field-label">punti</span>
        </div>

        {BRANCHES.map((b) => {
          const owned = SKILL_TREE.filter((n) => n.branch === b.key && me.perks.includes(n.id)).length;
          const total = SKILL_TREE.filter((n) => n.branch === b.key).length;
          const active = b.key === branch;
          return (
            <button
              key={b.key}
              type="button"
              data-testid={`tab-${b.key}`}
              onClick={() => { setBranch(b.key); setPicked(SKILL_TREE.find((n) => n.branch === b.key)!.id); }}
              className={`flex-1 rounded border px-2 py-1 text-left transition
                ${active ? 'bg-panel border-primary' : 'bg-panel2 border-line hover:border-dim'}`}
            >
              <div className="flex items-baseline justify-between gap-1">
                <span className={`font-sans text-2xs font-bold ${active ? 'text-primary' : 'text-ink'}`}>
                  {b.name}
                </span>
                <span className="font-mono text-[9px] text-dim tnum">{owned}/{total}</span>
              </div>
              <div className="font-mono text-[8.5px] text-dim truncate">{b.hint}</div>
            </button>
          );
        })}

        <span className="font-mono text-2xs text-dim tnum shrink-0 hidden md:inline">
          {spent}/{TOTAL_COST} spesi
        </span>
      </div>

      <Panel bodyClass="p-2 min-h-0" className="flex-1">
        <Graph nodes={nodes} perks={me.perks} selected={node.id}
          canTake={(n) => unlockRefusal(me, n) === null} onSelect={setPicked} />
      </Panel>

      <div className="h-[72px] shrink-0 grid grid-cols-[1fr_190px] gap-2">
        <Panel bodyClass="p-2.5 flex flex-col justify-center">
          <div className="flex items-baseline gap-2">
            <span className="font-sans text-sm font-bold">{node.name}</span>
            <span className="flex-1" />
            <span className="font-mono text-2xs text-accent tnum">
              {node.cost} {node.cost === 1 ? 'punto' : 'punti'}
            </span>
          </div>
          <p className="font-mono text-2xs text-muted mt-0.5">{node.effect}</p>
          {refusal === 'mancano i nodi richiesti' && (
            <p className="font-mono text-[9px] text-dim mt-0.5">
              Prima servono: {prerequisitesOf(node).filter((n) => !me.perks.includes(n.id))
                .map((n) => `«${n.name}»`).join(' e ')}.
            </p>
          )}
        </Panel>

        <Panel bodyClass="p-2 flex flex-col justify-center gap-1">
          {refusal === 'già sbloccata' ? (
            <div className="flex items-center gap-1.5 justify-center font-sans text-xs font-semibold text-kestrel">
              <Check className="w-3.5 h-3.5" /> Sbloccata
            </div>
          ) : (
            <button
              type="button"
              data-testid="unlock-skill"
              onClick={() => unlock(me.id, node.id)}
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

const ROWS = 4;

/** Il grafo di un'area: prima i fili, poi i nodi sopra. */
function Graph({ nodes, perks, selected, canTake, onSelect }: {
  nodes: SkillNode[];
  perks: string[];
  selected: string;
  canTake: (n: SkillNode) => boolean;
  onSelect: (id: string) => void;
}) {
  // Percentuali invece di pixel: il grafo si adatta al pannello senza sapere
  // quanto è grande, e resta centrato su qualunque larghezza.
  const x = (col: number) => ((col + 0.5) / GRID_COLS) * 100;
  const y = (row: number) => ((row + 0.5) / ROWS) * 100;

  return (
    <div className="relative w-full h-full">
      <svg className="absolute inset-0 w-full h-full" preserveAspectRatio="none" viewBox="0 0 100 100">
        {nodes.flatMap((n) =>
          prerequisitesOf(n).map((from) => (
            <line
              key={`${from.id}-${n.id}`}
              x1={x(from.col)} y1={y(from.row)} x2={x(n.col)} y2={y(n.row)}
              className={perks.includes(from.id) && perks.includes(n.id)
                ? 'stroke-primary' : 'stroke-line'}
              strokeWidth={perks.includes(n.id) ? 0.7 : 0.45}
              vectorEffect="non-scaling-stroke"
            />
          )))}
      </svg>

      {nodes.map((n) => {
        const state = perks.includes(n.id) ? 'owned' : canTake(n) ? 'ready' : 'locked';
        return (
          <NodeChip
            key={n.id}
            node={n}
            state={state}
            selected={n.id === selected}
            onSelect={() => onSelect(n.id)}
            style={{ left: `${x(n.col)}%`, top: `${y(n.row)}%` }}
          />
        );
      })}
    </div>
  );
}

function NodeChip({ node, state, selected, onSelect, style }: {
  node: SkillNode;
  state: 'owned' | 'ready' | 'locked';
  selected: boolean;
  onSelect: () => void;
  style: React.CSSProperties;
}) {
  const look = {
    owned: 'bg-primary border-primary text-white',
    ready: 'bg-panel border-primary text-primary',
    locked: 'bg-panel2 border-line text-dim',
  }[state];

  return (
    <button
      type="button"
      onClick={onSelect}
      title={`${node.name} — ${node.effect}`}
      style={style}
      className={`absolute -translate-x-1/2 -translate-y-1/2 w-[94px] rounded border
        px-1 py-[3px] flex flex-col items-center gap-px transition ${look}
        ${selected ? 'ring-2 ring-ink/25' : ''}`}
    >
      <span className="flex items-center gap-0.5 font-mono text-[8.5px] leading-none tnum">
        {state === 'owned' ? <Check className="w-2 h-2" />
          : state === 'locked' ? <Lock className="w-2 h-2" /> : null}
        {state === 'owned' ? 'presa' : `${node.cost} pt`}
      </span>
      <span className="font-sans text-[9px] leading-[1.15] text-center line-clamp-2">
        {node.name}
      </span>
    </button>
  );
}

/** Quello che l'albero sta già dando, in poche parole. */
function Summary({ effects }: { effects: SkillEffects }) {
  const bits: string[] = [];
  const caps = Object.values(effects.caps).reduce((s, v) => s + v, 0);
  const pct = (v: number) => Math.round(Math.abs(v - 1) * 100);
  if (caps > 0) bits.push(`+${caps} tetti`);
  if (effects.growth > 1) bits.push(`crescita +${pct(effects.growth)}%`);
  if (effects.tyreWear < 1) bits.push(`gomme −${pct(effects.tyreWear)}%`);
  if (effects.overtake > 0) bits.push(`sorpasso +${effects.overtake}`);
  if (effects.recovery > 0) bits.push(`recupero +${effects.recovery}`);
  if (effects.reputation > 1) bits.push(`fama +${pct(effects.reputation)}%`);
  if (effects.sponsors > 1) bits.push(`sponsor +${pct(effects.sponsors)}%`);
  if (effects.salary > 1) bits.push(`ingaggio +${pct(effects.salary)}%`);
  if (effects.development > 0) bits.push(`sviluppo +${Math.round(effects.development * 6)}%`);
  return (
    <p className="font-mono text-[8px] text-dim leading-tight text-center line-clamp-3">
      {bits.length > 0 ? bits.join(' · ') : 'Nessuna abilità sbloccata'}
    </p>
  );
}
