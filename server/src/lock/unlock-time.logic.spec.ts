import { canReplaceUnlockTime, estimateUnlockTime, type ChecksHistoryPoint } from './unlock-time.logic.js';

const point = (time: string, checksBySlotKey: Record<string, number>): ChecksHistoryPoint => ({
  time: new Date(time),
  checksBySlotKey,
});

describe('estimateUnlockTime', () => {
  const history = [
    point('2026-10-01T10:00:00Z', { '7': 0, '8': 3 }),
    point('2026-10-01T10:10:00Z', { '7': 0, '8': 4 }),
    point('2026-10-01T10:20:00Z', { '7': 2, '8': 4 }),
  ];

  it('returns the time of the first increase', () => {
    expect(estimateUnlockTime(history, '7')).toEqual(new Date('2026-10-01T10:20:00Z'));
  });

  it('returns the first data point if the slot already has checks there', () => {
    expect(estimateUnlockTime(history, '8')).toEqual(new Date('2026-10-01T10:00:00Z'));
  });

  it('returns undefined if the checks never increase', () => {
    expect(estimateUnlockTime([point('2026-10-01T10:00:00Z', { '9': 0 })], '9')).toBeUndefined();
    expect(estimateUnlockTime(history, '99')).toBeUndefined();
  });

  it('sorts the data points by time', () => {
    expect(estimateUnlockTime([...history].reverse(), '7')).toEqual(new Date('2026-10-01T10:20:00Z'));
  });
});

describe('canReplaceUnlockTime', () => {
  it('lets manual and CSV times replace all other times', () => {
    expect(canReplaceUnlockTime('sync', 'manual')).toBe(true);
    expect(canReplaceUnlockTime('manual', 'csv')).toBe(true);
    expect(canReplaceUnlockTime('estimated', 'manual')).toBe(true);
  });

  it('never lets an estimation replace a manual, CSV or sync time', () => {
    expect(canReplaceUnlockTime('manual', 'estimated')).toBe(false);
    expect(canReplaceUnlockTime('csv', 'estimated')).toBe(false);
    expect(canReplaceUnlockTime('sync', 'estimated')).toBe(false);
  });

  it('lets an estimation replace an unknown time', () => {
    expect(canReplaceUnlockTime('unknown', 'estimated')).toBe(true);
  });
});
