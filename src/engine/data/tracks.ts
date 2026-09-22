import type { Track } from '../types.js';

/**
 * Circuiti di fantasia, parametrizzati sui valori reali della Formula 1
 * (giro 70–100 s, 44–78 giri). I nomi non ricalcano autodromi esistenti.
 */
export const TRACKS: readonly Track[] = [
  { id: 'lario',    name: 'Autodromo di Lario',    baseLap: 88.0, laps: 53, overtaking: 0.46, tyreWear: 1.05, safetyCar: 0.24, rain: 0.15, trackTemp: 41 },
  { id: 'vallmar',  name: 'Circuito di Vallmar',   baseLap: 74.5, laps: 70, overtaking: 0.30, tyreWear: 1.30, safetyCar: 0.38, rain: 0.12, trackTemp: 36 },
  { id: 'kaido',    name: 'Kaido Speedway',        baseLap: 92.4, laps: 48, overtaking: 0.58, tyreWear: 0.88, safetyCar: 0.18, rain: 0.28, trackTemp: 29 },
  { id: 'nordkap',  name: 'Nordkap Ring',          baseLap: 81.2, laps: 60, overtaking: 0.34, tyreWear: 1.18, safetyCar: 0.22, rain: 0.34, trackTemp: 26 },
  { id: 'saldanha', name: 'Saldanha Park',         baseLap: 95.8, laps: 44, overtaking: 0.62, tyreWear: 0.95, safetyCar: 0.14, rain: 0.20, trackTemp: 44 },
  { id: 'marabec',  name: 'Marabec Street',        baseLap: 79.6, laps: 66, overtaking: 0.22, tyreWear: 1.42, safetyCar: 0.46, rain: 0.08, trackTemp: 47 },
  { id: 'ostvik',   name: 'Østvik Motorpark',      baseLap: 86.1, laps: 55, overtaking: 0.50, tyreWear: 1.00, safetyCar: 0.20, rain: 0.30, trackTemp: 28 },
  { id: 'terranova',name: 'Terranova',             baseLap: 90.7, laps: 50, overtaking: 0.44, tyreWear: 1.12, safetyCar: 0.26, rain: 0.10, trackTemp: 38 },
  { id: 'jubail',   name: 'Jubail Desert Circuit', baseLap: 97.3, laps: 45, overtaking: 0.54, tyreWear: 1.25, safetyCar: 0.30, rain: 0.02, trackTemp: 49 },
  { id: 'corvara',  name: 'Corvara Alpina',        baseLap: 83.9, laps: 58, overtaking: 0.28, tyreWear: 0.92, safetyCar: 0.24, rain: 0.40, trackTemp: 24 },
  { id: 'porthaven',name: 'Port Haven',            baseLap: 76.8, laps: 68, overtaking: 0.26, tyreWear: 1.35, safetyCar: 0.42, rain: 0.22, trackTemp: 33 },
  { id: 'belmonte', name: 'Belmonte',              baseLap: 89.5, laps: 52, overtaking: 0.48, tyreWear: 1.08, safetyCar: 0.22, rain: 0.18, trackTemp: 40 },
];

export function getTrack(id: string): Track {
  const t = TRACKS.find((x) => x.id === id);
  if (!t) throw new Error(`Circuito sconosciuto: ${id}`);
  return t;
}
