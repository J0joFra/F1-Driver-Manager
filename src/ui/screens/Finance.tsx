import { useGame } from '../../state/useGame.js';
import { myTeam } from '../../engine/selectors.js';
import { constructorStandings } from '../../engine/season.js';
import {
  operatingCost, PRIZE_BASE, prizeMoney, salaryBill, sponsorIncome,
} from '../../engine/team.js';
import { AREA_LABEL, developmentBurn, PROJECT_SIZES } from '../../engine/projects.js';
import { useProfile } from '../../state/useProfile.js';
import { MIN_INJECTION } from '../../engine/boosts.js';
import { Bar, Btn, Note, Panel } from '../components/kit.js';
import { CurrencyChip } from '../components/Currency.js';
import { money } from '../format.js';

/**
 * Il bilancio della scuderia.
 *
 * Due colonne di conti e una di verdetto. Il numero che conta non è il saldo
 * di fine anno ma l'**autonomia**: a quanto stai spendendo adesso, quante
 * settimane di lavoro hai davanti prima che i cantieri si fermino. È la
 * domanda che ci si fa prima di aprire un progetto, e nella prima versione
 * non era scritta da nessuna parte.
 */
export function Finance() {
  const world = useGame((s) => s.world)!;
  const team = myTeam(world)!;
  const credits = useProfile((s) => s.profile.wallet.credits);
  const inject = useGame((s) => s.injectCredits);

  const table = constructorStandings(world);
  const rank = table.findIndex((c) => c.teamId === team.id);
  const teamCount = Object.keys(world.teams).length;

  const prize = prizeMoney(rank, teamCount);
  const sponsors = sponsorIncome(team);
  const income = prize + sponsors;
  const salaries = salaryBill(world, team);
  const operating = operatingCost(team);
  const net = income - salaries - operating;

  const burn = developmentBurn(team);
  const weeksLeft = burn > 0 ? Math.floor(team.cash / burn) : Infinity;
  const committed = team.projects.reduce((s, p) => s + (p.cost - p.spent), 0);

  return (
    <div className="h-full grid grid-cols-[1fr_1fr_196px] gap-2 min-h-0">
      <Panel title="Entrate di stagione" bodyClass="px-3 py-1 scroll-y">
        <Line
          label="Premio di classifica"
          sub={rank >= 0 ? `${rank + 1}ª su ${teamCount} costruttori` : 'fuori classifica'}
          value={money(prize)}
          tone="green"
        />
        <Line
          label="Sponsor"
          sub={`prestigio ${Math.round(team.prestige)} su 100`}
          value={money(sponsors)}
          tone="green"
        />
        <div className="flex items-baseline justify-between gap-3 pt-2.5 mt-1 border-t border-line">
          <span className="font-sans text-sm font-semibold">Totale</span>
          <b className="font-mono text-sm text-primary tnum">{money(income)}</b>
        </div>

        <div className="mt-3 pt-2 border-t border-line">
          <div className="field-label mb-1">Quanto pesa arrivare davanti</div>
          <div className="flex items-baseline justify-between py-[3px]">
            <span className="font-mono text-2xs text-muted">Ultimo in classifica</span>
            <span className="font-mono text-2xs text-dim tnum">{money(PRIZE_BASE)}</span>
          </div>
          <div className="flex items-baseline justify-between py-[3px]">
            <span className="font-mono text-2xs text-muted">Primo</span>
            <span className="font-mono text-2xs text-ink tnum">{money(prizeMoney(0, teamCount))}</span>
          </div>
          <p className="font-mono text-[8.5px] text-dim leading-relaxed mt-1.5">
            Anche l'ultimo incassa: esserci vale già. È quello che tiene in vita una scuderia
            piccola mentre si costruisce.
          </p>
        </div>
      </Panel>

      <Panel title="Uscite" bodyClass="px-3 py-1 scroll-y">
        <Line
          label="Ingaggi piloti"
          sub={team.driverIds.length === 0
            ? 'nessuno sotto contratto'
            : team.driverIds.map((id) => world.drivers[id]?.name ?? '').join(' · ')}
          value={money(salaries)}
          tone={salaries > 0 ? 'bad' : undefined}
        />
        <Line
          label="Gestione"
          sub="personale, logistica, fabbrica"
          value={money(operating)}
          tone="bad"
        />
        <div className="flex items-baseline justify-between gap-3 pt-2.5 mt-1 border-t border-line">
          <span className="font-sans text-sm font-semibold">Totale</span>
          <b className="font-mono text-sm text-bad tnum">{money(salaries + operating)}</b>
        </div>

        <div className="mt-3 pt-2 border-t border-line">
          <div className="field-label mb-1">Sviluppo, fuori bilancio annuale</div>
          {team.projects.length === 0 && (
            <p className="font-mono text-2xs text-dim py-1">Nessun reparto al lavoro.</p>
          )}
          {team.projects.map((p) => (
            <div key={p.id} className="flex items-baseline justify-between gap-2 py-[3px]">
              <span className="font-mono text-2xs text-muted truncate">
                {AREA_LABEL[p.area]} · {PROJECT_SIZES[p.size].label}
              </span>
              <span className="font-mono text-2xs text-vantar tnum shrink-0">
                {money(Math.round(p.cost - p.spent))} da pagare
              </span>
            </div>
          ))}
          <p className="font-mono text-[8.5px] text-dim leading-relaxed mt-1.5">
            I progetti si pagano a settimana, non a fine anno: è per questo che la cassa va
            guardata durante la stagione.
          </p>
        </div>
      </Panel>

      <div className="flex flex-col gap-2 min-h-0">
        <Panel title="Cassa" className="shrink-0" bodyClass="p-3">
          <div className="text-center">
            <b className={`block font-display text-3xl font-bold leading-none tnum
              ${team.cash > 0 ? 'text-ink' : 'text-bad'}`}>
              {(team.cash / 1_000_000).toFixed(1).replace('.', ',')}
            </b>
            <div className="font-mono text-2xs text-dim mt-1">milioni €</div>
          </div>
          {/* I crediti del portafoglio entrano qui, e solo qui: comprano
              settimane di sviluppo, non un premio di classifica più alto. */}
          <div className="mt-2 pt-2 border-t border-line">
            <div className="flex items-center justify-between gap-2">
              <span className="font-mono text-2xs text-muted">Nel portafoglio</span>
              <CurrencyChip currency="credits" amount={credits} size="sm" />
            </div>
            <Btn
              variant="ghost"
              disabled={credits < MIN_INJECTION}
              onClick={() => inject(Math.min(credits, 20_000_000))}
              testId="inject-credits"
              title={credits < MIN_INJECTION
                ? 'Servono almeno un milione di crediti'
                : 'Versa fino a venti milioni nella cassa della scuderia'}
              className="w-full mt-1.5 !py-1 !text-[10px]"
            >
              Versa in cassa
            </Btn>
          </div>

          <div className="mt-2 pt-2 border-t border-line">
            <Small label="Impegnato" value={money(committed)} />
            <Small label="Spesa a settimana" value={burn > 0 ? money(Math.round(burn)) : '—'} />
            <Small
              label="Saldo di stagione"
              value={`${net >= 0 ? '+' : ''}${money(net)}`}
              tone={net >= 0 ? 'text-good' : 'text-bad'}
            />
          </div>
        </Panel>

        <Panel title="Autonomia" className="flex-1" bodyClass="p-2.5 flex flex-col justify-center">
          {burn > 0 ? (
            <>
              <div className="text-center">
                <b className={`font-display text-2xl font-bold tnum
                  ${weeksLeft < 6 ? 'text-bad' : weeksLeft < 14 ? 'text-accent' : 'text-good'}`}>
                  {Math.min(99, weeksLeft)}
                </b>
                <div className="field-label mt-0.5">settimane di lavoro</div>
              </div>
              <div className="mt-2">
                <Bar
                  value={Math.min(100, (weeksLeft / 24) * 100)}
                  colour={weeksLeft < 6 ? '#E8283C' : weeksLeft < 14 ? '#D4761E' : '#12A06E'}
                  height={5}
                />
              </div>
              {weeksLeft < 6 && (
                <div className="mt-2">
                  <Note tone="warn">
                    Un progetto rimasto senza fondi si ferma: non si annulla, ma non avanza
                    finché la cassa non torna.
                  </Note>
                </div>
              )}
            </>
          ) : (
            <p className="font-mono text-2xs text-dim text-center leading-relaxed">
              Nessun reparto al lavoro. La cassa non cala — e la macchina nemmeno sale.
            </p>
          )}
        </Panel>
      </div>
    </div>
  );
}

function Line({ label, sub, value, tone }: {
  label: string; sub?: string; value: string; tone?: 'green' | 'bad';
}) {
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

function Small({ label, value, tone = 'text-ink' }: { label: string; value: string; tone?: string }) {
  return (
    <div className="flex items-baseline justify-between gap-2 py-[3px]">
      <span className="font-mono text-2xs text-muted truncate">{label}</span>
      <span className={`font-mono text-2xs tnum shrink-0 ${tone}`}>{value}</span>
    </div>
  );
}
