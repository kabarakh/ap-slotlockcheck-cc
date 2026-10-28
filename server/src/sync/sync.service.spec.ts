import type { SlotRowDto } from '../rooms/dto/slot-row.dto.js';
import { diffRoster } from './roster.diff.js';
import { manualSyncWaitSeconds } from './sync.controller.js';
import { isSyncDue } from './sync.scheduler.js';

describe('isSyncDue', () => {
  const now = new Date('2026-10-24T12:00:00Z');

  it('is due without a last synchronization', () => {
    expect(isSyncDue(null, now, 5)).toBe(true);
  });

  it('is due after the interval', () => {
    expect(isSyncDue(new Date('2026-10-24T11:55:00Z'), now, 5)).toBe(true);
    expect(isSyncDue(new Date('2026-10-24T11:56:00Z'), now, 5)).toBe(false);
  });
});

describe('manualSyncWaitSeconds', () => {
  const now = new Date('2026-10-24T12:00:00Z');

  it('allows a manual synchronization after the cooldown', () => {
    expect(manualSyncWaitSeconds(null, now, 60)).toBe(0);
    expect(manualSyncWaitSeconds(new Date('2026-10-24T11:59:00Z'), now, 60)).toBe(0);
  });

  it('gives the remaining seconds during the cooldown', () => {
    expect(manualSyncWaitSeconds(new Date('2026-10-24T11:59:30Z'), now, 60)).toBe(30);
  });
});

describe('diffRoster', () => {
  const row = (id: number, checksDone: number) => ({ id, checksDone }) as SlotRowDto;

  it('finds changed, new and removed rows', () => {
    const diff = diffRoster([row(1, 0), row(2, 0), row(3, 0)], [row(1, 0), row(2, 5), row(4, 0)]);
    expect(diff.changedSlots.map((slot) => slot.id)).toEqual([2, 4]);
    expect(diff.removedSlotIds).toEqual([3]);
  });
});
