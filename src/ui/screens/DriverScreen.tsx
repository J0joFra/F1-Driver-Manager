import { useGame } from '../../state/useGame.js';
import { player, teamOf } from '../../engine/selectors.js';
import { overall } from '../../engine/driver.js';
import { ATTRIBUTE_KEYS } from '../../engine/types.js';
import { ATTRIBUTE_COLOURS, AttrRow, DriverBadge, KeyRow, Panel, Stat } from '../components/kit.js';
import { ATTR_LABELS } from '../format.js';

/**
 * La scheda del pilota.
 *
 * A destra gli attributi per esteso, ciascuno con il proprio tetto: la
 * distanza dal potenziale è l'informazione che guida ogni scelta di
 * allenamento, quindi è scritta sotto ogni barra e non va cercata.
 */
export function DriverScreen() {
  const world = useGame((s) => s.world)!;
  const me = player(world)!;
  const team = teamOf(world, me);

  return (
    <div className="h-full grid grid-cols-[216px_1fr] gap-2 min-h-0">
      <div className="flex flex-col gap-2 min-h-0">
        <Panel title="Profilo" className="shrink-0" bodyClass="p-2.5">
          <div className="flex flex-col items-center">
            <DriverBadge name={me.name} colour={team?.colour ?? '#5D6C85'} size={46} />
            <div className="font-sans text-xs font-bold mt-1.5 text-center leading-tight">{me.name}</div>
            <div className="font-mono text-2xs text-muted">{team?.name}</div>
          </div>
          {/* Quattro numeri su una riga sola: in 390 px di altezza una griglia
              2×2 costerebbe trenta pixel che servono alla lista sotto. */}
          <div className="grid grid-cols-4 gap-2 mt-2 pt-2 border-t border-line">
            <Stat value={Math.round(overall(me.attrs))} label="OVR" tone="green" />
            <Stat value={Math.round(overall(me.caps))} label="POT" tone="accent" />
            <Stat value={me.age} label="Età" />
            <Stat value={me.history.length} label="Stag." />
          </div>
        </Panel>

        <Panel title="Carriera" className="flex-1" bodyClass="p-2.5 scroll-y">
          <KeyRow label="Titoli" value={me.career.titles} tone="accent" />
          <KeyRow label="Vittorie" value={me.career.wins} />
          <KeyRow label="Podi" value={me.career.podiums} />
          <KeyRow label="Pole" value={me.career.poles} />
          <KeyRow label="Gare disputate" value={me.career.starts} />
          <KeyRow
            label="Miglior arrivo"
            value={me.career.bestFinish === 99 ? '—' : `P${me.career.bestFinish}`}
          />
          <KeyRow label="Reputazione" value={Math.round(me.reputation)} />
          <KeyRow label="Esperienza" value={`${Math.round(me.experience / 10)}%`} />
          <KeyRow
            label="Stanchezza"
            value={Math.round(me.fatigue)}
            {...(me.fatigue > 70 ? { tone: 'bad' as const } : {})}
          />
        </Panel>
      </div>

      <Panel title="Attributi" tag={`potenziale ${Math.round(overall(me.caps))}`} bodyClass="px-3 py-1 scroll-y">
        {ATTRIBUTE_KEYS.map((k) => (
          <AttrRow
            key={k}
            label={ATTR_LABELS[k]!}
            value={me.attrs[k]}
            cap={me.caps[k]}
            colour={ATTRIBUTE_COLOURS[k]}
          />
        ))}
      </Panel>
    </div>
  );
}
