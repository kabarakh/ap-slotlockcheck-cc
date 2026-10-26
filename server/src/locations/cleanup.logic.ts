import { ITEM_TYPES, type ItemType } from '../seed/item-type.js';
import { effectiveItemType } from './sphere.logic.js';

export interface CleanupGroup {
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
  for (const group of groups) {
    if (excludeGoaled && group.finderGoaled) {
      continue;
    }
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
          slotId: slot.id,
          slotName: slot.name,
          discordUserId: slot.discordUserId,
          discordName: slot.discordName,
          ...slotCounts,
        },
      ];
    });
}
