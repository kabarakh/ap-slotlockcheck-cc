import { parseCsvTime, parseUnlockTimeCsv } from './unlock-time-csv.js';

describe('parseCsvTime', () => {
  it('reads ISO times and simple UTC times', () => {
    expect(parseCsvTime('2026-10-20T10:00:00+02:00')).toEqual(new Date('2026-10-20T08:00:00Z'));
    expect(parseCsvTime('2026-10-20 10:00')).toEqual(new Date('2026-10-20T10:00:00Z'));
    expect(parseCsvTime('yesterday')).toBeUndefined();
  });
});

describe('parseUnlockTimeCsv', () => {
  it('reads rows with and without locker', () => {
    const result = parseUnlockTimeCsv(
      'slot,locker,unlock_time\nAlice,,2026-10-20 10:00\nCarol,Locker2,2026-10-21 11:30\n',
    );
    expect(result.errors).toEqual([]);
    expect(result.rows).toEqual([
      { line: 2, slot: 'Alice', locker: null, unlockTime: new Date('2026-10-20T10:00:00Z') },
      { line: 3, slot: 'Carol', locker: 'Locker2', unlockTime: new Date('2026-10-21T11:30:00Z') },
    ]);
  });

  it('accepts semicolons and reports wrong rows', () => {
    const result = parseUnlockTimeCsv('Slot;Unlock_Time\nAlice;soon\nBob;2026-10-20 10:00');
    expect(result.rows).toHaveLength(1);
    expect(result.errors).toEqual(['Line 2: "soon" is not a valid time']);
  });

  it('reports missing columns', () => {
    expect(parseUnlockTimeCsv('name,time\nAlice,2026-10-20 10:00').errors).toEqual([
      'Line 2: columns "slot" and "unlock_time" are necessary',
    ]);
  });
});
