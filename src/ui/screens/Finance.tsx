import { useGame } from '../../state/useGame.js';
import { player } from '../../engine/selectors.js';
import { staffAnnualCost, staffGrowthMultiplier } from '../../engine/staff.js';
import { Note, Panel, Stat } from '../components/kit.js';
import { money } from '../format.js';

const ROLE_LABELS: Record<string, string> = {
  coach: 'Coach', trainer: 'Preparatore', physio: 'Fisioterapista', agent: 'Procuratore',
};

/**
 * Bilancio e staff personale.
 *
 * L'ingaggio non è un numero di vanità: finanzia lo staff, e lo staff decide
 * a che età arrivi al tuo tetto. Il mercato dei professionisti arriva col
 * prossimo passo; qui si vedono i conti e gli effetti.
 */
export function Finance() {
  const world = useGame((s) => s.world)!;
  const me = player(world)!;

  const points = world.standings[me.id] ?? 0;
  const bonuses = points * 15_000;
  const sponsors = Math.round(me.reputation * 12_000);
  const income = me.salary + bonuses + sponsors;
  const staffCost = staffAnnualCost(me);
  const fixed = Math.round(income * 0.15);
  const balance = income - staffCost - fixed;

  const mult = staffGrowthMultiplier(me);
  const peak = (28 - (mult - 1) * 11).toFixed(1);

  return (
    <div className="h-full grid grid-cols-[1fr_1fr] gap-2 min-h-0">
      <Panel title={`Bilancio ${world.year}`} tag={`cassa ${money(me.money)}`} bodyClass="p-3 scroll-y">
        <div className="flex flex-col font-mono text-xs">
          {[
            { k: 'Ingaggio', v: me.salary, sub: `contratto ${me.contractYears} ${me.contractYears === 1 ? 'anno' : 'anni'}`, in: true },
            { k: 'Bonus risultati', v: bonuses, sub: `${points} punti × 15k`, in: true },
            { k: 'Sponsor personali', v: sponsors, sub: `reputazione ${Math.round(me.reputation)}`, in: true },
            { k: 'Staff personale', v: -staffCost, sub: `${me.staff.length} sotto contratto`, in: false },
            { k: 'Spese fisse', v: -fixed, sub: 'viaggi, tasse, superlicenza', in: false },
          ].map((r) => (
            <div key={r.k} className="flex justify-between gap-3 py-1.5 border-b border-line">
              <div className="min-w-0">
                <div className="text-muted">{r.k}</div>
                <div className="text-2xs text-dim truncate">{r.sub}</div>
              </div>
              <span className={`tnum shrink-0 ${r.in ? 'text-good' : 'text-muted'}`}>
                {r.in ? '+' : ''}{money(r.v)}
              </span>
            </div>
          ))}
          <div className="flex justify-between items-center pt-2.5 mt-1.5 border-t-2 border-line">
            <span className="font-display text-sm uppercase tracking-[0.1em] font-semibold text-ink">Saldo stagione</span>
            <b className={`font-display text-lg font-bold tnum ${balance >= 0 ? 'text-good' : 'text-bad'}`}>
              {balance >= 0 ? '+' : ''}{money(balance)}
            </b>
          </div>
        </div>
      </Panel>

      <Panel title="Staff personale" tag="lo staff compra tempo" bodyClass="p-3 scroll-y">
        {me.staff.length === 0 ? (
          <div className="border border-dashed border-line rounded-sm p-3 text-center text-xs text-dim mb-3">
            Nessuno sotto contratto. Stai crescendo da solo.
          </div>
        ) : (
          <div className="flex flex-col mb-3">
            {me.staff.map((s) => (
              <div key={s.id} className="flex justify-between items-center gap-3 py-2 border-b border-line last:border-0">
                <div className="min-w-0">
                  <div className="text-2xs uppercase tracking-[0.14em] text-dim">{ROLE_LABELS[s.role]}</div>
                  <div className="font-display text-base font-semibold tracking-wide truncate">{s.name}</div>
                </div>
                <div className="text-right shrink-0 font-mono text-xs">
                  <div className="text-muted tnum">qualità {s.quality}</div>
                  <div className="text-dim tnum">{s.salaryPct ? `${s.salaryPct}%` : money(s.cost)}</div>
                </div>
              </div>
            ))}
          </div>
        )}

        <div className="flex gap-5 mb-3">
          <Stat value={`${mult.toFixed(2)}×`} label="Velocità crescita" hint="max 1.40×" />
          <Stat value={peak} label="Età al picco" hint="senza staff: 28.0" />
          <Stat value={Math.round(me.reputation)} label="Reputazione" hint="apre lo staff top" />
        </div>

        <Note>
          Il potenziale resta quello con cui sei nato. Lo staff cambia solo a che età ci arrivi — e quante
          stagioni al massimo ti restano prima della curva discendente.
        </Note>
      </Panel>
    </div>
  );
}
