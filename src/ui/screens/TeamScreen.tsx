import { useGame } from '../../state/useGame.js';
import { myTeam } from '../../engine/selectors.js';
import { carPace } from '../../engine/regulations.js';
import { constructorStandings } from '../../engine/season.js';
import { AREA_LABEL, developmentBurn } from '../../engine/projects.js';
import {
  operatingCost, prizeMoney, renewalSalary, salaryBill, sponsorIncome,
} from '../../engine/team.js';
import { overall, potentialOverall } from '../../engine/driver.js';
import { CAR_KEYS } from '../../engine/types.js';
import { Bar, Btn, Note, Panel, TeamBadge } from '../components/kit.js';
import { money } from '../format.js';

/**
 * La plancia della scuderia.
 *
 * Tre colonne, e ognuna risponde a una domanda che il giocatore si fa
 * continuamente: **chi sono** (identità, prestigio, personale), **cosa ho**
 * (la monoposto, voce per voce, con la griglia come riferimento) e **quanto
 * reggo** (i conti, e cosa succede se non cambia niente).
 */
export function TeamScreen() {
  const world = useGame((s) => s.world)!;
  const team = myTeam(world)!;
  const goTo = useGame((s) => s.goTo);
  const renew = useGame((s) => s.renew);

  const others = Object.values(world.teams).filter((t) => t.id !== team.id);
  const rank = [...Object.values(world.teams)]
    .sort((a, b) => carPace(b.car) - carPace(a.car))
    .findIndex((t) => t.id === team.id) + 1;
  const table = constructorStandings(world);
  const champPos = table.findIndex((c) => c.teamId === team.id) + 1;

  const prize = prizeMoney(champPos - 1, Object.keys(world.teams).length);
  const sponsors = sponsorIncome(team);
  const salaries = salaryBill(world, team);
  const operating = operatingCost(team);
  const net = prize + sponsors - salaries - operating;
  const burn = developmentBurn(team);

  return (
    <div className="h-full grid grid-cols-[214px_1fr_216px] gap-2 min-h-0">
      <div className="flex flex-col gap-2 min-h-0">
        <Panel title="La scuderia" className="shrink-0" bodyClass="p-2.5">
          <div className="flex items-center gap-2.5">
            <TeamBadge name={team.name} colour={team.colour} />
            <div className="min-w-0">
              <div className="font-sans text-xs font-bold truncate">{team.name}</div>
              <div className="font-mono text-2xs text-muted">
                {champPos > 0 ? `${champPos}ª in campionato` : 'fuori classifica'}
              </div>
            </div>
          </div>
          <div className="mt-2.5 pt-2 border-t border-line">
            <Meter label="Prestigio" value={team.prestige} colour="#A06BE0" />
            <Meter label="Dir. tecnico" value={team.crew.technical} colour="#3E86F0" />
            <Meter label="Ing. di pista" value={team.crew.trackEngineer} colour="#0E7C97" />
            <Meter label="Pit crew" value={team.crew.pitCrew} colour="#D4761E" />
          </div>
        </Panel>

        <Panel title="Regolamento" className="flex-1" bodyClass="p-2.5 scroll-y">
          <Row label="Prossimo azzeramento" value={String(world.regulations.nextResetYear)} tone="text-accent" />
          <Row label="Ultimo" value={String(world.regulations.lastResetYear)} />
          <p className="font-mono text-[8.5px] text-dim leading-relaxed mt-1.5">
            Un azzeramento riporta tutte le monoposto al livello di riferimento e lascia in piedi
            metà del vantaggio di chi era avanti. È l'occasione di chi insegue, e chiude i
            cantieri aperti.
          </p>
        </Panel>
      </div>

      <div className="flex flex-col gap-2 min-h-0">
        <Panel
          title="La monoposto"
          tag={`${rank}ª forza su ${Object.keys(world.teams).length} per passo`}
          className="shrink-0"
          bodyClass="p-2.5"
        >
          {CAR_KEYS.map((k) => {
            const mean = others.reduce((s, t) => s + t.car[k], 0) / Math.max(1, others.length);
            const behind = mean - team.car[k];
            const project = team.projects.find((p) => p.area === k);
            return (
              <div key={k} className="py-[5px] border-b border-line/50 last:border-0">
                <div className="flex items-baseline justify-between gap-2">
                  <span className="font-sans text-2xs text-ink">{AREA_LABEL[k]}</span>
                  <span className="flex items-baseline gap-2">
                    {project && (
                      <span className="font-mono text-[8.5px] text-vantar">
                        in lavorazione · {project.weeksLeft} sett.
                      </span>
                    )}
                    <span className={`font-mono text-[9px] tnum ${behind > 0 ? 'text-bad' : 'text-good'}`}>
                      {behind > 0 ? '−' : '+'}{Math.abs(behind).toFixed(1)}
                    </span>
                    <b className="font-mono text-xs tnum">{Math.round(team.car[k])}</b>
                  </span>
                </div>
                <div className="relative mt-1">
                  <Bar value={team.car[k]} colour={behind > 0 ? '#D4761E' : '#12A06E'} height={5} />
                  <span className="absolute inset-y-0 w-px bg-ink/50" style={{ left: `${mean}%` }} />
                </div>
              </div>
            );
          })}
          <p className="font-mono text-[8.5px] text-dim mt-1.5">
            La tacca è la media delle altre otto scuderie.
          </p>
        </Panel>

        <Panel title="I tuoi piloti" className="flex-1" bodyClass="p-2 scroll-y">
          {team.driverIds.length === 0 && (
            <Note tone="warn">
              Nessun pilota sotto contratto: la scuderia non prende il via.
            </Note>
          )}
          {team.driverIds.map((id, i) => {
            const d = world.drivers[id];
            if (!d) return null;
            const expiring = d.contractYears <= 1;
            const ask = renewalSalary(world, d, team, 'prima');
            return (
              <div key={id} className="rounded border border-line bg-panel2 px-2.5 py-1.5 mb-1.5 last:mb-0">
                <div className="flex items-center justify-between gap-2">
                  <span className="font-sans text-xs font-bold truncate">{d.name}</span>
                  <span className="font-mono text-[8.5px] text-dim shrink-0">{i + 1}ª guida</span>
                </div>
                <div className="grid grid-cols-4 gap-1 mt-1.5">
                  <Cell k="OVR" v={Math.round(overall(d.attrs))} />
                  <Cell k="POT" v={Math.round(potentialOverall(d))} tone="text-primary" />
                  <Cell k="Età" v={d.age} />
                  <Cell k="Ingaggio" v={money(d.salary)} />
                </div>
                {expiring && (
                  <div className="flex items-center justify-between gap-2 mt-1.5 pt-1.5 border-t border-line/60">
                    <span className="font-mono text-[8.5px] text-accent">
                      contratto in scadenza · chiede {money(ask)}
                    </span>
                    <Btn
                      variant="ghost" className="!py-0.5 !px-2 !text-[9px]"
                      testId={`renew-${i}`}
                      onClick={() => renew(d.id, { years: 3, salary: ask, role: 'prima' })}
                    >
                      Rinnova 3 anni
                    </Btn>
                  </div>
                )}
              </div>
            );
          })}
        </Panel>
      </div>

      <div className="flex flex-col gap-2 min-h-0">
        <Panel title="Cassa" className="shrink-0" bodyClass="p-2.5">
          <div className="text-center py-1">
            <div className={`font-display text-2xl font-bold leading-none tnum
              ${team.cash > 0 ? 'text-ink' : 'text-bad'}`}>
              {money(team.cash)}
            </div>
            <div className="field-label mt-1">disponibili</div>
          </div>
          <div className="mt-1.5 pt-1.5 border-t border-line">
            <Row label="Sviluppo in corso" value={burn > 0 ? `${money(Math.round(burn))}/sett` : 'fermo'}
              tone={burn > 0 ? 'text-vantar' : 'text-dim'} />
            <Row label="Saldo di stagione" value={`${net >= 0 ? '+' : ''}${money(net)}`}
              tone={net >= 0 ? 'text-good' : 'text-bad'} />
          </div>
          <Btn variant="green" className="w-full mt-2" onClick={() => goTo('sviluppo')} testId="goto-dev">
            Sviluppo
          </Btn>
        </Panel>

        <Panel title="Conto della stagione" className="flex-1" bodyClass="p-2.5 scroll-y">
          <Row label="Premio di classifica" value={`+${money(prize)}`} tone="text-good" />
          <Row label="Sponsor" value={`+${money(sponsors)}`} tone="text-good" />
          <Row label="Ingaggi piloti" value={`−${money(salaries)}`} tone="text-bad" />
          <Row label="Gestione" value={`−${money(operating)}`} tone="text-bad" />
          <p className="font-mono text-[8.5px] text-dim leading-relaxed mt-2 pt-2 border-t border-line">
            Il premio dipende da dove chiudi, gli sponsor dal prestigio. La gestione cresce con
            la qualità del personale: assumere meglio costa, ed è il motivo per cui non si assume
            e basta.
          </p>
        </Panel>
      </div>
    </div>
  );
}

function Meter({ label, value, colour }: { label: string; value: number; colour: string }) {
  return (
    <div className="py-1">
      <div className="flex items-baseline justify-between mb-0.5">
        <span className="font-mono text-2xs text-muted">{label}</span>
        <span className="font-mono text-2xs text-ink tnum">{Math.round(value)}</span>
      </div>
      <Bar value={value} colour={colour} height={4} />
    </div>
  );
}

function Row({ label, value, tone = 'text-ink' }: { label: string; value: string; tone?: string }) {
  return (
    <div className="flex items-baseline justify-between gap-2 py-[3px]">
      <span className="font-mono text-2xs text-muted truncate">{label}</span>
      <span className={`font-mono text-2xs tnum shrink-0 ${tone}`}>{value}</span>
    </div>
  );
}

function Cell({ k, v, tone = 'text-ink' }: { k: string; v: string | number; tone?: string }) {
  return (
    <div className="bg-panel border border-line rounded px-1.5 py-1">
      <div className="field-label">{k}</div>
      <div className={`font-mono text-[10px] tnum mt-0.5 truncate ${tone}`}>{v}</div>
    </div>
  );
}
