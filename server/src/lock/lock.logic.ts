import type {
  FirstUnlockItem,
  LockAssignmentResult,
  LockDetectionInput,
  LockDetectionResult,
  SlotIdentity,
  SlotLockState,
  StoredLock,
  StoredUnlock,
} from './lock.types.js';

const UNLOCK_PREFIX = 'Unlock ';
const BONUS_SLOT_PATTERN = /^Unlock Bonus Slot \d+$/;
const NOTHING_ITEM = 'Nothing';

export function normalizeSlotName(name: string): string {
  return name.trim().toLocaleLowerCase('en');
}

export function unlockTargetName(itemName: string): string | undefined {
  if (itemName === NOTHING_ITEM || BONUS_SLOT_PATTERN.test(itemName) || !itemName.startsWith(UNLOCK_PREFIX)) {
    return undefined;
  }
  return itemName.slice(UNLOCK_PREFIX.length);
}

function pairKey(lockerPosition: number, lockedPosition: number): string {
  return `${lockerPosition}:${lockedPosition}`;
}

export function createSlotFinder<Slot extends SlotIdentity>(slots: Slot[]): (name: string) => Slot | undefined {
  const byName = new Map<string, Slot>();
  for (const slot of slots) {
    for (const alias of slot.aliases ?? []) {
      byName.set(normalizeSlotName(alias), slot);
    }
  }
  for (const slot of slots) {
    byName.set(normalizeSlotName(slot.name), slot);
  }
  return (name) => byName.get(normalizeSlotName(name));
}

export function detectLocks(input: LockDetectionInput): LockDetectionResult {
  const findSlot = createSlotFinder(input.slots);
  const unknownSlotNames = new Set<string>();
  const detected = new Map<string, LockAssignmentResult>();
  const firstUnlockItems = new Map<string, FirstUnlockItem>();

  const addDetected = (lockerPosition: number, lockedPosition: number) => {
    detected.set(pairKey(lockerPosition, lockedPosition), { lockerPosition, lockedPosition, source: 'detected' });
  };

  for (const lockerPosition of input.slotLockPositions) {
    for (const lockedName of input.lockedSlotNamesByLocker.get(lockerPosition) ?? []) {
      const lockedSlot = findSlot(lockedName);
      if (lockedSlot) {
        addDetected(lockerPosition, lockedSlot.position);
      } else {
        unknownSlotNames.add(lockedName);
      }
    }

    for (const item of input.receivedItemsByLocker.get(lockerPosition) ?? []) {
      const targetName = unlockTargetName(item.itemName);
      if (targetName === undefined) {
        continue;
      }
      const lockedSlot = findSlot(targetName);
      if (!lockedSlot) {
        unknownSlotNames.add(targetName);
        continue;
      }
      addDetected(lockerPosition, lockedSlot.position);
      const key = pairKey(lockerPosition, lockedSlot.position);
      if (!firstUnlockItems.has(key)) {
        firstUnlockItems.set(key, {
          lockerPosition,
          lockedPosition: lockedSlot.position,
          senderPosition: item.senderPosition,
        });
      }
    }
  }

  const assignments = new Map(detected);
  for (const override of input.overrides) {
    const key = pairKey(override.lockerPosition, override.lockedPosition);
    if (override.notLocked) {
      assignments.delete(key);
    } else {
      assignments.set(key, {
        lockerPosition: override.lockerPosition,
        lockedPosition: override.lockedPosition,
        source: 'admin',
      });
    }
  }

  return {
    assignments: [...assignments.values()],
    firstUnlockItems: [...firstUnlockItems.values()],
    unknownSlotNames: [...unknownSlotNames],
  };
}

function latestUnlock(unlocks: StoredUnlock[]): Pick<SlotLockState, 'unlockTime' | 'unlockTimeSource'> {
  if (unlocks.some((unlock) => unlock.unlockTime === null)) {
    return { unlockTime: null, unlockTimeSource: 'unknown' };
  }
  const latest = unlocks.reduce((current, unlock) =>
    (unlock.unlockTime?.getTime() ?? 0) > (current.unlockTime?.getTime() ?? 0) ? unlock : current,
  );
  return { unlockTime: latest.unlockTime, unlockTimeSource: latest.timeSource };
}

export function detectStartSlots(
  slots: (SlotIdentity & { isSlotLock: boolean })[],
  lockedSlotNamesByLocker: Map<number, string[]>,
  assignments: LockAssignmentResult[],
): number[] {
  if (lockedSlotNamesByLocker.size === 0) {
    return [];
  }
  const lockedPositions = new Set(assignments.map((assignment) => assignment.lockedPosition));
  return slots.filter((slot) => !slot.isSlotLock && !lockedPositions.has(slot.position)).map((slot) => slot.position);
}

export function evaluateSlotLockStates(
  slotIds: number[],
  locks: StoredLock[],
  unlocks: StoredUnlock[],
  startSlotIds: ReadonlySet<number> = new Set(),
): Map<number, SlotLockState> {
  const unlocksByPair = new Map(unlocks.map((unlock) => [`${unlock.lockerSlotId}:${unlock.lockedSlotId}`, unlock]));
  const states = new Map<number, SlotLockState>();

  for (const slotId of slotIds) {
    const slotLocks = locks.filter((lock) => lock.lockedSlotId === slotId);
    const lockStates = slotLocks.map((lock) => {
      const unlock = unlocksByPair.get(`${lock.lockerSlotId}:${slotId}`);
      return {
        lockerSlotId: lock.lockerSlotId,
        unlocked: unlock !== undefined,
        senderSlotId: unlock?.senderSlotId ?? null,
        unlockTime: unlock?.unlockTime ?? null,
        timeSource: unlock?.timeSource ?? null,
      };
    });
    const unlockedCount = lockStates.filter((lock) => lock.unlocked).length;
    const status =
      slotLocks.length === 0
        ? startSlotIds.has(slotId)
          ? 'start_slot'
          : 'not_locked'
        : unlockedCount === slotLocks.length
          ? 'unlocked'
          : unlockedCount > 0
            ? 'partially_unlocked'
            : 'locked';
    const necessaryUnlocks = slotLocks
      .map((lock) => unlocksByPair.get(`${lock.lockerSlotId}:${slotId}`))
      .filter((unlock): unlock is StoredUnlock => unlock !== undefined);
    const time = status === 'unlocked' ? latestUnlock(necessaryUnlocks) : { unlockTime: null, unlockTimeSource: null };
    states.set(slotId, { slotId, status, locks: lockStates, ...time });
  }

  return states;
}
