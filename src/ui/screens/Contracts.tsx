import { Award, FileText, Flag, Star, TrendingUp } from 'lucide-react';
import { useGame } from '../../state/useGame.js';
import { player, teamOf } from '../../engine/selectors.js';
import { overall } from '../../engine/driver.js';
import { Btn, Panel } from '../components/kit.js';
import { money } from '../format.js';

/**
 * Contratti e offerte.
 *
 * Il giocatore non viene assegnato d'ufficio come gli altri piloti: quando il
 * contratto scade sceglie lui, e finché non firma la stagione non riparte.
 * È la schermata dove la carriera cambia direzione.
 */
export function Contracts() {
  const world = useGame((s) => s.world)!;
  const accept = useGame((s) => s.acceptOffer);
  const me = player(world)!;
  const team = teamOf(world, me);
  const offers = world.offers ?? [];

  const seasonPoints = world.standings[me.id] ?? 0;
  const last = me.history[me.history.length - 1];
  const shown = last ?? {
    points: seasonPoints,
    wins: me.career.wins,
    podiums: me.career.podiums,
    starts: me.career.starts,
  };

  return (
    <div className="h-full grid grid-cols-[236px_1fr] gap-2 min-h-0">
      <div className="flex flex-col gap-2 min-h-0">
        <Panel title="Il tuo profilo" className="shrink-0" bodyClass="p-2.5">
          <div className="font-sans text-sm font-bold leading-tight">{me.name}</div>
          <div className="font-mono text-2xs text-muted mt-0.5">
            {team ? `${team.name} · ` : 'Senza sedile · '}{me.age} anni
          </div>
          <div className="grid grid-cols-2 gap-1.5 mt-2.5">
            {[
              { k: 'Overall', v: Math.round(overall(me.attrs)), c: 'text-primary' },
              { k: 'Potenziale', v: Math.round(overall(me.caps)), c: 'text-accent' },
            ].map((x) => (
              <div key={x.k} className="bg-panel2 border border-line rounded px-2 py-1.5">
                <div className="field-label">{x.k}</div>
                <div className={`font-mono text-sm tnum mt-0.5 ${x.c}`}>{x.v}</div>
              </div>
            ))}
          </div>
        </Panel>

        <Panel title={last ? 'Stagione conclusa' : 'Stagione in corso'} className="flex-1" bodyClass="p-2.5 scroll-y">
          {[
            { icon: TrendingUp, k: 'Punti', v: shown.points, c: 'text-accent' },
            { icon: Award, k: 'Vittorie', v: shown.wins, c: 'text-primary' },
            { icon: Star, k: 'Podi', v: shown.podiums, c: 'text-vantar' },
            { icon: FileText, k: 'Gare', v: shown.starts, c: 'text-ink' },
          ].map((row) => {
            const Icon = row.icon;
            return (
              <div key={row.k} className="flex items-center justify-between gap-2 py-2 border-b border-line/60 last:border-0">
                <span className="flex items-center gap-2 min-w-0">
                  <Icon className="w-3.5 h-3.5 text-dim shrink-0" />
                  <span className="font-sans text-xs truncate">{row.k}</span>
                </span>
                <span className={`font-mono text-xs tnum shrink-0 ${row.c}`}>{row.v}</span>
              </div>
            );
          })}
          <p className="font-mono text-[8.5px] text-dim leading-relaxed mt-2.5">
            {offers.length > 0
              ? 'Contratto scaduto: scegli dove correre la prossima stagione.'
              : `Contratto in corso: ${me.contractYears} ${me.contractYears === 1 ? 'anno residuo' : 'anni residui'}.`}
          </p>
        </Panel>
      </div>

      <Panel
        title={offers.length > 0 ? 'Offerte per la prossima stagione' : 'Contratto in corso'}
        tag={offers.length > 0 ? `${offers.length} sul tavolo` : team?.name}
        bodyClass="p-2.5 scroll-y"
      >
        {offers.length === 0 ? (
          <div className="h-full grid place-items-center text-center">
            <div>
              <FileText className="w-8 h-8 text-dim/50 mx-auto" strokeWidth={1.5} />
              <p className="font-sans text-xs text-muted mt-2">Nessuna offerta in attesa.</p>
              <p className="font-mono text-[8.5px] text-dim mt-1">
                Le offerte arrivano a fine stagione se il contratto scade.
              </p>
              {team && (
                <div className="flex justify-center gap-6 mt-4 pt-3 border-t border-line">
                  {[
                    { k: 'Scuderia', v: team.short },
                    { k: 'Ingaggio', v: `${money(me.salary)}/anno` },
                    { k: 'Residui', v: `${me.contractYears} ${me.contractYears === 1 ? 'anno' : 'anni'}` },
                  ].map((x) => (
                    <div key={x.k}>
                      <div className="field-label">{x.k}</div>
                      <div className="font-mono text-xs text-ink mt-0.5">{x.v}</div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        ) : (
          <div className="grid grid-cols-2 gap-2">
            {offers.map((offer) => {
              const t = world.teams[offer.teamId];
              if (!t) return null;
              return (
                <div key={offer.teamId} className="bg-panel2 border border-line rounded px-2.5 py-2">
                  <div className="flex items-center justify-between gap-2">
                    <span className="flex items-center gap-2 min-w-0">
                      <i className="block w-2 h-2 rounded-full shrink-0" style={{ background: t.colour }} />
                      <span className="font-sans text-xs font-bold truncate">{t.name}</span>
                    </span>
                    <span className="font-mono text-[8.5px] text-dim shrink-0">
                      {offer.role === 'prima' ? '1ª guida' : '2ª guida'}
                    </span>
                  </div>

                  <div className="grid grid-cols-3 gap-1.5 mt-2">
                    {[
                      { k: 'Ingaggio', v: money(offer.salary) },
                      { k: 'Durata', v: `${offer.years} ${offer.years === 1 ? 'anno' : 'anni'}` },
                      { k: 'Interesse', v: `${offer.interest}%` },
                    ].map((x) => (
                      <div key={x.k} className="bg-panel border border-line rounded px-1.5 py-1">
                        <div className="field-label">{x.k}</div>
                        <div className="font-mono text-2xs text-ink tnum mt-0.5">{x.v}</div>
                      </div>
                    ))}
                  </div>

                  <div className="font-mono text-[8.5px] text-dim mt-2 leading-relaxed">
                    Passo {Math.round(t.car.aero * 0.38 + t.car.engine * 0.34 + t.car.chassis * 0.28)} ·
                    prestigio {Math.round(t.prestige)}
                  </div>

                  <Btn
                    variant="green"
                    onClick={() => accept(offer.teamId)}
                    className="w-full mt-2"
                    testId={`accept-${offer.teamId}`}
                  >
                    <Flag className="w-3 h-3" />Firma
                  </Btn>
                </div>
              );
            })}
          </div>
        )}
      </Panel>
    </div>
  );
}
