import { AlertTriangle, Wrench, X, Zap } from 'lucide-react';
import { useGame } from '../../state/useGame.js';
import { myTeam } from '../../engine/selectors.js';
import {
  AREA_LABEL, developmentBurn, PROJECT_SIZE_KEYS, PROJECT_SIZES, startRefusal, weeklyCost,
} from '../../engine/projects.js';
import { CAR_KEYS, type CarKey } from '../../engine/types.js';
import { useProfile } from '../../state/useProfile.js';
import { researchRoom, rushCost, rushRefusal } from '../../engine/boosts.js';
import { Bar, Btn, Panel } from '../components/kit.js';
import { CurrencyChip } from '../components/Currency.js';
import { money } from '../format.js';

/**
 * Lo sviluppo: quattro reparti, un progetto per reparto.
 *
 * La schermata è costruita attorno alla decisione, non attorno ai dati. Ogni
 * reparto è una riga: quanto vale adesso rispetto alla griglia, cosa ci sta
 * lavorando e quanto manca, e — se è libero — i tre progetti che puoi
 * aprirci. Il motivo per cui non puoi aprirne uno è scritto dove premeresti,
 * non in un messaggio che compare dopo.
 */
export function Development() {
  const world = useGame((s) => s.world)!;
  const team = myTeam(world)!;
  const open = useGame((s) => s.openProject);
  const close = useGame((s) => s.closeProject);
  const rush = useGame((s) => s.rush);
  const wallet = useProfile((s) => s.profile.wallet);

  const others = Object.values(world.teams).filter((t) => t.id !== team.id);
  const fieldMean = (k: CarKey) => others.reduce((s, t) => s + t.car[k], 0) / Math.max(1, others.length);

  const burn = developmentBurn(team);
  // Quante settimane regge la cassa al ritmo di spesa attuale. È il numero che
  // decide tutto e non compariva da nessuna parte nella prima versione.
  const weeksLeft = burn > 0 ? Math.floor(team.cash / burn) : Infinity;

  return (
    <div className="h-full flex flex-col gap-2 min-h-0">
      <div className="shrink-0 panel px-3 py-2 flex items-center gap-4">
        <Wrench className="w-4 h-4 text-dim shrink-0" />
        <Head label="In cassa" value={money(team.cash)} tone={team.cash > 0 ? 'text-ink' : 'text-bad'} />
        <Head label="Spesa a settimana" value={burn > 0 ? money(Math.round(burn)) : '—'} />
        <Head
          label="Autonomia"
          value={burn > 0 ? `${Math.min(99, weeksLeft)} sett.` : 'ferma'}
          tone={burn > 0 && weeksLeft < 6 ? 'text-bad' : 'text-ink'}
        />
        <Head label="Reparti al lavoro" value={`${team.projects.length} su 4`} />
        <span className="flex-1" />
        <CurrencyChip currency="research" amount={wallet.research} />
        {burn > 0 && weeksLeft < 6 && (
          <span className="flex items-center gap-1 font-mono text-2xs text-bad">
            <AlertTriangle className="w-3 h-3" />
            i lavori si fermeranno
          </span>
        )}
      </div>

      <div className="flex-1 grid grid-cols-2 grid-rows-2 gap-2 min-h-0">
        {CAR_KEYS.map((area) => {
          const project = team.projects.find((p) => p.area === area);
          const mine = team.car[area];
          const mean = fieldMean(area);
          const behind = mean - mine;

          return (
            <Panel
              key={area}
              title={AREA_LABEL[area]}
              tag={`${Math.round(mine)} · ${behind >= 0 ? '−' : '+'}${Math.abs(behind).toFixed(1)} sulla griglia`}
              bodyClass="p-2 flex flex-col min-h-0"
            >
              <div className="relative shrink-0">
                <Bar value={mine} colour={behind > 0 ? '#D4761E' : '#12A06E'} height={6} />
                {/* Dove sta la griglia: il riferimento che conta. */}
                <span className="absolute inset-y-0 w-px bg-ink/50" style={{ left: `${mean}%` }} />
              </div>

              {project ? (
                <div className="mt-2 flex-1 flex flex-col justify-center">
                  <div className="flex items-baseline justify-between gap-2">
                    <span className="font-sans text-2xs font-bold">
                      {PROJECT_SIZES[project.size].label}
                    </span>
                    <span className="font-mono text-[9px] text-dim tnum">
                      {project.weeksLeft} settiman{project.weeksLeft === 1 ? 'a' : 'e'}
                    </span>
                  </div>
                  <div className="mt-1.5">
                    <Bar
                      value={((project.weeks - project.weeksLeft) / project.weeks) * 100}
                      colour="#3E86F0" height={5}
                    />
                  </div>
                  <div className="flex items-baseline justify-between gap-2 mt-1.5">
                    <span className="font-mono text-[9px] text-dim tnum">
                      {money(Math.round(project.spent))} di {money(project.cost)}
                    </span>
                    <button
                      type="button"
                      onClick={() => close(project.id)}
                      title="Quello che è stato speso resta speso"
                      className="inline-flex items-center gap-0.5 font-mono text-[9px] text-bad hover:underline"
                    >
                      <X className="w-2.5 h-2.5" /> annulla
                    </button>
                  </div>

                  {/* Accorciare costa un gettone e il lavoro saltato, pagato
                      subito: il gettone compra tempo, non lavoro. */}
                  {researchRoom(project) > 0 && (() => {
                    const refusal = rushRefusal(wallet, team, project, 1);
                    return (
                      <Btn
                        variant="ghost"
                        disabled={refusal !== null}
                        title={refusal ?? `Due settimane in meno, e ${money(rushCost(project, 1))} subito`}
                        onClick={() => rush(project.id, 1)}
                        testId={`rush-${area}`}
                        className="mt-1.5 w-full !py-1 !text-[10px]"
                      >
                        <Zap className="w-3 h-3" />
                        −2 settimane · 1 gettone
                      </Btn>
                    );
                  })()}
                </div>
              ) : (
                <div className="mt-2 flex-1 grid grid-rows-3 gap-1">
                  {PROJECT_SIZE_KEYS.map((size) => {
                    const spec = PROJECT_SIZES[size];
                    const refusal = startRefusal(team, area, size);
                    const affordable = team.cash >= spec.cost * 0.35;
                    return (
                      <Btn
                        key={size}
                        variant={affordable && !refusal ? 'ghost' : 'ghost'}
                        disabled={!!refusal}
                        onClick={() => open(area, size)}
                        title={refusal ?? spec.hint}
                        testId={`dev-${area}-${size}`}
                        className="w-full !justify-between !px-2 !py-1 !text-[10px]"
                      >
                        <span className={affordable ? '' : 'text-dim'}>{spec.label}</span>
                        <span className="font-mono text-[9px] tnum text-dim">
                          {spec.weeks} sett · {money(spec.cost)} · {money(Math.round(weeklyCost({
                            id: '', area, size, weeks: spec.weeks, weeksLeft: spec.weeks,
                            cost: spec.cost, spent: 0,
                          })))}/sett
                        </span>
                      </Btn>
                    );
                  })}
                </div>
              )}
            </Panel>
          );
        })}
      </div>
    </div>
  );
}

function Head({ label, value, tone = 'text-ink' }: { label: string; value: string; tone?: string }) {
  return (
    <div>
      <div className="field-label">{label}</div>
      <div className={`font-mono text-xs tnum ${tone}`}>{value}</div>
    </div>
  );
}
