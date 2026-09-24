import { useState } from 'react';
import { useGame } from '../../state/useGame.js';
import { START_CASH, type StartBudget } from '../../engine/team.js';
import { Btn, TeamBadge } from '../components/kit.js';
import { money } from '../format.js';

/**
 * Fondare la scuderia.
 *
 * Nome, colore e quanto si mette sul tavolo. Il budget non è un livello di
 * difficoltà mascherato da scelta narrativa: è la stessa scuderia, con più o
 * meno settimane di sviluppo prima che comincino a entrare i premi.
 */

/**
 * I colori che puoi scegliere, e perché sono sei e non otto.
 *
 * La prima versione offriva le stesse tinte delle otto scuderie esistenti:
 * sette su otto erano **identiche** a una squadra già in griglia, quindi in
 * classifica e sul tracciato la tua non si distingueva da quella. Questi sono
 * misurati contro tutte e otto e fra loro, con lo stesso metro di
 * `npm run check:palette`: contrasto ≥ 4,6:1 sul fondo chiaro e ΔE ≥ 9 in
 * visione normale, protanopia, deuteranopia e tritanopia.
 *
 * Sono sei, uno per famiglia di tinta, ed è tutto quello che lo spazio
 * concede: la griglia occupa già arancio, oliva, ciano, cremisi e viola, e
 * quasi ogni altra tinta finisce addosso a una scuderia in almeno una delle
 * tre dicromie.
 */
const COLOURS = [
  '#D21E1E', '#0000FF', '#005A5A', '#3C5A2D', '#B40FFF', '#4B4B4B',
];

const BUDGETS: { id: StartBudget; label: string; hint: string }[] = [
  { id: 'garage', label: 'Garagista', hint: 'Un progetto maggiore e poco altro. Il primo anno si soffre.' },
  { id: 'indipendente', label: 'Indipendente', hint: 'Due reparti al lavoro per mezza stagione.' },
  { id: 'costruttore', label: 'Costruttore', hint: 'Si comincia a sviluppare sul serio da subito.' },
];

export function NewGame() {
  const newGame = useGame((s) => s.newGame);
  const [name, setName] = useState('');
  const [short, setShort] = useState('');
  const [colour, setColour] = useState(COLOURS[0]!);
  const [budget, setBudget] = useState<StartBudget>('indipendente');

  const finalName = name.trim() || 'Nuova Scuderia';
  const finalShort = (short.trim() || finalName.split(' ')[0] || 'NUOVA').slice(0, 10);

  const start = () =>
    newGame({
      seed: Math.floor(Math.random() * 2 ** 31),
      name: finalName,
      short: finalShort,
      colour,
      budget,
    });

  return (
    <div className="h-full grid place-items-center px-6 scroll-y">
      <div className="w-full max-w-2xl flex flex-col gap-3 py-4">
        <div>
          <h1 className="font-display text-2xl font-bold tracking-wide">F1 MANAGER</h1>
          <p className="text-xs text-muted mt-1 leading-relaxed">
            Nona scuderia in griglia, la macchina più lenta del lotto e nessun pilota sotto
            contratto. Quello che diventa lo decidi tu.
          </p>
        </div>

        <div className="grid grid-cols-[1fr_auto] gap-3 items-start">
          <div className="flex flex-col gap-2">
            <div className="flex gap-2">
              <label className="flex-1 flex flex-col gap-1">
                <span className="text-2xs uppercase tracking-[0.15em] text-dim">Nome della scuderia</span>
                <input
                  id="team-name" type="text" value={name} maxLength={28}
                  placeholder="Nuova Scuderia"
                  onChange={(e) => setName(e.target.value)}
                  className="text-sm"
                />
              </label>
              <label className="w-28 flex flex-col gap-1">
                <span className="text-2xs uppercase tracking-[0.15em] text-dim">Sigla</span>
                <input
                  id="team-short" type="text" value={short} maxLength={10}
                  placeholder={finalShort}
                  onChange={(e) => setShort(e.target.value)}
                  className="text-sm font-mono"
                />
              </label>
            </div>

            <div className="flex flex-col gap-1">
              <span className="text-2xs uppercase tracking-[0.15em] text-dim">Colore</span>
              <div className="flex gap-1.5">
                {COLOURS.map((c) => (
                  <button
                    key={c} type="button" onClick={() => setColour(c)}
                    aria-label={`Colore ${c}`}
                    className={`w-7 h-7 rounded-sm border-2 transition ${
                      colour === c ? 'border-ink scale-110' : 'border-transparent'
                    }`}
                    style={{ background: c }}
                  />
                ))}
              </div>
            </div>
          </div>

          <div className="panel p-3 flex flex-col items-center gap-1.5 w-[132px]">
            <TeamBadge name={finalName} colour={colour} size={44} />
            <div className="font-sans text-2xs font-bold text-center leading-tight">{finalName}</div>
            <div className="font-mono text-[9px] text-dim">{finalShort}</div>
          </div>
        </div>

        <div className="flex flex-col gap-1">
          <span className="text-2xs uppercase tracking-[0.15em] text-dim">Capitale di partenza</span>
          <div className="grid grid-cols-3 gap-1.5">
            {BUDGETS.map((b) => (
              <button
                key={b.id} type="button" onClick={() => setBudget(b.id)}
                data-testid={`budget-${b.id}`}
                className={`rounded border px-2.5 py-2 text-left transition ${
                  budget === b.id
                    ? 'border-primary bg-primary/10'
                    : 'border-line bg-panel2 hover:border-dim'
                }`}
              >
                <div className="flex items-baseline justify-between gap-1">
                  <span className="font-sans text-2xs font-bold">{b.label}</span>
                  <span className="font-mono text-[9px] text-accent tnum">{money(START_CASH[b.id])}</span>
                </div>
                <p className="font-mono text-[8.5px] text-dim leading-tight mt-0.5">{b.hint}</p>
              </button>
            ))}
          </div>
        </div>

        <Btn variant="primary" onClick={start} className="w-full py-2.5 text-sm" testId="start-team">
          Fonda la scuderia
        </Btn>

        <p className="font-mono text-[9px] text-dim leading-relaxed">
          Il mondo si genera da un seed e prosegue anche senza di te: le altre otto scuderie
          sviluppano la macchina, firmano piloti e vincono campionati. Il salvataggio resta sul
          dispositivo.
        </p>
      </div>
    </div>
  );
}
