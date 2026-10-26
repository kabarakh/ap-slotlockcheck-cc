import { ITEM_TYPES, type ItemType } from './item-type.js';
import type { MultidataContent } from './multidata.reader.js';

export interface SeedReport {
  players: string[][];
  spheres: string[][];
}

const emptyCounts = (): Record<ItemType, number> => ({ progression: 0, useful: 0, normal: 0, trap: 0 });

export function buildSeedReport(content: MultidataContent): SeedReport {
  const locationsByFinder = new Map<number, number>();
  const countsBySphere = new Map<number, Record<ItemType, number>>();
  for (const location of content.locations) {
    locationsByFinder.set(location.finder, (locationsByFinder.get(location.finder) ?? 0) + 1);
    const counts = countsBySphere.get(location.sphere) ?? emptyCounts();
    counts[location.itemType] += 1;
    countsBySphere.set(location.sphere, counts);
  }
  return {
    players: [
      ['Number', 'Name', 'Game', 'Locations'],
      ...content.players.map((player) => [
        String(player.number),
        player.name,
        player.game,
        String(locationsByFinder.get(player.number) ?? 0),
      ]),
    ],
    spheres: [
      ['Sphere', 'Locations', ...ITEM_TYPES.map((type) => type[0]?.toUpperCase() + type.slice(1))],
      ...[...countsBySphere]
        .sort(([a], [b]) => a - b)
        .map(([sphere, counts]) => [
          String(sphere),
          String(ITEM_TYPES.reduce((sum, type) => sum + counts[type], 0)),
          ...ITEM_TYPES.map((type) => String(counts[type])),
        ]),
    ],
  };
}
