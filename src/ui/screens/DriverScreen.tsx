import { Sparkles, Star } from 'lucide-react';
import { PALETTE } from '../palette.js';
import { useGame } from '../../state/useGame.js';
import { championshipPosition, focusedDriver, seasonResults, teamOf } from '../../engine/selectors.js';
import { overall } from '../../engine/driver.js';
import { ratedRoles } from '../../engine/roles.js';
import { marketValue } from '../../engine/market.js';
import type { AttributeKey, Driver } from '../../engine/types.js';
import { ATTRIBUTE_COLOURS, DriverBadge, Panel } from '../components/kit.js';
import { ATTR_LABELS, money } from '../format.js';

/**
 * La scheda del pilota, sull'impaginazione dei manageriali.
 *
 * Tre cose in tre fasce. In alto chi è: nome, scuderia, contratto, quanto
 * vale adesso e quanto può valere. In mezzo di cosa è fatto: i ruoli a
 * sinistra, gli attributi in colonne al centro, l'anagrafica a destra. In
 * basso come sta: forma, condizione, e cosa ha fatto quest'anno.
 *
 * Gli attributi stanno in colonne e non in una lista perché così si leggono
 * come un profilo invece che come una classifica: un pilota forte in guida e
 * scarso di testa lo vedi dalla forma della colonna, senza leggere i numeri.
 */

/** Le tre colonne. Il raggruppamento è quello che un ingegnere userebbe. */
const COLUMNS: { title: string; keys: AttributeKey[] }[] = [
  { title: 'Guida', keys: ['speed', 'starts', 'tyres', 'wet'] },
  { title: 'Testa', keys: ['consistency', 'composure', 'technical'] },
];

export function DriverScreen() {
  const world = useGame((s) => s.world)!;
  const goTo = useGame((s) => s.goTo);
  const selected = useGame((s) => s.selected);
  const me = focusedDriver(world, selected)!;
  const team = teamOf(world, me);
  const colour = team?.colour ?? PALETTE.dim;
  const roles = ratedRoles(me);
  const results = seasonResults(world, me.id);
  const position = championshipPosition(world, me.id);

  // Un weekend può essere in calendario senza essere ancora corso: conta solo
  // quello che ha un risultato.
  const raced = results.map((r) => r.race).filter((r): r is NonNullable<typeof r> => r !== null);
  const points = raced.reduce((s, r) => s + r.points, 0);
  const wins = raced.filter((r) => !r.dnf && r.position === 1).length;
  const podiums = raced.filter((r) => !r.dnf && r.position <= 3).length;
  const dnf = raced.filter((r) => r.dnf).length;

  return (
    <div className="h-full flex flex-col gap-2 min-h-0">
      <Header me={me} teamName={team?.name ?? 'Senza contratto'} colour={colour}
        onSkills={() => goTo('abilita')} onBack={() => goTo('piloti')} />

      <div className="flex-1 grid grid-cols-[168px_1fr_1fr_172px] gap-2 min-h-0">
        <Panel title="Ruoli" bodyClass="p-2 scroll-y">
          {roles.map((role) => (
            <div key={role.key} className="py-[3px] border-b border-line/60 last:border-0">
              <div className="flex items-center justify-between gap-1">
                <span className="font-sans text-2xs text-ink truncate">{role.label}</span>
                <Stars value={role.rating} potential={role.potential} />
              </div>
              <p className="font-mono text-[8px] text-dim leading-tight truncate" title={role.hint}>
                {role.hint}
              </p>
            </div>
          ))}
        </Panel>

        {COLUMNS.map((column) => (
          <Panel key={column.title} title={column.title} bodyClass="p-0 scroll-y">
            {column.keys.map((key) => (
              <AttrCell key={key} label={ATTR_LABELS[key]!} value={me.attrs[key]} cap={me.caps[key]}
                since={me.seasonStartAttrs?.[key] ?? me.attrs[key]}
                colour={ATTRIBUTE_COLOURS[key]} />
            ))}
          </Panel>
        ))}

        <Panel title="Scheda" bodyClass="p-2 scroll-y">
          <Info label="Età" value={`${me.age} anni`} />
          <Info label="Stagioni" value={me.history.length} />
          <Info label="Gare disputate" value={me.career.starts} />
          <Info label="Reputazione" value={Math.round(me.reputation)} />
          <Info label="Esperienza" value={`${Math.round(me.experience / 10)}%`} />
          <Info label="Valore" value={money(Math.round(marketValue(me) * 120_000))} />
          <Info label="Ingaggio" value={`${money(me.salary)}/anno`} />
          <Info label="Contratto" value={me.contractYears > 0 ? `${me.contractYears} anni` : 'in scadenza'} />
        </Panel>
      </div>

      <div className="h-[86px] shrink-0 grid grid-cols-[0.85fr_0.85fr_1fr_1.35fr_1.75fr] gap-2">
        <Gauge label="Morale" value={me.morale} hint={moodOf(me.morale)} />
        <Gauge label="Condizione" value={100 - me.fatigue} hint={fitnessOf(me.fatigue)} invert />
        <Growth me={me} year={world.year} />
        <Panel title="Forma" bodyClass="p-2">
          <div className="flex gap-1 items-end h-[26px]">
            {raced.slice(-5).map((r, i) => (
              <span
                key={i}
                title={r.dnf ? 'ritiro' : `P${r.position}`}
                className={`flex-1 rounded-sm flex items-end justify-center font-mono text-[8px] pb-px
                  ${r.dnf ? 'bg-bad/15 text-bad' : r.position <= 3 ? 'bg-good/15 text-good' : 'bg-panel3 text-muted'}`}
                style={{ height: r.dnf ? '40%' : `${Math.max(30, 100 - r.position * 4)}%` }}
              >
                {r.dnf ? '—' : r.position}
              </span>
            ))}
            {raced.length === 0 && <span className="font-mono text-2xs text-dim">nessuna gara</span>}
          </div>
          <p className="font-mono text-[8px] text-dim mt-1">ultime cinque gare</p>
        </Panel>

        <Panel title={`Stagione ${world.year}`} tag={position > 0 ? `P${position} in campionato` : ''} bodyClass="p-2">
          <div className="grid grid-cols-5 gap-1 h-full items-center">
            {([['Gare', raced.length], ['Vittorie', wins], ['Podi', podiums],
               ['Punti', points], ['Ritiri', dnf]] as const).map(([label, value]) => (
              <div key={label} className="text-center">
                <div className="font-display text-lg font-bold leading-none tnum">{value}</div>
                <div className="field-label mt-0.5">{label}</div>
              </div>
            ))}
          </div>
        </Panel>
      </div>
    </div>
  );
}

/**
 * La crescita, stagione per stagione.
 *
 * È la risposta a una domanda che il gioco non sapeva dare: **sto
 * migliorando?** Allenarsi rende due decimi a settimana, e in una schermata
 * che mostra solo il valore di adesso quel lavoro è invisibile. Qui ogni
 * colonna è una stagione chiusa, l'ultima è quella in corso, e l'altezza è
 * l'overall di fine anno.
 *
 * ## La scala è quella dei dati, non quella del potenziale
 *
 * La prima versione scalava le colonne fra la stagione peggiore e il tetto, e
 * non funzionava: il tetto di un giovane sta venti punti sopra dove si trova,
 * quindi ogni colonna restava schiacciata in fondo al pannello e una carriera
 * intera sembrava piatta. Qui la scala è quella delle stagioni che ci sono,
 * allargata di poco — è la **differenza fra un anno e l'altro** che va letta,
 * e il potenziale è già scritto nell'intestazione.
 *
 * Le stagioni archiviate prima che il gioco registrasse l'overall hanno 0 e
 * vengono saltate: meglio una curva che comincia tardi di una che finge un
 * crollo che non c'è mai stato.
 */
function Growth({ me, year }: { me: Driver; year: number }) {
  const now = overall(me.attrs);
  const past = me.history.filter((h) => h.overall > 0).slice(-7);
  const points = [...past.map((h) => ({ year: h.year, value: h.overall, done: true })),
    { year, value: now, done: false }];

  const values = points.map((p) => p.value);
  const low = Math.min(...values) - 1.5;
  const span = Math.max(1.5, Math.max(...values) + 0.5 - low);

  const sinceStart = now - overall(me.seasonStartAttrs ?? me.attrs);
  const career = points.length > 1 ? now - points[0]!.value : sinceStart;
  const sign = (n: number) => `${n >= 0 ? '+' : ''}${n.toFixed(1)}`;

  return (
    <Panel title="Crescita" tag={points.length > 1 ? sign(career) : ''} bodyClass="p-2">
      <div className="flex gap-[3px] items-end h-[26px]">
        {points.map((p) => (
          <span
            key={p.year}
            title={`${p.year}: overall ${p.value.toFixed(1)}`}
            className={`flex-1 rounded-sm ${p.done ? 'bg-primary/40' : 'bg-primary'}`}
            style={{ height: `${Math.max(18, ((p.value - low) / span) * 100)}%` }}
          />
        ))}
      </div>
      <p className="font-mono text-[8px] text-dim mt-1 truncate">
        {points.length > 1
          ? `${sign(sinceStart)} quest\u2019anno \u00b7 ${points.length} stagioni`
          : `${sign(sinceStart)} da inizio stagione`}
      </p>
    </Panel>
  );
}

/** La fascia d'intestazione: tutto quello che identifica il pilota, su una riga. */
function Header({ me, teamName, colour, onSkills, onBack }: {
  me: Driver; teamName: string; colour: string; onSkills: () => void; onBack: () => void;
}) {
  const now = Math.round(overall(me.attrs));
  const peak = Math.round(overall(me.caps));
  const gain = overall(me.attrs) - overall(me.seasonStartAttrs ?? me.attrs);
  return (
    <div className="shrink-0 panel flex items-center gap-3 px-3 py-2"
      style={{ borderLeft: `3px solid ${colour}` }}
    >
      <button type="button" onClick={onBack} title="Torna ai tuoi piloti" data-testid="profile-back">
        <DriverBadge name={me.name} colour={colour} size={40} />
      </button>
      <div className="min-w-0">
        <div className="font-display text-xl font-bold leading-none truncate">{me.name}</div>
        <div className="font-mono text-2xs text-muted truncate">
          {teamName} · {me.contractYears > 0 ? `${me.contractYears} anni di contratto` : 'contratto in scadenza'}
        </div>
      </div>

      <span className="flex-1" />

      {/* L'albero si apre da qui: è una cosa del pilota, non una voce di menu. */}
      <button
        type="button"
        data-testid="open-skills"
        onClick={onSkills}
        className={`inline-flex items-center gap-1.5 rounded border px-2.5 py-1 font-sans text-2xs
          font-semibold transition ${me.skillPoints > 0
            ? 'bg-primary border-primary text-white hover:brightness-110'
            : 'border-line text-muted hover:text-ink hover:border-dim'}`}
      >
        <Sparkles className="w-3 h-3" />
        Abilità
        {me.skillPoints > 0 && <span className="tnum">{me.skillPoints}</span>}
      </button>
      <div className="w-px self-stretch bg-line" />

      <HeaderStat label="Overall" value={now} tone="text-ink" gain={gain} />
      <HeaderStat label="Potenziale" value={peak} tone="text-primary" />
      <div className="w-px self-stretch bg-line" />
      <HeaderStat label="Titoli" value={me.career.titles} tone="text-accent" />
      <HeaderStat label="Vittorie" value={me.career.wins} tone="text-ink" />
      <HeaderStat label="Podi" value={me.career.podiums} tone="text-ink" />
      <HeaderStat label="Pole" value={me.career.poles} tone="text-ink" />
    </div>
  );
}

function HeaderStat({ label, value, tone, gain }: {
  label: string; value: number; tone: string; gain?: number;
}) {
  return (
    <div className="text-center px-1.5">
      <div className={`font-display text-xl font-bold leading-none tnum ${tone}`}>
        {value}
        {/* Il guadagno della stagione sta attaccato al numero che è cresciuto,
            non in una riga a parte: è così che si legge come una variazione. */}
        {gain !== undefined && gain >= 0.05 && (
          <span className="font-mono text-[9px] font-normal text-good align-super ml-px tnum">
            +{gain.toFixed(1)}
          </span>
        )}
      </div>
      <div className="field-label mt-0.5">{label}</div>
    </div>
  );
}

/**
 * Una riga di attributo: nome, barra, valore, il tetto come tacca e quanto è
 * cresciuto quest'anno.
 *
 * Il potenziale non è un numero accanto ma un segno sulla barra: quanto manca
 * si vede senza sottrarre, ed è quello che guida ogni scelta di allenamento.
 *
 * La crescita è il tratto più chiaro della barra, non solo il `+1.8` scritto
 * accanto. Un guadagno settimanale è di due decimi: scritto com'è, è un
 * numero che non si muove mai e che nessuno guarda. Disegnato come il pezzo
 * di barra che si è aggiunto da marzo, si vede a colpo d'occhio **dove** è
 * andato il lavoro dell'anno — ed è esattamente la domanda che ci si fa
 * guardando questa schermata.
 */
function AttrCell({ label, value, cap, since, colour }: {
  label: string; value: number; cap: number; since: number; colour: string;
}) {
  const gain = value - since;
  const grown = gain >= 0.05;
  return (
    <div className="px-2.5 py-[7px] border-b border-line/60 last:border-0">
      <div className="flex items-baseline justify-between gap-2">
        <span className="font-sans text-2xs text-ink truncate">{label}</span>
        <span className="flex items-baseline gap-1 shrink-0">
          {grown && (
            <span className="font-mono text-[8.5px] text-good tnum">
              +{gain.toFixed(1)}
            </span>
          )}
          {gain <= -0.05 && (
            <span className="font-mono text-[8.5px] text-bad tnum">
              {gain.toFixed(1)}
            </span>
          )}
          <span className="font-mono text-xs font-bold tnum" style={{ color: colour }}>
            {Math.round(value)}
          </span>
        </span>
      </div>
      <div className="relative mt-1 h-[5px] rounded-sm bg-panel3 overflow-hidden">
        {/* Dove era a inizio stagione: pieno. */}
        <div className="absolute inset-y-0 left-0 rounded-sm"
          style={{ width: `${Math.min(value, since)}%`, background: colour, opacity: 0.55 }} />
        {/* Quello che ha guadagnato da allora: acceso. */}
        {grown && (
          <div className="absolute inset-y-0"
            style={{ left: `${since}%`, width: `${gain}%`, background: colour }} />
        )}
        <div className="absolute inset-y-0 w-px bg-ink/45" style={{ left: `${cap}%` }} />
      </div>
    </div>
  );
}

function Info({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="flex items-baseline justify-between gap-2 py-[3px] border-b border-line/60 last:border-0">
      <span className="font-mono text-2xs text-muted truncate">{label}</span>
      <span className="font-mono text-2xs text-ink tnum shrink-0">{value}</span>
    </div>
  );
}

/** Un valore 0–100 come barra larga, con la parola che lo riassume. */
function Gauge({ label, value, hint, invert = false }: {
  label: string; value: number; hint: string; invert?: boolean;
}) {
  const v = Math.round(value);
  const tone = v >= 66 ? PALETTE.good : v >= 33 ? PALETTE.warn : PALETTE.bad;
  return (
    <Panel title={label} bodyClass="p-2 flex flex-col justify-center">
      <div className="flex items-baseline justify-between">
        <span className="font-sans text-xs font-bold" style={{ color: tone }}>{hint}</span>
        <span className="font-mono text-2xs text-dim tnum">{invert ? `${v}%` : v}</span>
      </div>
      <div className="mt-1.5 h-[6px] rounded-sm bg-panel3 overflow-hidden">
        <div className="h-full rounded-sm" style={{ width: `${v}%`, background: tone }} />
      </div>
    </Panel>
  );
}

/**
 * Le stelle di ruolo: piene fino al voto, contornate fino al potenziale.
 *
 * Le mezze stelle sono una stella piena ritagliata a metà sopra una vuota:
 * un `fill` con gradiente richiederebbe un `<defs>` condiviso, e una stella
 * per metà colorata dice la stessa cosa con meno macchinario.
 */
function Stars({ value, potential }: { value: number; potential: number }) {
  return (
    <span className="flex gap-px shrink-0" title={`${value} su 5 · potenziale ${potential}`}>
      {[0, 1, 2, 3, 4].map((i) => {
        const filled = value - i;
        const reachable = potential - i >= 0.5;
        return (
          <span key={i} className="relative block w-2.5 h-2.5">
            <Star
              className={`absolute inset-0 w-2.5 h-2.5 ${reachable ? 'text-primary/35' : 'text-line'}`}
              strokeWidth={2}
            />
            {filled > 0 && (
              <span
                className="absolute inset-0 overflow-hidden"
                style={{ width: filled >= 1 ? '100%' : '50%' }}
              >
                <Star className="w-2.5 h-2.5 text-primary" strokeWidth={2} fill="currentColor" />
              </span>
            )}
          </span>
        );
      })}
    </span>
  );
}

function moodOf(morale: number): string {
  if (morale >= 75) return 'Carico';
  if (morale >= 55) return 'Sereno';
  if (morale >= 35) return 'Incerto';
  return 'Giù di morale';
}

function fitnessOf(fatigue: number): string {
  if (fatigue <= 20) return 'Al meglio';
  if (fatigue <= 45) return 'In forma';
  if (fatigue <= 70) return 'Affaticato';
  return 'Svuotato';
}
