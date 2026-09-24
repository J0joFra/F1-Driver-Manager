import { PALETTE } from '../palette.js';
import { AlertTriangle, Flag, UserPlus, Wrench } from 'lucide-react';
import { useGame } from '../../state/useGame.js';
import { isRaceWeek, myTeam, nextRace } from '../../engine/selectors.js';
import { constructorStandings, driverStandings } from '../../engine/season.js';
import { AREA_LABEL, developmentBurn, PROJECT_SIZES } from '../../engine/projects.js';
import { carPace } from '../../engine/regulations.js';
import { overall } from '../../engine/driver.js';
import { getTrack } from '../../engine/data/tracks.js';
import { Bar, Btn, Note, Panel, Stat, TeamDot } from '../components/kit.js';
import { money } from '../format.js';

/**
 * Il cruscotto della scuderia.
 *
 * A sinistra come stai: cassa, macchina, piloti. Al centro cosa ti aspetta e
 * come va il campionato. A destra chi sta vincendo. È la schermata da cui si
 * avanza, quindi tutto quello che potrebbe fermarti — un sedile vuoto, un
 * reparto fermo, la cassa agli sgoccioli — deve essere visibile da qui, e
 * cliccabile.
 */
export function Paddock({ onAdvance }: { onAdvance: () => void }) {
  const world = useGame((s) => s.world)!;
  const team = myTeam(world)!;
  const goTo = useGame((s) => s.goTo);
  const race = nextRace(world);
  const track = race ? getTrack(race.trackId) : null;
  const drivers = driverStandings(world).slice(0, 10);
  const teams = constructorStandings(world);
  const myPos = teams.findIndex((c) => c.teamId === team.id) + 1;

  const others = Object.values(world.teams).filter((t) => t.id !== team.id);
  const meanPace = others.reduce((s, t) => s + carPace(t.car), 0) / Math.max(1, others.length);
  const burn = developmentBurn(team);
  const weeksLeft = burn > 0 ? Math.floor(team.cash / burn) : Infinity;

  const noDrivers = team.driverIds.length === 0;
  const idleFactory = team.projects.length === 0;

  return (
    <div className="h-full grid grid-cols-[206px_1fr_206px] gap-2 min-h-0">
      {/* ---- la scuderia ---- */}
      <div className="flex flex-col gap-2 min-h-0">
        <Panel title="La tua scuderia" className="shrink-0" bodyClass="p-2.5">
          <div className="flex items-center gap-2">
            <TeamDot colour={team.colour} />
            <span className="font-sans text-xs font-bold truncate">{team.name}</span>
          </div>
          {/* Due numeri grandi e uno scritto: «75,00M» in una colonna da
              sessanta pixel esce dal riquadro, e tre etichette lunghe si
              toccano fra loro. */}
          <div className="grid grid-cols-2 gap-1 mt-2 pt-2 border-t border-line">
            <Stat value={myPos > 0 ? `P${myPos}` : '—'} label="Costruttori" tone="accent" />
            <Stat value={Math.round(team.prestige)} label="Prestigio" />
          </div>
          <div className="flex items-baseline justify-between gap-2 mt-1.5 pt-1.5 border-t border-line">
            <span className="font-mono text-2xs text-muted">In cassa</span>
            <span className={`font-mono text-xs tnum ${team.cash > 0 ? 'text-ink' : 'text-bad'}`}>
              {money(team.cash)}
            </span>
          </div>
          <div className="mt-2 pt-2 border-t border-line">
            <div className="field-label mb-1">Passo della monoposto</div>
            <div className="relative">
              <Bar
                value={carPace(team.car)}
                colour={carPace(team.car) >= meanPace ? '#12A06E' : '#D4761E'}
                height={6}
              />
              <span className="absolute inset-y-0 w-px bg-ink/50" style={{ left: `${meanPace}%` }} />
            </div>
            <div className="font-mono text-[8.5px] text-dim mt-1">
              {(meanPace - carPace(team.car)).toFixed(1)} punti dalla media della griglia
            </div>
          </div>
        </Panel>

        <Panel title="I tuoi piloti" className="flex-1" bodyClass="p-2.5 scroll-y">
          {noDrivers ? (
            <>
              <Note tone="warn">Nessun pilota: la scuderia non prende il via.</Note>
              <Btn variant="green" className="w-full mt-2" onClick={() => goTo('mercato')} testId="paddock-market">
                <UserPlus className="w-3.5 h-3.5" /> Mercato piloti
              </Btn>
            </>
          ) : team.driverIds.map((id) => {
            const d = world.drivers[id];
            if (!d) return null;
            const pos = driverStandings(world).findIndex((r) => r.driverId === id) + 1;
            return (
              <button
                key={id}
                type="button"
                onClick={() => { useGame.getState().select(id); goTo('piloti'); }}
                className="w-full text-left py-1.5 border-b border-line/60 last:border-0 hover:bg-white/5 px-1 -mx-1 rounded"
              >
                <div className="flex items-baseline justify-between gap-2">
                  <span className="font-sans text-xs truncate">{d.name}</span>
                  <span className="font-mono text-2xs text-dim tnum shrink-0">
                    {pos > 0 ? `P${pos}` : '—'}
                  </span>
                </div>
                <div className="flex items-baseline justify-between gap-2 mt-0.5">
                  <span className="font-mono text-[8.5px] text-dim">
                    {d.age} anni · {d.contractYears > 0 ? `${d.contractYears} anni` : 'in scadenza'}
                  </span>
                  <span className="font-mono text-2xs tnum">{Math.round(overall(d.attrs))}</span>
                </div>
              </button>
            );
          })}
        </Panel>
      </div>

      {/* ---- il weekend e il campionato ---- */}
      <div className="flex flex-col gap-2 min-h-0">
        <Panel
          title="Prossimo weekend"
          tag={race ? `Round ${race.round}` : ''}
          className="shrink-0"
          bodyClass="p-2.5"
        >
          {race && track ? (
            <div className="text-center">
              <div className="font-sans text-[9px] tracking-[0.2em] uppercase text-muted">
                {isRaceWeek(world)
                  ? 'Settimana di gara'
                  : `Fra ${race.weeksAway} settiman${race.weeksAway === 1 ? 'a' : 'e'}`}
              </div>
              <h2 className="font-sans text-base font-bold mt-0.5 leading-tight">{track.name}</h2>
              <div className="flex justify-center gap-7 mt-2">
                <Stat className="items-center" value={track.laps} label="Giri" />
                <Stat className="items-center" value={`${Math.round(track.overtaking * 100)}%`} label="Sorpasso" />
                <Stat className="items-center" value={track.drsZones} label="Zone DRS" />
              </div>
              <button
                type="button"
                onClick={onAdvance}
                data-testid="paddock-advance"
                className="mt-2.5 inline-flex items-center gap-1.5 rounded bg-primary px-4 py-1.5 text-xs
                  font-sans font-semibold text-white hover:brightness-110 transition"
              >
                <Flag className="w-3.5 h-3.5" />
                {isRaceWeek(world) ? 'Vai alla gara' : 'Avanza'}
              </button>
            </div>
          ) : (
            <p className="text-center text-xs text-muted py-3">
              Il calendario è finito. Chiudi l'anno per passare alla stagione successiva.
            </p>
          )}
        </Panel>

        {/* Quello che ti sta costando adesso, dove lo vedi prima di avanzare. */}
        {(idleFactory || weeksLeft < 6) && (
          <button
            type="button"
            onClick={() => goTo('sviluppo')}
            data-testid="paddock-dev-alert"
            className="shrink-0 panel px-3 py-1.5 flex items-center gap-2 text-left hover:border-dim transition"
          >
            {idleFactory
              ? <Wrench className="w-3.5 h-3.5 text-accent shrink-0" />
              : <AlertTriangle className="w-3.5 h-3.5 text-bad shrink-0" />}
            <div className="min-w-0 flex-1">
              <div className="font-sans text-2xs font-semibold truncate">
                {idleFactory ? 'Nessun reparto al lavoro' : 'La cassa sta finendo'}
              </div>
              <div className="font-mono text-[8.5px] text-dim truncate">
                {idleFactory
                  ? 'La macchina non migliora da sola: gli altri sì.'
                  : `${weeksLeft} settimane al ritmo di spesa attuale.`}
              </div>
            </div>
            <span className="font-mono text-[9px] text-dim shrink-0">sviluppo →</span>
          </button>
        )}

        <Panel title="Classifica piloti" className="flex-1" bodyClass="p-0 scroll-y">
          {drivers.map((row) => {
            const d = world.drivers[row.driverId];
            if (!d) return null;
            const t = d.teamId ? world.teams[d.teamId] : null;
            const mine = d.teamId === team.id;
            return (
              <div
                key={row.driverId}
                className={`grid grid-cols-[22px_10px_1fr_auto] items-center gap-2 px-3 py-[5px]
                  border-b border-line/60 last:border-0 ${mine ? 'bg-primary/10' : ''}`}
              >
                <span className="font-mono text-2xs text-dim text-right tnum">{row.position}</span>
                <TeamDot colour={t?.colour ?? PALETTE.dim} />
                <span className={`font-sans text-xs truncate ${mine ? 'text-primary font-semibold' : ''}`}>
                  {d.name}
                </span>
                <span className="font-mono text-2xs text-accent tnum">{row.points}</span>
              </div>
            );
          })}
        </Panel>
      </div>

      {/* ---- i reparti e i costruttori ---- */}
      <div className="flex flex-col gap-2 min-h-0">
        <Panel title="I reparti" className="shrink-0" bodyClass="p-2.5">
          {team.projects.length === 0 && (
            <p className="font-mono text-2xs text-dim py-0.5">Tutti fermi.</p>
          )}
          {team.projects.map((p) => (
            <div key={p.id} className="py-1 border-b border-line/50 last:border-0">
              <div className="flex items-baseline justify-between gap-2">
                <span className="font-mono text-2xs text-muted truncate">{AREA_LABEL[p.area]}</span>
                <span className="font-mono text-[9px] text-dim tnum shrink-0">
                  {p.weeksLeft} sett.
                </span>
              </div>
              <div className="mt-1">
                <Bar value={((p.weeks - p.weeksLeft) / p.weeks) * 100} colour="#3E86F0" height={4} />
              </div>
              <div className="font-mono text-[8px] text-dim mt-0.5">{PROJECT_SIZES[p.size].label}</div>
            </div>
          ))}
          <div className="mt-1.5 pt-1.5 border-t border-line flex items-baseline justify-between">
            <span className="font-mono text-2xs text-muted">Spesa</span>
            <span className="font-mono text-2xs text-vantar tnum">
              {burn > 0 ? `${money(Math.round(burn))}/sett` : '—'}
            </span>
          </div>
        </Panel>

        <Panel title="Classifica scuderie" className="flex-1" bodyClass="p-0 scroll-y">
          {teams.map((c, i) => {
            const t = world.teams[c.teamId];
            if (!t) return null;
            const mine = c.teamId === team.id;
            return (
              <div
                key={c.teamId}
                className={`grid grid-cols-[16px_10px_1fr_auto] items-center gap-2 px-3 py-[5px]
                  border-b border-line/60 last:border-0 ${mine ? 'bg-primary/10' : ''}`}
              >
                <span className="font-mono text-2xs text-dim text-right tnum">{i + 1}</span>
                <TeamDot colour={t.colour} />
                <span className={`font-sans text-xs truncate ${mine ? 'text-primary font-semibold' : ''}`}>
                  {t.short}
                </span>
                <span className="font-mono text-2xs text-accent tnum">{c.points}</span>
              </div>
            );
          })}
        </Panel>
      </div>
    </div>
  );
}
