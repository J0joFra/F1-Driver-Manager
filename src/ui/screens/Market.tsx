import { useState } from 'react';
import { AlertTriangle, Check } from 'lucide-react';
import { useGame } from '../../state/useGame.js';
import { myTeam } from '../../engine/selectors.js';
import { askingSalary, offerFor, signingRefusal, UNREACHABLE_STEP } from '../../engine/team.js';
import { marketValue, SEATS_PER_TEAM } from '../../engine/market.js';
import { overall, potentialOverall } from '../../engine/driver.js';
import type { Driver } from '../../engine/types.js';
import { Btn, DriverBadge, Panel } from '../components/kit.js';
import { money } from '../format.js';

/**
 * Il mercato, dal lato di chi ingaggia.
 *
 * Nella Modalità Pilota si aspettavano le offerte; qui le si fanno. La
 * differenza non è cosmetica: la lista è ordinata per quanto vale un pilota,
 * ma la colonna che decide è **quanto chiede per venire da te**, che dipende
 * dal tuo prestigio. È lì che si legge, in una riga, perché una scuderia nuova
 * non può comprarsi la griglia.
 */
export function Market() {
  const world = useGame((s) => s.world)!;
  const team = myTeam(world)!;
  const sign = useGame((s) => s.sign);
  const refusalMsg = useGame((s) => s.refusal);
  const [years, setYears] = useState(2);
  const [picked, setPicked] = useState<string | null>(null);

  const free = Object.values(world.drivers)
    .filter((d) => !d.retired && !d.teamId)
    .sort((a, b) => marketValue(b) - marketValue(a));

  const seats = SEATS_PER_TEAM - team.driverIds.length;
  const selected = picked ? world.drivers[picked] ?? null : null;

  return (
    <div className="h-full grid grid-cols-[1fr_232px] gap-2 min-h-0">
      <Panel
        title="Piloti senza contratto"
        tag={seats > 0 ? `${seats} sedil${seats === 1 ? 'e' : 'i'} liber${seats === 1 ? 'o' : 'i'}` : 'nessun sedile libero'}
        bodyClass="p-0 scroll-y"
      >
        <div className="grid grid-cols-[1fr_38px_38px_44px_74px_66px] gap-2 px-3 py-1 border-b border-line
          sticky top-0 bg-panel z-10 field-label">
          <span>Pilota</span><span className="text-right">OVR</span><span className="text-right">POT</span>
          <span className="text-right">Età</span><span className="text-right">Chiede</span><span />
        </div>
        {free.slice(0, 40).map((d) => {
          const asking = askingSalary(world, d, team);
          const terms = { years, salary: asking, role: 'prima' as const };
          const refusal = signingRefusal(world, d, team, terms);
          const unreachable = refusal === 'Non guiderebbe per voi a nessuna cifra';
          return (
            <button
              key={d.id}
              type="button"
              onClick={() => setPicked(d.id)}
              className={`w-full text-left grid grid-cols-[1fr_38px_38px_44px_74px_66px] gap-2 items-center
                px-3 py-[5px] border-b border-line/60 last:border-0 transition
                ${picked === d.id ? 'bg-primary/10' : 'hover:bg-white/5'}`}
            >
              <span className={`font-sans text-xs truncate ${unreachable ? 'text-dim' : ''}`}>{d.name}</span>
              <span className="font-mono text-2xs tnum text-right">{Math.round(overall(d.attrs))}</span>
              <span className="font-mono text-2xs tnum text-right text-primary">{Math.round(potentialOverall(d))}</span>
              <span className="font-mono text-2xs tnum text-right text-muted">{d.age}</span>
              <span className={`font-mono text-2xs tnum text-right ${unreachable ? 'text-dim' : 'text-accent'}`}>
                {unreachable ? '—' : money(asking)}
              </span>
              <span className="font-mono text-[8.5px] text-right truncate">
                {refusal === null
                  ? <span className="text-good">firmerebbe</span>
                  : <span className="text-dim">{unreachable ? 'irraggiungibile' : 'no'}</span>}
              </span>
            </button>
          );
        })}
        {free.length === 0 && (
          <p className="p-3 font-mono text-2xs text-dim">Nessun pilota libero: si riapre a fine stagione.</p>
        )}
      </Panel>

      {/* Una colonna sola, e il pulsante di firma inchiodato in fondo.
          Prima erano due pannelli impilati: il secondo cresceva oltre lo
          spazio e finiva sopra il pulsante, che restava visibile e non si
          poteva premere. */}
      <Panel title="Offerta" bodyClass="p-2.5 flex flex-col min-h-0">
        {selected ? (
          <Offer
            world={world} driver={selected} years={years} setYears={setYears}
            refusalMsg={refusalMsg}
            onSign={(terms) => sign(selected.id, terms)}
          />
        ) : (
          <div className="flex-1 min-h-0 scroll-y">
            <p className="font-mono text-2xs text-dim leading-relaxed">
              Scegli un pilota dall'elenco per preparargli un contratto.
            </p>
            <p className="font-mono text-[9px] text-muted leading-relaxed mt-2.5 pt-2.5 border-t border-line">
              Il prezzo non è il valore del pilota: è il suo valore più quanto gli costa scendere
              di squadra. Oltre {Math.round(UNREACHABLE_STEP * 100)} punti di distacco fra il suo
              posto in griglia e il tuo, non firma a nessuna cifra.
            </p>
            <p className="font-mono text-[9px] text-dim leading-relaxed mt-1.5">
              Il prestigio si costruisce correndo: ogni punto rende i contratti più facili e gli
              sponsor più ricchi.
            </p>
          </div>
        )}
      </Panel>
    </div>
  );
}

/** Il foglio dell'offerta: anni, ingaggio, e cosa manca perché accetti. */
function Offer({ world, driver, years, setYears, refusalMsg, onSign }: {
  world: ReturnType<typeof useGame.getState>['world'] & object;
  driver: Driver;
  years: number;
  setYears: (n: number) => void;
  refusalMsg: string | null;
  onSign: (terms: { years: number; salary: number; role: 'prima' | 'seconda' }) => void;
}) {
  const team = myTeam(world)!;
  const [role, setRole] = useState<'prima' | 'seconda'>('prima');
  // L'ingaggio da scrivere sul contratto lo calcola il motore: duplicare qui
  // l'arrotondamento è esattamente come è nato il pulsante che non firmava.
  const salary = offerFor(askingSalary(world, driver, team), role);
  const terms = { years, salary, role };
  const refusal = signingRefusal(world, driver, team, terms);

  return (
    <div className="flex-1 min-h-0 flex flex-col">
      <div className="flex-1 min-h-0 scroll-y">
      <div className="flex items-center gap-2 shrink-0">
        <DriverBadge name={driver.name} colour={team.colour} size={30} />
        <div className="min-w-0">
          <div className="font-sans text-xs font-bold truncate">{driver.name}</div>
          <div className="font-mono text-[9px] text-dim">
            {driver.age} anni · {driver.nationality}
          </div>
        </div>
      </div>

      <div className="mt-2 pt-2 border-t border-line shrink-0">
        <div className="field-label mb-1">Ruolo</div>
        <div className="grid grid-cols-2 gap-1">
          {(['prima', 'seconda'] as const).map((r) => (
            <Btn
              key={r} variant="ghost" onClick={() => setRole(r)}
              className={`!py-1 !text-[10px] ${role === r ? '!border-primary !text-ink' : ''}`}
            >
              {r === 'prima' ? 'Prima guida' : 'Seconda guida'}
            </Btn>
          ))}
        </div>
        <p className="font-mono text-[8.5px] text-dim mt-1">
          Essere il numero uno vale uno sconto del 12%.
        </p>
      </div>

      <div className="mt-2 shrink-0">
        <div className="field-label mb-1">Durata</div>
        <div className="grid grid-cols-4 gap-1">
          {[1, 2, 3, 4].map((n) => (
            <Btn
              key={n} variant="ghost" onClick={() => setYears(n)}
              className={`!py-1 !px-0 !text-[10px] ${years === n ? '!border-primary !text-ink' : ''}`}
            >
              {n}
            </Btn>
          ))}
        </div>
      </div>

      <div className="mt-2 pt-2 border-t border-line flex items-baseline justify-between shrink-0">
        <span className="font-mono text-2xs text-muted">Ingaggio annuo</span>
        <span className="font-mono text-sm text-accent tnum">{money(salary)}</span>
      </div>
      </div>

      <div className="pt-2 mt-1 border-t border-line shrink-0">
        <Btn
          variant="green" disabled={refusal !== null} testId="sign-driver"
          onClick={() => onSign(terms)} className="w-full"
        >
          {refusal === null ? <><Check className="w-3 h-3" /> Firma il contratto</> : <><AlertTriangle className="w-3 h-3" /> Rifiuta</>}
        </Btn>
        {(refusal ?? refusalMsg) && (
          <p className="font-mono text-[8.5px] text-bad mt-1 leading-tight">
            {refusal ?? refusalMsg}
          </p>
        )}
      </div>
    </div>
  );
}
