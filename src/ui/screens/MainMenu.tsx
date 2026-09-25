import { useEffect, useMemo, useState } from 'react';
import {
  ChevronRight, FolderOpen, Gift, Globe, ListChecks, PlusCircle, Settings, ShoppingBag,
} from 'lucide-react';
import { useGame } from '../../state/useGame.js';
import { useProfile } from '../../state/useProfile.js';
import { claimableDay, pendingObjectives } from '../../engine/profile.js';
import { firstFreeSlot, loadSlot, readIndex, savedAgo, type SlotMeta } from '../../state/saves.js';
import { TeamBadge } from '../components/kit.js';
import { WalletBar } from '../components/Currency.js';
import { APP_VERSION } from '../../version.js';

/**
 * La schermata da cui si entra.
 *
 * Prima non c'era: se avevi una carriera aperta, l'app ti buttava dentro e non
 * esisteva un modo di tornare indietro per caricarne un'altra. Adesso è il
 * punto fermo del gioco — da qui si riprende, si comincia, si carica, si
 * ritira il premio del giorno e si va al negozio.
 *
 * L'impaginazione è quella dei gestionali sportivi per telefono: un'immagine
 * che occupa la metà sinistra, i comandi in colonna a destra dove arriva il
 * pollice, e i servizi (lingua, impostazioni, obiettivi) piccoli in fondo.
 */
export function MainMenu({ onNewGame, onSettings, onDaily, onObjectives, onStore }: {
  onNewGame: () => void;
  onSettings: () => void;
  onDaily: () => void;
  onObjectives: () => void;
  onStore: () => void;
}) {
  const world = useGame((s) => s.world);
  const slot = useGame((s) => s.slot);
  const continueGame = useGame((s) => s.continueGame);
  const openSlot = useGame((s) => s.openSlot);
  const profile = useProfile((s) => s.profile);
  const setLanguage = useProfile((s) => s.setLanguage);

  const [index, setIndex] = useState(() => readIndex());
  const [loadOpen, setLoadOpen] = useState(false);
  useEffect(() => { if (!loadOpen) setIndex(readIndex()); }, [loadOpen]);

  const dailyReady = claimableDay(profile.daily) !== null;
  const objectivesReady = pendingObjectives(profile);
  const slots = useMemo(
    () => Object.values(index).sort((a, b) => b.saved - a.saved) as SlotMeta[],
    [index],
  );
  const current = slot !== null ? index[slot] : undefined;
  const canContinue = !!world;

  const load = (meta: SlotMeta) => {
    const loaded = loadSlot(meta.slot);
    if (loaded) { openSlot(meta.slot, loaded); setLoadOpen(false); }
  };

  return (
    <div className="h-full relative overflow-hidden bg-ground">
      <Backdrop />

      <div className="absolute bottom-6 left-8 max-w-[44%] pointer-events-none">
        <h1 className="font-display text-4xl font-bold leading-none tracking-tight">
          F1 <span className="text-primary">MANAGER</span>
        </h1>
        <p className="font-mono text-2xs text-dim mt-1.5 leading-relaxed">
          Fondi una scuderia, sviluppi la monoposto, ingaggi i piloti.
        </p>
      </div>

      {/* Evento del giorno: in alto a sinistra, con il pallino che chiede
          di essere premuto. È l'unica cosa che si muove nella schermata. */}
      <button
        type="button"
        onClick={onDaily}
        data-testid="menu-daily"
        className={`absolute top-4 left-4 flex items-center gap-2 rounded-lg border px-3 py-2
          transition ${dailyReady
            ? 'border-accent/70 bg-accent/10 hover:bg-accent/15'
            : 'border-line bg-panel2 hover:border-dim'}`}
      >
        <Gift className={`w-4 h-4 ${dailyReady ? 'text-accent' : 'text-dim'}`} />
        <span className="font-sans text-2xs font-semibold">
          {dailyReady ? 'Premio del giorno!' : 'Premio già ritirato'}
        </span>
        {dailyReady && (
          <span className="w-4 h-4 rounded-full bg-bad grid place-items-center
            font-mono text-[9px] font-bold text-white">!</span>
        )}
      </button>

      {/* Il portafoglio sta qui perché il menu è il posto in cui si
          guadagna e si compra: nasconderlo dietro una schermata vorrebbe dire
          che il giocatore scopre di avere dei gettoni solo per caso. */}
      <div className="absolute top-4 right-4 flex items-center gap-3">
        <WalletBar wallet={profile.wallet} size="sm" />
        <span className="font-mono text-2xs text-dim">v{APP_VERSION}</span>
      </div>

      {/* I comandi. */}
      <div className="absolute right-6 top-1/2 -translate-y-1/2 w-[330px] flex flex-col gap-2">
        <MenuItem
          icon={ChevronRight}
          label="Continua"
          disabled={!canContinue}
          testId="menu-continue"
          onClick={continueGame}
          primary
          trailing={current && (
            <TeamBadge name={current.teamName} colour={current.teamColour} size={26} />
          )}
        />
        <MenuItem icon={PlusCircle} label="Nuova carriera" onClick={onNewGame} testId="menu-new" />
        <MenuItem
          icon={FolderOpen}
          label="Carica partita"
          disabled={slots.length === 0}
          onClick={() => setLoadOpen(true)}
          testId="menu-load"
        />
        <MenuItem icon={ShoppingBag} label="Negozio" onClick={onStore} testId="menu-store" />

        <div className="flex items-center gap-2 mt-1">
          <label className="flex-1 flex items-center gap-2 rounded-lg border border-line
            bg-panel2 px-2.5 py-1.5">
            <Globe className="w-4 h-4 text-dim shrink-0" />
            <select
              value={profile.language}
              onChange={(e) => setLanguage(e.target.value)}
              aria-label="Lingua"
              className="flex-1 bg-transparent border-0 p-0 font-sans text-2xs text-ink
                focus:ring-0 cursor-pointer"
            >
              <option value="it">Italiano</option>
              <option value="en">English</option>
            </select>
          </label>
          <IconBtn icon={Settings} label="Impostazioni" onClick={onSettings} testId="menu-settings" />
          <IconBtn
            icon={ListChecks} label="Obiettivi" onClick={onObjectives}
            testId="menu-objectives" badge={objectivesReady}
          />
        </div>
      </div>

      {loadOpen && (
        <LoadDialog slots={slots} onPick={load} onClose={() => setLoadOpen(false)} />
      )}
    </div>
  );
}

/**
 * Lo sfondo.
 *
 * Non c'è una fotografia e non ne voglio una: una licenza d'immagine è un
 * problema legale e un file da mezzo megabyte da scaricare prima che il gioco
 * si apra. Quello che serve — profondità, movimento, la sensazione che sotto
 * ci sia una pista — si disegna, e pesa due chilobyte.
 *
 * Tre strati: la matrice di punti che il tema usa già altrove, le strisce
 * diagonali di luce, e il tracciato stilizzato con la griglia di partenza. Le
 * strisce sono inclinate come le linee di un circuito viste in prospettiva, ed
 * è il motivo per cui il rettangolo vuoto smette di sembrare vuoto.
 */
function Backdrop() {
  return (
    <svg
      className="absolute inset-y-0 left-0 w-[62%] pointer-events-none select-none"
      viewBox="0 0 520 390" preserveAspectRatio="xMidYMid slice" aria-hidden="true"
    >
      <defs>
        <pattern id="menu-dots" width="14" height="14" patternUnits="userSpaceOnUse">
          <circle cx="2" cy="2" r="1.1" className="fill-ink" opacity="0.07" />
        </pattern>
        <linearGradient id="menu-streak" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor="#C8102E" stopOpacity="0" />
          <stop offset="45%" stopColor="#C8102E" stopOpacity="0.5" />
          <stop offset="100%" stopColor="#C8102E" stopOpacity="0" />
        </linearGradient>
        <linearGradient id="menu-streak2" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor="#3E86F0" stopOpacity="0" />
          <stop offset="55%" stopColor="#3E86F0" stopOpacity="0.35" />
          <stop offset="100%" stopColor="#3E86F0" stopOpacity="0" />
        </linearGradient>
      </defs>

      <rect width="520" height="390" fill="url(#menu-dots)" />

      {[-40, 30, 96, 170].map((x, i) => (
        <rect
          key={x} x={x} y={-60} width={i % 2 ? 3 : 6} height={520}
          fill={i % 2 ? 'url(#menu-streak2)' : 'url(#menu-streak)'}
          transform={`rotate(24 ${x} 195)`}
        />
      ))}

      {/* Il tracciato: una curva chiusa qualunque, purché non sia un cerchio.
          Serve a dire «pista», non a rappresentarne una vera. */}
      <path
        d="M 96 300 C 60 250 72 180 130 160 C 188 140 210 96 268 104
           C 330 112 348 168 322 214 C 296 260 244 250 206 278
           C 168 306 132 348 96 300 Z"
        className="stroke-ink" strokeWidth="14" fill="none" opacity="0.05"
        strokeLinejoin="round"
      />
      <path
        d="M 96 300 C 60 250 72 180 130 160 C 188 140 210 96 268 104
           C 330 112 348 168 322 214 C 296 260 244 250 206 278
           C 168 306 132 348 96 300 Z"
        stroke="#C8102E" strokeWidth="1.5" fill="none" opacity="0.28"
        strokeDasharray="5 9" strokeLinejoin="round"
      />

      {/* La griglia di partenza, a scacchi. */}
      <g transform="rotate(-18 130 160)" opacity="0.5">
        {Array.from({ length: 12 }, (_, i) => (
          <rect
            key={i}
            x={122 + (i % 6) * 5} y={154 + Math.floor(i / 6) * 5}
            width="5" height="5"
            className={i % 2 === Math.floor(i / 6) % 2 ? 'fill-ink' : 'fill-transparent'}
            opacity="0.35"
          />
        ))}
      </g>
    </svg>
  );
}

function MenuItem({ icon: Icon, label, onClick, disabled, primary, trailing, testId }: {
  icon: typeof ChevronRight;
  label: string;
  onClick: () => void;
  disabled?: boolean;
  primary?: boolean;
  trailing?: React.ReactNode;
  testId?: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      data-testid={testId}
      className={`group flex items-center gap-3 rounded-lg border px-3 py-2.5 text-left transition
        disabled:opacity-35 disabled:cursor-not-allowed
        ${primary
          ? 'border-primary bg-primary/10 hover:bg-primary/15'
          : 'border-line bg-panel2 hover:border-dim'}`}
    >
      <span className={`w-8 h-8 rounded-full grid place-items-center shrink-0 border
        ${primary ? 'border-primary/60 text-primary' : 'border-line text-muted'}`}>
        <Icon className="w-4 h-4" strokeWidth={1.8} />
      </span>
      <span className="flex-1 font-sans text-sm font-semibold">{label}</span>
      {trailing}
    </button>
  );
}

function IconBtn({ icon: Icon, label, onClick, testId, badge }: {
  icon: typeof Settings; label: string; onClick: () => void; testId?: string; badge?: number;
}) {
  return (
    <button
      type="button" onClick={onClick} title={label} aria-label={label} data-testid={testId}
      className="relative w-9 h-9 rounded-lg border border-line bg-panel2 grid place-items-center
        text-muted hover:text-ink hover:border-dim transition"
    >
      <Icon className="w-4 h-4" strokeWidth={1.8} />
      {!!badge && badge > 0 && (
        <span className="absolute -top-1 -right-1 min-w-[15px] h-[15px] px-1 rounded-full bg-bad
          grid place-items-center font-mono text-[9px] font-bold text-white">{badge}</span>
      )}
    </button>
  );
}

/** L'elenco degli slot. Mostra l'anteprima, non carica i mondi finché non serve. */
function LoadDialog({ slots, onPick, onClose }: {
  slots: SlotMeta[]; onPick: (meta: SlotMeta) => void; onClose: () => void;
}) {
  return (
    <div className="absolute inset-0 bg-ground/85 grid place-items-center p-6 z-20">
      <div className="panel w-full max-w-lg p-3">
        <div className="flex items-center justify-between mb-2">
          <h2 className="panel-title">Carica partita</h2>
          <button
            type="button" onClick={onClose} data-testid="load-close"
            className="font-mono text-2xs text-dim hover:text-ink"
          >chiudi</button>
        </div>
        <div className="flex flex-col gap-1.5">
          {slots.map((meta) => (
            <button
              key={meta.slot}
              type="button"
              onClick={() => onPick(meta)}
              data-testid={`load-slot-${meta.slot}`}
              className="flex items-center gap-3 rounded border border-line bg-panel2 px-3 py-2
                text-left hover:border-primary transition"
            >
              <TeamBadge name={meta.teamName} colour={meta.teamColour} size={30} />
              <div className="min-w-0 flex-1">
                <div className="font-sans text-xs font-bold truncate">{meta.teamName}</div>
                <div className="font-mono text-[9px] text-dim">
                  {meta.year} · settimana {meta.week + 1}
                  {meta.position > 0 && ` · ${meta.position}ª di ${meta.teams}`}
                </div>
              </div>
              <span className="font-mono text-[9px] text-dim shrink-0">
                {savedAgo(meta.saved)}
              </span>
            </button>
          ))}
        </div>
        <p className="font-mono text-[9px] text-dim mt-2 leading-relaxed">
          {firstFreeSlot() === null
            ? 'Tutti e tre gli slot sono occupati: cominciarne una nuova ne sovrascrive uno.'
            : `Slot liberi: ${3 - slots.length} su 3.`}
        </p>
      </div>
    </div>
  );
}
