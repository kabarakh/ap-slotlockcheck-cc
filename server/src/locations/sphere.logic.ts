import { ITEM_TYPES, type ItemType } from '../seed/item-type.js';

export interface SphereGroup {
  sphere: number;
  checked: boolean;
  itemType: ItemType;
  finderGoaled: boolean;
  receiverGoaled: boolean;
  count: number;
}

export interface SphereSummary {
  sphere: number;
  open: number;
  found: number;
  total: number;
  openByType: Record<ItemType, number>;
}

export function visibleMaxSphere(lowestOpenSphere: number | null, sphereOffset: number, sphereCount: number): number {
  return lowestOpenSphere === null ? sphereCount : lowestOpenSphere + sphereOffset;
}

export function effectiveItemType(itemType: ItemType, receiverGoaled: boolean, excludeGoaled: boolean): ItemType {
  return excludeGoaled && receiverGoaled && itemType === 'progression' ? 'normal' : itemType;
}

const emptyCounts = (): Record<ItemType, number> =>
  Object.fromEntries(ITEM_TYPES.map((type) => [type, 0])) as Record<ItemType, number>;

export function summarizeSpheres(groups: SphereGroup[], excludeGoaled: boolean): SphereSummary[] {
  const summaries = new Map<number, SphereSummary>();
  for (const group of groups) {
    if (excludeGoaled && group.finderGoaled) {
      continue;
    }
    const summary = summaries.get(group.sphere) ?? {
      sphere: group.sphere,
      open: 0,
      found: 0,
      total: 0,
      openByType: emptyCounts(),
    };
    summary.total += group.count;
    if (group.checked) {
      summary.found += group.count;
    } else {
      summary.open += group.count;
      summary.openByType[effectiveItemType(group.itemType, group.receiverGoaled, excludeGoaled)] += group.count;
    }
    summaries.set(group.sphere, summary);
  }
  return [...summaries.values()].sort((a, b) => a.sphere - b.sphere);
}
