import { useState } from 'react';
import { useGame } from '../../state/useGame.js';
import { Btn } from '../components/kit.js';

const NATIONS = ['ITA', 'GBR', 'FRA', 'GER', 'ESP', 'BRA', 'JPN', 'NED', 'USA', 'AUS'];

/** Creazione della carriera. Tre campi, nessuna cerimonia. */
export function NewGame() {
  const newGame = useGame((s) => s.newGame);
  const [name, setName] = useState('');
  const [nat, setNat] = useState('ITA');

  const start = () =>
    newGame({
      seed: Math.floor(Math.random() * 2 ** 31),
      name: name.trim() || 'L. Marchetti',
      nationality: nat,
    });

  return (
    <div className="h-full grid place-items-center px-6">
      <div className="w-full max-w-md flex flex-col gap-4">
        <div>
          <h1 className="font-display text-3xl font-bold tracking-wide">F1 DRIVER MANAGER</h1>
          <p className="text-sm text-muted mt-1.5 leading-relaxed">
            Diciotto anni, nessun titolo, il sedile peggiore della griglia. Il resto lo decidi tu.
          </p>
        </div>

        <div className="flex gap-2 items-end">
          <label className="flex-1 flex flex-col gap-1">
            <span className="text-2xs uppercase tracking-[0.15em] text-dim">Nome del pilota</span>
            <input
              id="driver-name"
              type="text"
              value={name}
              maxLength={24}
              placeholder="L. Marchetti"
              onChange={(e) => setName(e.target.value)}
              className="text-sm"
            />
          </label>
          <label className="flex flex-col gap-1">
            <span className="text-2xs uppercase tracking-[0.15em] text-dim">Nazione</span>
            <select
              id="driver-nat"
              value={nat}
              onChange={(e) => setNat(e.target.value)}
              className="bg-panel2 border border-line rounded-sm px-2 py-2 text-sm font-mono"
            >
              {NATIONS.map((n) => (
                <option key={n} value={n}>{n}</option>
              ))}
            </select>
          </label>
        </div>

        <Btn variant="primary" onClick={start} className="w-full py-3 text-base" testId="start-career">
          Inizia la carriera
        </Btn>

        <p className="font-mono text-2xs text-dim leading-relaxed">
          Il mondo si genera da un seed e prosegue anche senza di te: le altre scuderie sviluppano,
          firmano piloti e vincono campionati. Il salvataggio resta sul dispositivo.
        </p>
      </div>
    </div>
  );
}
