import { Handshake, TrendingUp, X } from 'lucide-react';
import { useGame } from '../../state/useGame.js';
import { myTeam } from '../../engine/selectors.js';
import {
  goalText, investorOffers, sponsorOffers, type InvestorDeal, type SponsorDeal,
} from '../../engine/sponsors.js';
import { Btn } from '../components/kit.js';
import { money } from '../format.js';

/**
 * Sponsor e investitori, da scegliere.
 *
 * Due elenchi con la stessa forma — nome, cosa dà, per quanto, un pulsante —
 * perché sono due varianti della stessa decisione: quanto ti leghi, e in
 * cambio di cosa.
 *
 * La differenza sta in una riga sola: lo sponsor paga e basta, l'investitore
 * paga **se** centri l'obiettivo. È l'unica entrata del gioco che si può
 * fallire, e per questo l'obiettivo è scritto grande e la cifra è scritta
 * accanto a «se riesci».
 *
 * Firmato, il pannello si chiude. Restare aperto a dire «hai già firmato»
 * lasciava il giocatore davanti a una schermata che non serviva più — e sopra
 * il resto del bilancio, che invece serviva.
 */
export function Deals({ kind, onClose }: { kind: 'sponsor' | 'investitore'; onClose: () => void }) {
  const world = useGame((s) => s.world)!;
  const team = myTeam(world)!;
  const signSponsorDeal = useGame((s) => s.signSponsorDeal);
  const signInvestorDeal = useGame((s) => s.signInvestorDeal);

  const title = kind === 'sponsor' ? 'Scegli uno sponsor' : 'Scegli un investitore';
  const current = kind === 'sponsor' ? team.sponsor : team.investor;

  return (
    <div className="absolute inset-0 z-30 bg-ground/88 grid place-items-center p-3">
      <div className="panel w-full max-w-3xl p-3 max-h-full flex flex-col min-h-0">
        <div className="flex items-center justify-between shrink-0 mb-2">
          <h2 className="font-display text-sm font-bold tracking-wide uppercase">{title}</h2>
          <button
            type="button" onClick={onClose} aria-label="Chiudi" data-testid="deals-close"
            className="w-7 h-7 rounded-full border border-line grid place-items-center
              text-muted hover:text-ink hover:border-dim transition"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>

        {current ? (
          <p className="font-mono text-2xs text-dim py-6 text-center">
            {kind === 'sponsor'
              ? 'Hai già uno sponsor sotto contratto. Le nuove offerte arrivano quando scade.'
              : 'Hai già un investitore per questa stagione. Il conto si chiude a fine anno.'}
          </p>
        ) : (
          <div className="flex-1 min-h-0 scroll-y grid grid-cols-3 gap-2 auto-rows-min pr-0.5">
            {kind === 'sponsor'
              ? sponsorOffers(world, team).map((deal) => (
                  <SponsorCard
                    key={deal.id} deal={deal}
                    onSign={() => { signSponsorDeal(deal.id); onClose(); }}
                  />
                ))
              : investorOffers(world, team).map((deal) => (
                  <InvestorCard
                    key={deal.id} deal={deal}
                    onSign={() => { signInvestorDeal(deal.id); onClose(); }}
                  />
                ))}
          </div>
        )}
      </div>
    </div>
  );
}

function SponsorCard({ deal, onSign }: { deal: SponsorDeal; onSign: () => void }) {
  return (
    <div className="panel px-2.5 py-2 flex flex-col" data-testid={`sponsor-${deal.seasons}`}>
      <div className="flex items-center gap-1.5">
        <Handshake className="w-3.5 h-3.5 text-primary shrink-0" />
        <span className="font-sans text-2xs font-bold truncate">{deal.name}</span>
      </div>
      <Row label="Durata" value={`${deal.seasons} stagion${deal.seasons === 1 ? 'e' : 'i'}`} />
      <Row label="Per stagione" value={money(deal.perSeason)} tone="text-good" />
      <Row label="Totale" value={money(deal.perSeason * deal.seasons)} tone="text-accent" />
      <Btn variant="green" onClick={onSign} className="w-full mt-auto pt-1 !py-1 !text-[10px]"
        testId={`sign-sponsor-${deal.seasons}`}>
        Firma l'accordo
      </Btn>
    </div>
  );
}

function InvestorCard({ deal, onSign }: { deal: InvestorDeal; onSign: () => void }) {
  return (
    <div className="panel px-2.5 py-2 flex flex-col" data-testid={`investor-${deal.goal.kind}`}>
      <div className="flex items-center gap-1.5">
        <TrendingUp className="w-3.5 h-3.5 text-vantar shrink-0" />
        <span className="font-sans text-2xs font-bold truncate">{deal.name}</span>
      </div>
      <Row label="Subito in cassa" value={money(deal.upfront)} tone="text-good" />

      <div className="mt-1.5 pt-1.5 border-t border-line">
        <div className="field-label mb-0.5">Obiettivo</div>
        <p className="font-mono text-[9px] text-ink leading-tight">{goalText(deal.goal)}</p>
      </div>
      <Row label="Se riesci" value={money(deal.bonus)} tone="text-accent" />
      <p className="font-mono text-[8.5px] text-dim leading-tight mt-0.5">
        Fallire non costa niente oltre al bonus mancato.
      </p>

      <Btn variant="green" onClick={onSign} className="w-full mt-auto pt-1 !py-1 !text-[10px]"
        testId={`sign-investor-${deal.goal.kind}`}>
        Firma l'accordo
      </Btn>
    </div>
  );
}

function Row({ label, value, tone = 'text-ink' }: { label: string; value: string; tone?: string }) {
  return (
    <div className="flex items-baseline justify-between gap-2 py-[3px]">
      <span className="font-mono text-[9px] text-muted truncate">{label}</span>
      <span className={`font-mono text-2xs tnum shrink-0 ${tone}`}>{value}</span>
    </div>
  );
}
