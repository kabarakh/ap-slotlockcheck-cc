import { roomHistory, type HistorySlot } from './history.logic.js';

const slot = (id: number, discordUserId: string | null = `user-${id}`): HistorySlot => ({
  id,
  cheeseGameId: id,
  discordUserId,
  discordName: null,
});

const at = (time: string) => new Date(`2026-11-01T${time}:00Z`);

describe('roomHistory', () => {
  it('sums the checks in buckets of one hour and counts active slots and players', () => {
    const result = roomHistory({
      history: [
        { time: at('10:00'), checksBySlotKey: { '1': 0, '2': 5 } },
        { time: at('10:20'), checksBySlotKey: { '1': 3, '2': 5 } },
        { time: at('11:10'), checksBySlotKey: { '1': 3, '2': 9 } },
      ],
      slots: [slot(1, 'same'), slot(2, 'same')],
      bulkLimitChecks: 40,
      now: at('12:00'),
    });
    expect(result.historyFrom).toEqual(at('10:00'));
    expect(result.startedAt).toEqual(at('10:00'));
    expect(result.buckets).toEqual([
      { time: at('10:00'), checks: 8, newChecks: 3, activeSlots: 1, activePlayers: 1 },
      { time: at('11:00'), checks: 12, newChecks: 4, activeSlots: 1, activePlayers: 1 },
      { time: at('12:00'), checks: 12, newChecks: 0, activeSlots: 0, activePlayers: 0 },
    ]);
  });

  it('gives the first check of a slot that starts with zero checks', () => {
    const result = roomHistory({
      history: [
        { time: at('10:00'), checksBySlotKey: { '1': 0, '2': 4 } },
        { time: at('10:30'), checksBySlotKey: { '1': 2, '2': 6 } },
      ],
      slots: [slot(1), slot(2)],
      bulkLimitChecks: 40,
      now: at('11:00'),
    });
    expect(result.slots).toEqual([
      { slotId: 1, firstCheckTime: at('10:30'), recentChecks: 2 },
      { slotId: 2, firstCheckTime: null, recentChecks: 2 },
    ]);
  });

  it('does not count a bulk step as activity or as recent checks', () => {
    const result = roomHistory({
      history: [
        { time: at('10:00'), checksBySlotKey: { '1': 0 } },
        { time: at('10:10'), checksBySlotKey: { '1': 100 } },
      ],
      slots: [slot(1)],
      bulkLimitChecks: 40,
      now: at('10:30'),
    });
    expect(result.buckets[0]).toMatchObject({ checks: 100, newChecks: 100, activeSlots: 0 });
    expect(result.slots[0]?.recentChecks).toBe(0);
  });

  it('gives no buckets without history', () => {
    const result = roomHistory({ history: [], slots: [slot(1)], bulkLimitChecks: 40, now: at('10:00') });
    expect(result).toEqual({
      historyFrom: null,
      startedAt: null,
      buckets: [],
      slots: [{ slotId: 1, firstCheckTime: null, recentChecks: 0 }],
    });
  });
});
