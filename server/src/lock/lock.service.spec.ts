import { LockService } from './lock.service.js';

describe('LockService', () => {
  it('gives the results of the lock logic', () => {
    const service = new LockService();
    const result = service.detect({
      slots: [
        { position: 1, name: 'Locker' },
        { position: 2, name: 'Alice' },
      ],
      slotLockPositions: [1],
      lockedSlotNamesByLocker: new Map([[1, ['Alice']]]),
      receivedItemsByLocker: new Map(),
      overrides: [],
    });
    expect(result.assignments).toEqual([{ lockerPosition: 1, lockedPosition: 2, source: 'detected' }]);
    expect(service.evaluate([2], [{ lockerSlotId: 1, lockedSlotId: 2 }], []).get(2)?.status).toBe('locked');
    expect(service.canReplaceUnlockTime('unknown', 'estimated')).toBe(true);
  });
});
