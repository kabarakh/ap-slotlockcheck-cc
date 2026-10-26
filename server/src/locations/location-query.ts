import type { Prisma } from '../generated/prisma/client.js';
import type { ItemType } from '../seed/item-type.js';
import type { LocationSlotScope, LocationSortField, LocationState, SortOrder } from './dto/location.dto.js';
import { notGoaledSlotFilter } from './goal.logic.js';

export interface LocationFilter {
  roomId: number;
  state: LocationState;
  slots: LocationSlotScope;
  slotIds: number[];
  discordUserId: string | null;
  itemTypes: ItemType[];
  fromSphere: number | null;
  toSphere: number | null;
  excludeGoaled: boolean;
}

const STATE_FILTERS: Record<LocationState, Prisma.SeedLocationWhereInput> = {
  open: { checked: false },
  found: { checked: true },
  filler: { fillerMarkedAt: { not: null } },
};

export function locationWhere(filter: LocationFilter): Prisma.SeedLocationWhereInput {
  const conditions: Prisma.SeedLocationWhereInput[] = [{ roomId: filter.roomId }, STATE_FILTERS[filter.state]];
  if (filter.slots === 'mine') {
    conditions.push({ finderSlot: { discordUserId: filter.discordUserId ?? '' } });
  }
  if (filter.slots === 'selected') {
    conditions.push({ finderSlotId: { in: filter.slotIds } });
  }
  if (filter.itemTypes.length > 0) {
    conditions.push({ itemType: { in: filter.itemTypes } });
  }
  if (filter.fromSphere !== null) {
    conditions.push({ sphere: { gte: filter.fromSphere } });
  }
  if (filter.toSphere !== null) {
    conditions.push({ sphere: { lte: filter.toSphere } });
  }
  if (filter.excludeGoaled) {
    conditions.push({ finderSlot: notGoaledSlotFilter });
  }
  return { AND: conditions };
}

const SORT_FIELDS: Record<LocationSortField, (order: SortOrder) => Prisma.SeedLocationOrderByWithRelationInput> = {
  sphere: (order) => ({ sphere: order }),
  finder: (order) => ({ finderSlot: { name: order } }),
  location: (order) => ({ locationName: order }),
  game: (order) => ({ finderSlot: { game: order } }),
  receiver: (order) => ({ receiverName: order }),
  item: (order) => ({ itemName: order }),
};

export function locationOrderBy(
  sort: LocationSortField,
  order: SortOrder,
): Prisma.SeedLocationOrderByWithRelationInput[] {
  return [SORT_FIELDS[sort](order), { sphere: 'asc' }, { finderSlot: { position: 'asc' } }, { id: 'asc' }];
}
