import { createSlotFinder, unlockTargetName } from '../lock/lock.logic.js';
import { slotIdentity } from '../sync/room-source.mapper.js';

export interface DependencySlot {
  id: number;
  name: string;
  archipelagoName: string | null;
  isSelectedSlotLock: boolean;
  goaled: boolean;
  goalTime: Date | null;
}

export interface LockPair {
  lockerSlotId: number;
  lockedSlotId: number;
}

export interface OpenUnlockLocation {
  finderSlotId: number;
  receiverSlotId: number | null;
  itemName: string;
  locationName: string;
  sphere: number;
}

export interface BlockerRow {
  lockedSlotId: number;
  lockerSlotId: number;
  finderSlotId: number;
  locationName: string;
  sphere: number;
}

export interface ProgressionGroup {
  finderSlotId: number;
  receiverSlotId: number | null;
  checked: boolean;
  count: number;
}

export interface ProgressionFlowRow {
  finderSlotId: number;
  receiverSlotId: number;
  total: number;
  open: number;
}

export interface SphereGroup {
  sphere: number;
  finderSlotId: number;
  checked: boolean;
  fillerMarked: boolean;
  count: number;
  latestCheckedAt: Date | null;
  latestFillerMarkAt: Date | null;
}

export interface SphereProgressRow {
  sphere: number;
  locationCount: number;
  doneAt: Date | null;
}

const pairKey = (lockerSlotId: number, lockedSlotId: number) => `${lockerSlotId}:${lockedSlotId}`;

export function blockerRows(
  slots: DependencySlot[],
  locks: LockPair[],
  unlocks: LockPair[],
  locations: OpenUnlockLocation[],
): BlockerRow[] {
  const findSlot = createSlotFinder(slots.map((slot) => slotIdentity({ ...slot, position: slot.id })));
  const unlocked = new Set(unlocks.map((unlock) => pairKey(unlock.lockerSlotId, unlock.lockedSlotId)));
  const open = new Set(
    locks.map((lock) => pairKey(lock.lockerSlotId, lock.lockedSlotId)).filter((key) => !unlocked.has(key)),
  );
  return locations.flatMap((location) => {
    const targetName = location.receiverSlotId === null ? undefined : unlockTargetName(location.itemName);
    const locked = targetName === undefined ? undefined : findSlot(targetName);
    if (locked === undefined || location.receiverSlotId === null) {
      return [];
    }
    if (!open.has(pairKey(location.receiverSlotId, locked.position))) {
      return [];
    }
    return [
      {
        lockedSlotId: locked.position,
        lockerSlotId: location.receiverSlotId,
        finderSlotId: location.finderSlotId,
        locationName: location.locationName,
        sphere: location.sphere,
      },
    ];
  });
}

export function progressionFlow(groups: ProgressionGroup[]): ProgressionFlowRow[] {
  const rows = new Map<string, ProgressionFlowRow>();
  for (const group of groups) {
    if (group.receiverSlotId === null) {
      continue;
    }
    const key = `${group.finderSlotId}:${group.receiverSlotId}`;
    const row = rows.get(key) ?? {
      finderSlotId: group.finderSlotId,
      receiverSlotId: group.receiverSlotId,
      total: 0,
      open: 0,
    };
    row.total += group.count;
    if (!group.checked) {
      row.open += group.count;
    }
    rows.set(key, row);
  }
  return [...rows.values()].sort((a, b) => a.finderSlotId - b.finderSlotId || a.receiverSlotId - b.receiverSlotId);
}

const later = (a: Date | null, b: Date | null): Date | null => (a === null ? b : b === null || a > b ? a : b);

export function sphereProgress(
  groups: SphereGroup[],
  slots: DependencySlot[],
  seedUploadedAt: Date,
): SphereProgressRow[] {
  const slotsById = new Map(slots.map((slot) => [slot.id, slot]));
  const rows = new Map<number, SphereProgressRow & { open: boolean }>();
  for (const group of groups) {
    const row = rows.get(group.sphere) ?? { sphere: group.sphere, locationCount: 0, doneAt: null, open: false };
    row.locationCount += group.count;
    const finder = slotsById.get(group.finderSlotId);
    if (group.checked) {
      row.doneAt = later(row.doneAt, group.latestCheckedAt ?? seedUploadedAt);
    } else if (group.fillerMarked) {
      row.doneAt = later(row.doneAt, group.latestFillerMarkAt ?? seedUploadedAt);
    } else if (finder?.goaled) {
      row.doneAt = later(row.doneAt, finder.goalTime ?? seedUploadedAt);
    } else {
      row.open = true;
    }
    rows.set(group.sphere, row);
  }
  return [...rows.values()]
    .sort((a, b) => a.sphere - b.sphere)
    .map((row) => ({ sphere: row.sphere, locationCount: row.locationCount, doneAt: row.open ? null : row.doneAt }));
}
