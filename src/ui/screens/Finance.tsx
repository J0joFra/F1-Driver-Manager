import { useGame } from '../../state/useGame.js';
import { player } from '../../engine/selectors.js';
import { staffAnnualCost, staffGrowthMultiplier } from '../../engine/staff.js';
import { Panel } from '../components/kit.js';
import { money } from '../format.js';

const ROLE_LABELS: Record<string, string> = {
  coach: 'Coach', trainer: 'Preparatore', physio: 'Fisioterapista', agent: 'Procuratore',
};

function Line({ label, sub, value, tone }: { label: string; sub?: string; value: string; tone?: 'green' | 'bad' }) {
  const colour = tone === 'green' ? 'text-primary' : tone === 'bad' ? 'text-bad' : 'text-ink';
  return (
    <div className="flex items-baseline justify-between gap-3 py-[7px] border-b border-line/60 last:border-0">
      <div className="min-w-0">
        <div className="font-sans text-xs text-ink truncate">{label}</div>
        {sub && <div className="font-mono text-[8.5px] text-dim truncate">{sub}</div>}
      </div>
      <div className={`font-mono text-xs tnum shrink-0 ${colour}`}>{value}</div>
    </div>
  );
}

/**
 * Il bilancio: entrate, uscite, e il netto isolato in una colonna sua.
 *
 * L'ingaggio non è un numero di vanità — finanzia lo staff, e lo staff decide
 * a che età arrivi al tuo tetto.
 */
export function Finance() {
  const world = useGame((s) => s.world)!;
  const me = player(world)!;

  const points = world.standings[me.id] ?? 0;
  const podiums = me.history.reduce((s, h) => s + h.podiums, 0);
  const wins = me.history.reduce((s, h) => s + h.wins, 0);
  const bonusPoints = points * 15_000;
  const bonusPodiums = podiums * 150_000;
  const bonusWins = wins * 400_000;
  const sponsors = Math.round(me.reputation * 12_000);
  const gross = me.salary + bonusPoints + bonusPodiums + bonusWins + sponsors;

  const staffCost = staffAnnualCost(me);
  const fixed = Math.round(gross * 0.15);
  const outgoings = staffCost + fixed;
  const net = gross - outgoings;
  const mult = staffGrowthMultiplier(me);

  return (
    <div className="h-full grid grid-cols-[1fr_1fr_190px] gap-2 min-h-0">
      <Panel title="Entrate" bodyClass="px-3 py-1 scroll-y">
        <Line label="Ingaggio" sub={`contratto ${me.contractYears} ${me.contractYears === 1 ? 'anno' : 'anni'}`} value={money(me.salary)} tone="green" />
        <Line label="Bonus punti" sub={`${points} pt × 15k`} value={money(bonusPoints)} tone={bonusPoints > 0 ? 'green' : undefined} />
        <Line label="Bonus podi" sub={`${podiums} podi × 150k`} value={money(bonusPodiums)} tone={bonusPodiums > 0 ? 'green' : undefined} />
        <Line label="Bonus vittorie" sub={`${wins} vit. × 400k`} value={money(bonusWins)} tone={bonusWins > 0 ? 'green' : undefined} />
        <Line label="Sponsor personali" sub={`reputazione ${Math.round(me.reputation)}`} value={money(sponsors)} tone="green" />
        <div className="flex items-baseline justify-between gap-3 pt-2.5 mt-1 border-t border-line">
          <span className="font-sans text-sm font-semibold">Lordo</span>
          <b className="font-mono text-sm text-primary tnum">{money(gross)}</b>
        </div>
      </Panel>

      <Panel title="Uscite" bodyClass="px-3 py-1 scroll-y">
        <Line
          label="Staff personale"
          sub={me.staff.length === 0 ? 'nessuno sotto contratto' : me.staff.map((s) => ROLE_LABELS[s.role]).join(' · ')}
          value={money(staffCost)}
          tone={staffCost > 0 ? 'bad' : undefined}
        />
        <Line label="Spese fisse (15%)" sub="viaggi, tasse, superlicenza" value={money(fixed)} tone="bad" />
        <div className="flex items-baseline justify-between gap-3 pt-2.5 mt-1 border-t border-line">
          <span className="font-sans text-sm font-semibold">Totale uscite</span>
          <b className="font-mono text-sm text-bad tnum">{money(outgoings)}</b>
        </div>

        {me.staff.length > 0 && (
          <div className="mt-3 pt-2 border-t border-line">
            <div className="field-label mb-1">Sotto contratto</div>
            {me.staff.map((s) => (
              <div key={s.id} className="flex items-baseline justify-between gap-2 py-[3px]">
                <span className="font-mono text-2xs text-muted truncate">
                  {ROLE_LABELS[s.role]} · {s.name}
                </span>
                <span className="font-mono text-2xs text-dim tnum shrink-0">q{s.quality}</span>
              </div>
            ))}
          </div>
        )}
      </Panel>

      <Panel title="Netto" bodyClass="p-3 flex flex-col">
        <div className="flex-1 grid place-items-center text-center">
          <div>
            <div className="field-label">Stagione</div>
            <b className={`block font-display text-4xl font-bold leading-none tnum mt-1 ${net >= 0 ? 'text-primary' : 'text-bad'}`}>
              {net >= 0 ? '+' : '−'}{(Math.abs(net) / 1_000_000).toFixed(1).replace('.', ',')}
            </b>
            <div className="font-mono text-2xs text-dim mt-1">milioni €</div>
          </div>
        </div>
        <div className="border-t border-line pt-2 mt-2">
          <div className="flex items-baseline justify-between">
            <span className="font-mono text-2xs text-muted">Cassa</span>
            <span className="font-mono text-2xs text-ink tnum">{money(me.money)}</span>
          </div>
          <div className="flex items-baseline justify-between mt-1">
            <span className="font-mono text-2xs text-muted">Crescita</span>
            <span className="font-mono text-2xs text-accent tnum">{mult.toFixed(2)}×</span>
          </div>
          <p className="font-mono text-[8.5px] text-dim leading-relaxed mt-2">
            L'ingaggio finanzia la crescita, non è un numero di vanità.
          </p>
        </div>
      </Panel>
    </div>
  );
}
