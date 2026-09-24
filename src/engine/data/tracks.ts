import type { Track } from '../types.js';
import { baseLapFrom, overtakingFrom, tyreWearFrom } from '../layout.js';
import { raceLaps } from '../rules.js';

/** Un circuito come lo si scrive: senza i numeri che si derivano da soli. */
type TrackSeed = Omit<Track, 'overtaking' | 'tyreWear' | 'laps' | 'baseLap'>;

/**
 * Circuiti di fantasia con la forma di circuiti veri.
 *
 * I nomi e i disegni sono inventati — «Formula 1» e i nomi degli autodromi
 * sono marchi protetti — ma la **forma del giro** è misurata sulla geometria
 * reale dei tracciati del mondiale, presa da `bacinger/f1-circuits` (dati
 * derivati da OpenStreetMap, © i contributori OSM, ODbL).
 *
 * Misurarla invece di indovinarla cambia la qualità del gioco: Lario ha il
 * 66% di rettilineo perché Monza ce l'ha, Vallmar il 58% di curve lente
 * perché Monaco ce l'ha. Il procedimento sta in `tools/derive-layouts.py`,
 * insieme al motivo per cui usa due misure diverse.
 *
 * Il resto è inventato e parametrizzato sui valori reali: giro 70–105 s,
 * 44–71 giri. Sono 31 per 24 gare, quindi qualche circuito resta fuori ogni
 * anno e il calendario ruota da solo.
 *
 * La `region` non è decorazione: il calendario la usa per costruire il giro
 * del mondo nell'ordine giusto. Un campionato vero non salta dall'Europa
 * all'Oceania e ritorno — apre in Oceania, attraversa l'Asia, passa l'estate
 * in Europa e chiude in America e in Medio Oriente. Senza la regione il
 * generatore produrrebbe un calendario legale ma assurdo.
 *
 * `localStart` e `utcOffset` servono a dire al giocatore a che ora si corre,
 * da casa sua: una gara che in loco parte alle 20:00 può essere l'alba o il
 * primo pomeriggio in Italia, ed è la differenza fra seguirla e registrarla.
 */
const SEEDS: readonly TrackSeed[] = [
  // Oceania — l'apertura, a marzo, quando in Europa è ancora inverno.
  { id: 'porthaven', name: 'Port Haven',            region: 'oceania',    lengthKm: 5.26, layout: { straight: 0.44, slow: 0.19, medium: 0.20, fast: 0.17 }, width: 0.55, drsZones: 2, safetyCar: 0.42, rain: 0.22, trackTemp: 33, localStart: 15, utcOffset: 11 },
  { id: 'tarawera',  name: 'Tarawera Downs',        region: 'oceania',    lengthKm: 4.51, layout: { straight: 0.36, slow: 0.26, medium: 0.24, fast: 0.14 }, width: 0.80, drsZones: 1, safetyCar: 0.24, rain: 0.32, trackTemp: 25, localStart: 15, utcOffset: 12 },

  // Asia
  { id: 'shenhai',   name: 'Shenhai International', region: 'asia',       lengthKm: 5.43, layout: { straight: 0.31, slow: 0.34, medium: 0.21, fast: 0.14 }, width: 0.95, drsZones: 2, safetyCar: 0.24, rain: 0.22, trackTemp: 31, localStart: 15, utcOffset:  8 },
  { id: 'kaido',     name: 'Kaido Speedway',        region: 'asia',       lengthKm: 5.80, layout: { straight: 0.37, slow: 0.25, medium: 0.14, fast: 0.24 }, width: 0.70, drsZones: 1, safetyCar: 0.18, rain: 0.28, trackTemp: 29, localStart: 14, utcOffset:  9 },
  { id: 'hokutan',   name: 'Hokutan Circuit',       region: 'asia',       lengthKm: 5.30, layout: { straight: 0.37, slow: 0.34, medium: 0.20, fast: 0.09 }, width: 0.85, drsZones: 2, safetyCar: 0.22, rain: 0.36, trackTemp: 28, localStart: 14, utcOffset:  9 },
  { id: 'caspia',    name: 'Caspia City Circuit',   region: 'asia',       lengthKm: 5.93, layout: { straight: 0.50, slow: 0.22, medium: 0.10, fast: 0.18 }, width: 0.35, drsZones: 2, safetyCar: 0.52, rain: 0.10, trackTemp: 34, localStart: 15, utcOffset:  4 },
  { id: 'hanuman',   name: 'Hanuman Circuit',       region: 'asia',       lengthKm: 5.54, layout: { straight: 0.35, slow: 0.30, medium: 0.25, fast: 0.10 }, width: 0.85, drsZones: 2, safetyCar: 0.26, rain: 0.34, trackTemp: 36, localStart: 16, utcOffset:  7 },
  { id: 'lumen',     name: 'Lumen Bay',             region: 'asia',       lengthKm: 4.93, layout: { straight: 0.31, slow: 0.48, medium: 0.08, fast: 0.13 }, width: 0.25, drsZones: 3, safetyCar: 0.58, rain: 0.30, trackTemp: 32, localStart: 20, utcOffset:  8 },

  // Medio Oriente — due in primavera, due a chiudere l'anno.
  { id: 'sahir',     name: 'Sahir Circuit',         region: 'middleEast', lengthKm: 5.40, layout: { straight: 0.43, slow: 0.27, medium: 0.20, fast: 0.10 }, width: 0.95, drsZones: 3, safetyCar: 0.26, rain: 0.02, trackTemp: 42, localStart: 18, utcOffset:  3 },
  { id: 'marabec',   name: 'Marabec Street',        region: 'middleEast', lengthKm: 5.82, layout: { straight: 0.44, slow: 0.20, medium: 0.17, fast: 0.19 }, width: 0.20, drsZones: 2, safetyCar: 0.46, rain: 0.08, trackTemp: 47, localStart: 20, utcOffset:  3 },
  { id: 'qalat',     name: 'Qalat International',   region: 'middleEast', lengthKm: 5.41, layout: { straight: 0.39, slow: 0.31, medium: 0.07, fast: 0.23 }, width: 0.90, drsZones: 1, safetyCar: 0.20, rain: 0.02, trackTemp: 39, localStart: 19, utcOffset:  3 },
  { id: 'zerakh',    name: 'Zerakh Corniche',       region: 'middleEast', lengthKm: 6.17, layout: { straight: 0.40, slow: 0.19, medium: 0.16, fast: 0.25 }, width: 0.45, drsZones: 3, safetyCar: 0.50, rain: 0.01, trackTemp: 35, localStart: 20, utcOffset:  3 },
  { id: 'jubail',    name: 'Jubail Desert Circuit', region: 'middleEast', lengthKm: 5.28, layout: { straight: 0.39, slow: 0.27, medium: 0.18, fast: 0.16 }, width: 0.90, drsZones: 2, safetyCar: 0.30, rain: 0.02, trackTemp: 49, localStart: 17, utcOffset:  4 },

  // Europa — il cuore della stagione, da maggio a settembre.
  { id: 'lario',     name: 'Autodromo di Lario',    region: 'europe',     lengthKm: 5.77, layout: { straight: 0.66, slow: 0.10, medium: 0.07, fast: 0.17 }, width: 0.85, drsZones: 2, safetyCar: 0.24, rain: 0.15, trackTemp: 41, localStart: 15, utcOffset:  2 },
  { id: 'vallmar',   name: 'Circuito di Vallmar',   region: 'europe',     lengthKm: 3.32, layout: { straight: 0.15, slow: 0.58, medium: 0.16, fast: 0.11 }, width: 0.10, drsZones: 1, safetyCar: 0.38, rain: 0.12, trackTemp: 36, localStart: 15, utcOffset:  2 },
  { id: 'nordkap',   name: 'Nordkap Ring',          region: 'europe',     lengthKm: 6.95, layout: { straight: 0.47, slow: 0.21, medium: 0.12, fast: 0.20 }, width: 0.80, drsZones: 2, safetyCar: 0.22, rain: 0.34, trackTemp: 26, localStart: 15, utcOffset:  2 },
  { id: 'ostvik',    name: 'Østvik Motorpark',      region: 'europe',     lengthKm: 4.15, layout: { straight: 0.34, slow: 0.29, medium: 0.32, fast: 0.05 }, width: 0.80, drsZones: 2, safetyCar: 0.20, rain: 0.30, trackTemp: 28, localStart: 15, utcOffset:  2 },
  { id: 'corvara',   name: 'Corvara Alpina',        region: 'europe',     lengthKm: 5.12, layout: { straight: 0.27, slow: 0.45, medium: 0.13, fast: 0.15 }, width: 0.60, drsZones: 1, safetyCar: 0.24, rain: 0.40, trackTemp: 24, localStart: 15, utcOffset:  2 },
  { id: 'belmonte',  name: 'Belmonte',              region: 'europe',     lengthKm: 4.65, layout: { straight: 0.33, slow: 0.33, medium: 0.21, fast: 0.13 }, width: 0.75, drsZones: 2, safetyCar: 0.22, rain: 0.18, trackTemp: 40, localStart: 15, utcOffset:  2 },
  { id: 'hallstatt', name: 'Hallstatt Ring',        region: 'europe',     lengthKm: 4.30, layout: { straight: 0.53, slow: 0.20, medium: 0.10, fast: 0.17 }, width: 0.90, drsZones: 3, safetyCar: 0.28, rain: 0.30, trackTemp: 32, localStart: 15, utcOffset:  2 },
  { id: 'wyverne',   name: 'Wyverne Park',          region: 'europe',     lengthKm: 5.86, layout: { straight: 0.40, slow: 0.21, medium: 0.21, fast: 0.18 }, width: 0.90, drsZones: 2, safetyCar: 0.20, rain: 0.32, trackTemp: 27, localStart: 15, utcOffset:  1 },
  { id: 'madrigal',  name: 'Madrigal Urbano',       region: 'europe',     lengthKm: 5.41, layout: { straight: 0.27, slow: 0.39, medium: 0.19, fast: 0.15 }, width: 0.55, drsZones: 2, safetyCar: 0.34, rain: 0.14, trackTemp: 35, localStart: 15, utcOffset:  2 },
  { id: 'argenta',   name: 'Argenta',               region: 'europe',     lengthKm: 4.89, layout: { straight: 0.49, slow: 0.20, medium: 0.13, fast: 0.18 }, width: 0.45, drsZones: 1, safetyCar: 0.36, rain: 0.24, trackTemp: 31, localStart: 15, utcOffset:  2 },

  // Americhe — la trasferta d'autunno, più una tappa di primavera.
  { id: 'terranova', name: 'Terranova',             region: 'americas',   lengthKm: 5.41, layout: { straight: 0.35, slow: 0.34, medium: 0.17, fast: 0.14 }, width: 0.60, drsZones: 3, safetyCar: 0.26, rain: 0.10, trackTemp: 38, localStart: 16, utcOffset: -4 },
  { id: 'saldanha',  name: 'Saldanha Park',         region: 'americas',   lengthKm: 4.95, layout: { straight: 0.37, slow: 0.34, medium: 0.14, fast: 0.15 }, width: 0.85, drsZones: 2, safetyCar: 0.14, rain: 0.20, trackTemp: 44, localStart: 14, utcOffset: -3 },
  { id: 'sierra',    name: 'Sierra Grande',         region: 'americas',   lengthKm: 5.51, layout: { straight: 0.31, slow: 0.37, medium: 0.17, fast: 0.15 }, width: 0.90, drsZones: 2, safetyCar: 0.22, rain: 0.16, trackTemp: 37, localStart: 14, utcOffset: -5 },
  { id: 'altavista', name: 'Altavista',             region: 'americas',   lengthKm: 4.30, layout: { straight: 0.33, slow: 0.34, medium: 0.20, fast: 0.13 }, width: 0.85, drsZones: 3, safetyCar: 0.32, rain: 0.18, trackTemp: 30, localStart: 14, utcOffset: -6 },
  { id: 'paulinho',  name: 'Paulinho',              region: 'americas',   lengthKm: 4.28, layout: { straight: 0.30, slow: 0.30, medium: 0.28, fast: 0.12 }, width: 0.70, drsZones: 2, safetyCar: 0.40, rain: 0.38, trackTemp: 33, localStart: 14, utcOffset: -3 },
  { id: 'cascabel',  name: 'Cascabel Harbour',      region: 'americas',   lengthKm: 4.44, layout: { straight: 0.32, slow: 0.27, medium: 0.22, fast: 0.19 }, width: 0.55, drsZones: 3, safetyCar: 0.38, rain: 0.20, trackTemp: 43, localStart: 16, utcOffset: -4 },
  { id: 'andalis',   name: "Île d'Andalis",         region: 'americas',   lengthKm: 4.34, layout: { straight: 0.37, slow: 0.34, medium: 0.12, fast: 0.17 }, width: 0.45, drsZones: 3, safetyCar: 0.48, rain: 0.26, trackTemp: 29, localStart: 14, utcOffset: -4 },
  { id: 'neonvale',  name: 'Neonvale Strip',        region: 'americas',   lengthKm: 6.20, layout: { straight: 0.54, slow: 0.23, medium: 0.16, fast: 0.07 }, width: 0.50, drsZones: 2, safetyCar: 0.44, rain: 0.05, trackTemp: 18, localStart: 20, utcOffset: -8 },
];

/**
 * Sorpassi e degrado non si scrivono: si derivano dalla forma del giro.
 *
 * Erano due numeri autorevoli scritti a mano per ogni circuito, e potevano
 * contraddire il tracciato che dicevano di descrivere — un circuito di soli
 * rettilinei con i sorpassi impossibili. Ora la forma è il dato e questi sono
 * la conseguenza: cambiare la forma cambia tutto insieme, in modo coerente.
 */
export const TRACKS: readonly Track[] = SEEDS.map((t) => ({
  ...t,
  baseLap: baseLapFrom(t.lengthKm, t.layout),
  laps: raceLaps(t.lengthKm),
  overtaking: overtakingFrom(t.layout, t.width, t.drsZones),
  tyreWear: tyreWearFrom(t.layout, t.trackTemp),
}));

export function getTrack(id: string): Track {
  const t = TRACKS.find((x) => x.id === id);
  if (!t) throw new Error(`Circuito sconosciuto: ${id}`);
  return t;
}

/** Una gara che parte alle 18:00 locali o dopo si corre sotto i riflettori. */
export function isNightRace(t: Track): boolean {
  return t.localStart >= 18;
}
