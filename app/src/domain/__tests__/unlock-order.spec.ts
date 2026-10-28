import { describe, expect, it } from 'vitest';

import { lastUnlockTimeKey, unlockSenderKey } from '../unlock-order';
import { slotRow } from './fixtures';

const lock = (senderName: string | null, unlocked = true, unlockTime: string | null = null) => ({
  lockerSlotId: 1,
  lockerName: 'Locker',
  unlocked,
  senderSlotId: null,
  senderName,
  unlockTime,
  timeSource: null,
});

describe('unlockSenderKey', () => {
  it('joins the sorted names of the senders', () => {
    expect(unlockSenderKey(slotRow({ locks: [lock('Zoe'), lock('Ann')] }))).toBe('Ann, Zoe');
  });

  it('ignores locks without unlock or without known sender', () => {
    expect(unlockSenderKey(slotRow({ locks: [lock('Bob', false), lock(null)] }))).toBeNull();
    expect(unlockSenderKey(slotRow({ locks: [] }))).toBeNull();
  });
});

describe('lastUnlockTimeKey', () => {
  it('uses the latest time of the unlocked locks', () => {
    expect(
      lastUnlockTimeKey(
        slotRow({
          locks: [
            lock('Ann', true, '2026-10-22T11:00:00Z'),
            lock('Bob', true, '2026-10-21T16:30:00Z'),
            lock('Zoe', false, '2026-10-23T09:00:00Z'),
          ],
        }),
      ),
    ).toBe('2026-10-22T11:00:00.000Z');
  });

  it('has no key without a known unlock time', () => {
    expect(lastUnlockTimeKey(slotRow({ locks: [lock('Ann')] }))).toBeNull();
  });
});
