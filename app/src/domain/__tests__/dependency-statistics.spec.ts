import { describe, expect, it } from 'vite-plus/test';

import { blockerStatistics, progressionStatistics, sphereProgressCurve } from '../dependency-statistics';
import { slotRow } from './fixtures';
import type { RoomDependencies } from '@/api/types';

const slots = [
  slotRow({ id: 1, name: 'Locker', isSlotLock: true }),
  slotRow({ id: 2, name: 'A', discordUserId: 'a', discordName: 'alice' }),
  slotRow({ id: 3, name: 'B', discordUserId: 'b', discordName: 'bob' }),
  slotRow({ id: 4, name: 'C', discordUserId: 'a', discordName: 'alice' }),
  slotRow({ id: 5, name: 'D', discordUserId: 'c', discordName: 'carol' }),
];

describe('blockerStatistics', () => {
  it('groups the open unlock items by player and by locked slot', () => {
    const result = blockerStatistics(
      [
        { lockedSlotId: 3, lockerSlotId: 1, finderSlotId: 2, locationName: 'Chest', sphere: 4 },
        { lockedSlotId: 3, lockerSlotId: 1, finderSlotId: 5, locationName: 'Boss', sphere: 2 },
        { lockedSlotId: 5, lockerSlotId: 1, finderSlotId: 4, locationName: 'Shop', sphere: 1 },
      ],
      slots,
    );
    expect(
      result.players.map((player) => [player.name, player.blockedSlotCount, player.itemCount, player.lowestSphere]),
    ).toEqual([
      ['alice', 2, 2, 1],
      ['carol', 1, 1, 2],
    ]);
    expect(result.slots.map((slot) => [slot.name, slot.copyCount, slot.finderNames])).toEqual([
      ['D', 1, ['C']],
      ['B', 2, ['A', 'D']],
    ]);
    expect(result.details.map((detail) => detail.locationName)).toEqual(['Shop', 'Boss', 'Chest']);
  });
});

describe('progressionStatistics', () => {
  it('counts the progression for other players and leaves out SlotLock slots', () => {
    const result = progressionStatistics(
      [
        { finderSlotId: 2, receiverSlotId: 3, total: 4, open: 2 },
        { finderSlotId: 2, receiverSlotId: 4, total: 3, open: 3 },
        { finderSlotId: 3, receiverSlotId: 2, total: 1, open: 0 },
        { finderSlotId: 5, receiverSlotId: 1, total: 9, open: 9 },
      ],
      slots,
    );
    expect(result.players).toEqual([
      { key: 'a', name: 'alice', openForOthers: 2, totalForOthers: 4, waitingOnOthers: 0 },
      { key: 'b', name: 'bob', openForOthers: 0, totalForOthers: 1, waitingOnOthers: 2 },
    ]);
    expect(result.finders.map((player) => player.name)).toEqual(['alice']);
    expect(result.receivers.map((player) => player.name)).toEqual(['alice', 'bob']);
    expect(result.openValues).toEqual([[3, 2]]);
  });
});

describe('sphereProgressCurve', () => {
  const dependencies = (spheres: RoomDependencies['spheres']): RoomDependencies => ({
    calculatedAt: '2026-11-01T20:00:00.000Z',
    seedUploadedAt: '2026-11-01T08:00:00.000Z',
    blockers: [],
    progressionFlow: [],
    spheres,
  });

  it('gives the lowest open sphere over the time', () => {
    const result = sphereProgressCurve(
      dependencies([
        { sphere: 0, locationCount: 2, doneAt: '2026-11-01T10:00:00.000Z' },
        { sphere: 1, locationCount: 2, doneAt: '2026-11-01T09:00:00.000Z' },
        { sphere: 2, locationCount: 2, doneAt: null },
      ]),
    );
    expect(result.lowestOpenSphere).toBe(2);
    expect(result.points.map((point) => [new Date(point.time).toISOString().slice(11, 16), point.value])).toEqual([
      ['08:00', 0],
      ['10:00', 1],
      ['10:00', 2],
      ['20:00', 2],
    ]);
  });
});
