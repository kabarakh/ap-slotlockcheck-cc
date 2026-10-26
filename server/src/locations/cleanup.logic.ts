import { ITEM_TYPES, type ItemType } from '../seed/item-type.js';
import { effectiveItemType } from './sphere.logic.js';

export interface CleanupGroup {
  sphere: number;
  finderSlotId: number;
  itemType: ItemType;
  finderGoaled: boolean;
  receiverGoaled: boolean;
  count: number;
}

export interface CleanupSlot {
  id: number;
  position: number;
  name: string;
  discordUserId: string | null;
  discordName: string | null;
}

export type CleanupSlotMode = 'all' | 'progression';

export interface CleanupEntry extends Record<ItemType, number> {
  lowestSphere: number;
  slotId: number;
  slotName: string;
  discordUserId: string | null;
  discordName: string | null;
}

export function cleanupEntries(
  groups: CleanupGroup[],
  slots: CleanupSlot[],
  mode: CleanupSlotMode,
  excludeGoaled: boolean,
): CleanupEntry[] {
  const counts = new Map<number, Record<ItemType, number>>();
  const lowestSpheres = new Map<number, number>();
  for (const group of groups) {
    if (excludeGoaled && group.finderGoaled) {
      continue;
    }
    lowestSpheres.set(
      group.finderSlotId,
      Math.min(lowestSpheres.get(group.finderSlotId) ?? group.sphere, group.sphere),
    );
    const slotCounts =
      counts.get(group.finderSlotId) ??
      (Object.fromEntries(ITEM_TYPES.map((type) => [type, 0])) as Record<ItemType, number>);
    slotCounts[effectiveItemType(group.itemType, group.receiverGoaled, excludeGoaled)] += group.count;
    counts.set(group.finderSlotId, slotCounts);
  }
  return [...slots]
    .sort((a, b) => a.position - b.position)
    .flatMap((slot) => {
      const slotCounts = counts.get(slot.id);
      if (!slotCounts || (mode === 'progression' && slotCounts.progression === 0)) {
        return [];
      }
      return [
        {
          lowestSphere: lowestSpheres.get(slot.id) ?? 0,
          slotId: slot.id,
          slotName: slot.name,
          discordUserId: slot.discordUserId,
          discordName: slot.discordName,
          ...slotCounts,
        },
      ];
    })
    .sort((a, b) => a.lowestSphere - b.lowestSphere);
}
