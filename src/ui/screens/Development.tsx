import { AlertTriangle, Wrench, X, Zap } from 'lucide-react';
import { useGame } from '../../state/useGame.js';
import { myTeam } from '../../engine/selectors.js';
import {
  AREA_LABEL, developmentBurn, PROJECT_SIZE_KEYS, PROJECT_SIZES, startRefusal, weeklyCost,
} from '../../engine/projects.js';
import { CAR_KEYS } from '../../engine/types.js';
import { DEV_BAND, promotionProgress, tierFloor } from '../../engine/tiers.js';
import { roomFor } from '../../engine/phases.js';
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
  const spend = useGame((s) => s.spendDevCredit);
  const wallet = useProfile((s) => s.profile.wallet);

  // Il riferimento non è più la media della griglia ma il blocco della fascia:
  // dentro una fascia le monoposto partono identiche, quindi «sei sopra o sotto
  // la media» non dice niente — mentre «quanto hai staccato dal blocco» è
  // esattamente la domanda a cui serve rispondere, ed è anche la condizione per
  // salire di fascia.
  const band = promotionProgress(team);

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
        {/* La fascia è la monoposto. La barra sotto è quanto hai staccato dal
            blocco: è quello che a fine anno si confronta con la scuderia più
            debole della fascia sopra, e il posto si prende a lei. */}
        <div className="shrink-0 text-center px-2">
          <div className="font-display text-base font-bold leading-none">Fascia {team.tier}</div>
          <div className="mt-1 w-[72px]">
            <Bar value={band * 100} colour={band > 0.75 ? '#12A06E' : '#3E86F0'} height={4} />
          </div>
        </div>
        {team.devCredit > 0.01 && (
          <span className="shrink-0 font-display text-2xs font-bold uppercase tracking-wide text-accent">
            bonus {team.devCredit.toFixed(2)}
          </span>
        )}
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
          const floor = tierFloor(team.tier, area);
          const room = roomFor(team, area);
          // Dove sta il reparto dentro la banda della fascia, da 0 a 1.
          const fill = (mine - floor) / (DEV_BAND * 2);
          const credit = Math.min(team.devCredit, room, 0.5);

          return (
            <Panel
              key={area}
              title={AREA_LABEL[area]}
              tag={`${mine.toFixed(1)} · ${room > 0.05 ? `+${room.toFixed(1)} di margine` : 'in cima alla fascia'}`}
              bodyClass="p-2 flex flex-col min-h-0"
            >
              <div className="relative shrink-0">
                <Bar value={fill * 100} colour={room > 0.05 ? '#3E86F0' : '#12A06E'} height={6} />
                {/* Il blocco della fascia: sotto sei sotto la tua categoria,
                    sopra stai costruendo il sorpasso. */}
                <span className="absolute inset-y-0 w-px bg-ink/50" style={{ left: '50%' }} />
              </div>

              {/* Il bonus di fase si spende qui, dove si vede quanto margine
                  resta: versarlo su un reparto già pieno lo brucerebbe. */}
              {team.devCredit > 0.01 && (
                <Btn
                  variant="ghost"
                  disabled={credit <= 0.01}
                  title={credit > 0.01
                    ? `Versa ${credit.toFixed(2)} punti del bonus su ${AREA_LABEL[area].toLowerCase()}`
                    : 'Questo reparto è in cima alla fascia: il bonus andrebbe perso'}
                  onClick={() => spend(area, credit)}
                  className="mt-1.5 py-1 shrink-0"
                  testId={`bonus-${area}`}
                >
                  <Zap className="w-3 h-3" /> bonus +{credit.toFixed(2)}
                </Btn>
              )}

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
