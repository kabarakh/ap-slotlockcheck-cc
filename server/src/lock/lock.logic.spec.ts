import { detectLocks, detectStartSlots, evaluateSlotLockStates, unlockTargetName } from './lock.logic.js';
import type { LockDetectionInput, StoredUnlock } from './lock.types.js';

const slots = [
  { position: 1, name: 'Locker' },
  { position: 2, name: 'Alice' },
  { position: 3, name: 'Bob' },
  { position: 4, name: 'Carol' },
  { position: 5, name: 'Second Locker' },
];

function input(overrides: Partial<LockDetectionInput> = {}): LockDetectionInput {
  return {
    slots,
    slotLockPositions: [1],
    lockedSlotNamesByLocker: new Map(),
    receivedItemsByLocker: new Map(),
    overrides: [],
    ...overrides,
  };
}

describe('unlockTargetName', () => {
  it('returns the slot name of an unlock item', () => {
    expect(unlockTargetName('Unlock Alice')).toBe('Alice');
  });

  it('ignores bonus slots, Nothing and other items', () => {
    expect(unlockTargetName('Unlock Bonus Slot 3')).toBeUndefined();
    expect(unlockTargetName('Nothing')).toBeUndefined();
    expect(unlockTargetName('Progressive Sword')).toBeUndefined();
  });
});

describe('detectLocks', () => {
  it('detects locks from the slot data of one SlotLock slot', () => {
    const result = detectLocks(input({ lockedSlotNamesByLocker: new Map([[1, ['Alice', 'Bob']]]) }));
    expect(result.assignments).toEqual([
      { lockerPosition: 1, lockedPosition: 2, source: 'detected' },
      { lockerPosition: 1, lockedPosition: 3, source: 'detected' },
    ]);
    expect(result.firstUnlockItems).toEqual([]);
  });

  it('detects locks and unlocks from received items', () => {
    const result = detectLocks(
      input({ receivedItemsByLocker: new Map([[1, [{ itemName: 'Unlock Carol', senderPosition: 2 }]]]) }),
    );
    expect(result.assignments).toEqual([{ lockerPosition: 1, lockedPosition: 4, source: 'detected' }]);
    expect(result.firstUnlockItems).toEqual([{ lockerPosition: 1, lockedPosition: 4, senderPosition: 2 }]);
  });

  it('uses only the first unlock item of duplicates', () => {
    const result = detectLocks(
      input({
        receivedItemsByLocker: new Map([
          [
            1,
            [
              { itemName: 'Unlock Alice', senderPosition: 3 },
              { itemName: 'Unlock Alice', senderPosition: 4 },
            ],
          ],
        ]),
      }),
    );
    expect(result.firstUnlockItems).toEqual([{ lockerPosition: 1, lockedPosition: 2, senderPosition: 3 }]);
  });

  it('ignores bonus slot and Nothing items', () => {
    const result = detectLocks(
      input({
        receivedItemsByLocker: new Map([
          [
            1,
            [
              { itemName: 'Unlock Bonus Slot 1', senderPosition: 2 },
              { itemName: 'Nothing', senderPosition: 2 },
            ],
          ],
        ]),
      }),
    );
    expect(result.assignments).toEqual([]);
    expect(result.firstUnlockItems).toEqual([]);
    expect(result.unknownSlotNames).toEqual([]);
  });

  it('compares slot names without case and reports unknown names', () => {
    const result = detectLocks(
      input({
        receivedItemsByLocker: new Map([
          [
            1,
            [
              { itemName: 'Unlock ALICE', senderPosition: 3 },
              { itemName: 'Unlock Dave', senderPosition: 3 },
            ],
          ],
        ]),
      }),
    );
    expect(result.firstUnlockItems).toEqual([{ lockerPosition: 1, lockedPosition: 2, senderPosition: 3 }]);
    expect(result.unknownSlotNames).toEqual(['Dave']);
  });

  it('keeps the locks of more than one SlotLock slot apart', () => {
    const result = detectLocks(
      input({
        slotLockPositions: [1, 5],
        lockedSlotNamesByLocker: new Map([
          [1, ['Alice']],
          [5, ['Alice', 'Bob']],
        ]),
        receivedItemsByLocker: new Map([[5, [{ itemName: 'Unlock Alice', senderPosition: 4 }]]]),
      }),
    );
    expect(result.assignments).toHaveLength(3);
    expect(result.firstUnlockItems).toEqual([{ lockerPosition: 5, lockedPosition: 2, senderPosition: 4 }]);
  });

  it('ignores SlotLock slots that are not selected', () => {
    const result = detectLocks(input({ lockedSlotNamesByLocker: new Map([[5, ['Alice']]]) }));
    expect(result.assignments).toEqual([]);
  });

  it('applies admin overrides', () => {
    const result = detectLocks(
      input({
        lockedSlotNamesByLocker: new Map([[1, ['Alice', 'Bob']]]),
        overrides: [
          { lockerPosition: 1, lockedPosition: 2, notLocked: true },
          { lockerPosition: 1, lockedPosition: 4, notLocked: false },
        ],
      }),
    );
    expect(result.assignments).toEqual([
      { lockerPosition: 1, lockedPosition: 3, source: 'detected' },
      { lockerPosition: 1, lockedPosition: 4, source: 'admin' },
    ]);
  });
});

describe('detectStartSlots', () => {
  const slotsWithType = slots.map((slot) => ({ ...slot, isSlotLock: slot.name.includes('Locker') }));

  it('gives the playable slots that no selected SlotLock slot locks', () => {
    const assignments = [
      { lockerPosition: 1, lockedPosition: 2, source: 'detected' as const },
      { lockerPosition: 1, lockedPosition: 3, source: 'detected' as const },
    ];
    expect(detectStartSlots(slotsWithType, new Map([[1, ['Alice', 'Bob']]]), assignments)).toEqual([4]);
  });

  it('gives no start slots without slot data', () => {
    expect(detectStartSlots(slotsWithType, new Map(), [])).toEqual([]);
  });
});

describe('evaluateSlotLockStates', () => {
  it('separates start slots from slots that are not locked', () => {
    const states = evaluateSlotLockStates([10, 20], [], [], new Set([20]));
    expect(states.get(10)?.status).toBe('not_locked');
    expect(states.get(20)?.status).toBe('start_slot');
  });

  it('prefers a lock over the start slot mark', () => {
    const states = evaluateSlotLockStates([20], [{ lockerSlotId: 1, lockedSlotId: 20 }], [], new Set([20]));
    expect(states.get(20)?.status).toBe('locked');
  });

  const t1 = new Date('2026-10-01T10:00:00Z');
  const t2 = new Date('2026-10-02T10:00:00Z');
  const unlock = (lockerSlotId: number, lockedSlotId: number, time: Date | null): StoredUnlock => ({
    lockerSlotId,
    lockedSlotId,
    senderSlotId: 3,
    unlockTime: time,
    timeSource: time ? 'sync' : 'unknown',
  });

  it('reports not locked, locked, partially unlocked and unlocked', () => {
    const states = evaluateSlotLockStates(
      [10, 20, 30, 40],
      [
        { lockerSlotId: 1, lockedSlotId: 20 },
        { lockerSlotId: 1, lockedSlotId: 30 },
        { lockerSlotId: 5, lockedSlotId: 30 },
        { lockerSlotId: 1, lockedSlotId: 40 },
      ],
      [unlock(1, 30, t1), unlock(1, 40, t2)],
    );
    expect(states.get(10)?.status).toBe('not_locked');
    expect(states.get(20)?.status).toBe('locked');
    expect(states.get(30)?.status).toBe('partially_unlocked');
    expect(states.get(40)?.status).toBe('unlocked');
    expect(states.get(40)?.unlockTime).toEqual(t2);
  });

  it('uses the time of the last necessary unlock item', () => {
    const states = evaluateSlotLockStates(
      [30],
      [
        { lockerSlotId: 1, lockedSlotId: 30 },
        { lockerSlotId: 5, lockedSlotId: 30 },
      ],
      [unlock(1, 30, t2), unlock(5, 30, t1)],
    );
    expect(states.get(30)).toMatchObject({ status: 'unlocked', unlockTime: t2, unlockTimeSource: 'sync' });
  });

  it('reports an unknown unlock time if one necessary time is unknown', () => {
    const states = evaluateSlotLockStates(
      [30],
      [
        { lockerSlotId: 1, lockedSlotId: 30 },
        { lockerSlotId: 5, lockedSlotId: 30 },
      ],
      [unlock(1, 30, t2), unlock(5, 30, null)],
    );
    expect(states.get(30)).toMatchObject({ unlockTime: null, unlockTimeSource: 'unknown' });
  });

  it('ignores unlock items of removed lock assignments', () => {
    const states = evaluateSlotLockStates([30], [], [unlock(1, 30, t1)]);
    expect(states.get(30)?.status).toBe('not_locked');
  });
});
