import { describe, expect, it } from 'vite-plus/test';

import {
  activityHeatmap,
  checksForecast,
  concurrentPlayers,
  goalTimeline,
  slotForecasts,
} from '../progress-statistics';
import { slotRow } from './fixtures';
import type { RoomHistory } from '@/api/types';

const at = (time: string) => `2026-11-01T${time}:00.000Z`;
const ms = (time: string) => new Date(at(time)).getTime();

const history: RoomHistory = {
  calculatedAt: at('12:00'),
  historyFrom: at('10:00'),
  startedAt: at('10:00'),
  bucketMinutes: 60,
  rateWindowHours: 24,
  buckets: [
    { time: at('10:00'), checks: 5, newChecks: 5, activeSlots: 2, activePlayers: 2 },
    { time: at('11:00'), checks: 8, newChecks: 3, activeSlots: 1, activePlayers: 1 },
  ],
  slots: [
    { slotId: 2, firstCheckTime: at('10:10'), recentChecks: 24 },
    { slotId: 3, firstCheckTime: at('10:20'), recentChecks: 0 },
  ],
};

const slots = [
  slotRow({ id: 1, name: 'Locker', isSlotLock: true, checksTotal: 5 }),
  slotRow({ id: 2, name: 'A', lockStatus: 'start_slot', checksDone: 6, checksTotal: 18 }),
  slotRow({ id: 3, name: 'B', lockStatus: 'unlocked', unlockTime: at('10:30'), checksDone: 2, checksTotal: 10 }),
  slotRow({ id: 4, name: 'C', lockStatus: 'locked', checksTotal: 10 }),
  slotRow({
    id: 5,
    name: 'D',
    lockStatus: 'start_slot',
    completionStatus: 'goal',
    goalTime: at('11:30'),
    checksDone: 3,
    checksTotal: 4,
  }),
];

describe('checksForecast', () => {
  it('continues the pace of the last hours until all open checks are done', () => {
    const result = checksForecast(history, slots);
    expect(result.points).toEqual([
      { time: ms('10:00'), value: 5 },
      { time: ms('11:00'), value: 8 },
    ]);
    expect(result.checksPerHour).toBe(1);
    expect(result.expectedEnd).toBe(ms('12:00') + 30 * 3_600_000);
    expect(result.forecast).toEqual([
      { time: ms('12:00'), value: 11 },
      { time: ms('12:00') + 30 * 3_600_000, value: 41 },
    ]);
  });
});

describe('slotForecasts', () => {
  it('gives the expected end of each playable slot and puts slots without pace first', () => {
    expect(slotForecasts(history, slots).map((row) => [row.name, row.openChecks, row.expectedEnd])).toEqual([
      ['B', 8, null],
      ['A', 12, ms('12:00') + 12 * 3_600_000],
    ]);
  });
});

describe('activityHeatmap and concurrentPlayers', () => {
  it('averages the active players by weekday and hour', () => {
    const heatmap = activityHeatmap(history);
    expect(heatmap.max).toBe(2);
    expect(
      heatmap.values
        .flat()
        .filter((value) => value > 0)
        .sort((a, b) => a - b),
    ).toEqual([1, 2]);
  });

  it('gives the peak of the active players', () => {
    expect(concurrentPlayers(history).peak).toEqual({ time: ms('10:00'), value: 2 });
  });
});

describe('goalTimeline', () => {
  it('orders the slots by goal time and gives the locked and the playable time', () => {
    const rows = goalTimeline(slots, ms('10:00'));
    expect(rows.map((row) => [row.name, row.lockedFrom, row.playFrom, row.goalAt, row.minutesToGoal])).toEqual([
      ['D', null, ms('10:00'), ms('11:30'), 90],
      ['A', null, ms('10:00'), null, null],
      ['B', ms('10:00'), ms('10:30'), null, null],
      ['C', ms('10:00'), null, null, null],
    ]);
  });
});
