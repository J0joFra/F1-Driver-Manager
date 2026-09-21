import type { World } from './types.js';
import { createRng, hashSeed } from './rng.js';
import { createNewgen, overall } from './driver.js';
import { createWorld } from './world.js';

/**
 * Avvio di una carriera da pilota.
 *
 * Il giocatore entra in un mondo già popolato: prende il sedile della scuderia
 * meno prestigiosa, al posto del suo pilota più debole. È la situazione tipica
 * del rookie — la macchina peggiore in griglia e tutto da dimostrare.
 */
export interface StartCareerOptions {
  seed: number;
  name: string;
  nationality: string;
  /** potenziale di partenza: è il tetto della carriera, e non si alzerà mai */
  potential?: number;
}

export function startCareer(opts: StartCareerOptions): World {
  const world = createWorld({ seed: opts.seed });
  const rng = createRng(hashSeed(`career:${opts.name}`, opts.seed));

  const team = Object.values(world.teams).sort((a, b) => a.prestige - b.prestige)[0]!;
  const weakest = team.driverIds
    .map((id) => world.drivers[id]!)
    .sort((a, b) => overall(a.attrs) - overall(b.attrs))[0]!;

  // Il pilota sostituito non sparisce: torna sul mercato e potrà tornarti utile come rivale.
  team.driverIds = team.driverIds.filter((id) => id !== weakest.id);
  weakest.teamId = null;
  weakest.contractYears = 0;
  world.academy.push(weakest.id);

  const player = createNewgen(rng, {
    potentialAnchor: opts.potential ?? 80,
    ageMin: 18,
    ageMax: 19,
    id: 'player',
  });
  player.name = opts.name.trim() || player.name;
  player.nationality = opts.nationality;
  player.isPlayer = true;
  player.teamId = team.id;
  player.contractYears = 2;
  player.salary = 600_000;
  player.money = 150_000;
  player.reputation = 12;

  world.drivers[player.id] = player;
  world.standings[player.id] = 0;
  team.driverIds.push(player.id);
  world.seat = { mode: 'pilota', driverId: player.id };

  return world;
}
