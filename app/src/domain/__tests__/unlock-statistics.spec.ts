import { describe, expect, it } from 'vite-plus/test';

import {
  gameBalance,
  leadTimes,
  reactionTimes,
  treeMetrics,
  unlockCurve,
  unlockedWithoutChecks,
  unlockMatrix,
  waitTimes,
} from '../unlock-statistics';
import { buildUnlockForest } from '../unlock-tree';
import { slotRow } from './fixtures';
import type { SlotLock, UnlockTimeSource } from '@/api/types';

const at = (time: string) => `2026-11-01T${time}:00.000Z`;
const ms = (time: string) => new Date(at(time)).getTime();

const lock = (senderSlotId: number | null, unlockTime: string | null, overrides: Partial<SlotLock> = {}): SlotLock => ({
  lockerSlotId: 1,
  lockerName: 'Locker',
  unlocked: true,
  senderSlotId,
  senderName: null,
  unlockTime,
  timeSource: unlockTime ? 'sync' : 'unknown',
  laterUnlocks: [],
  ...overrides,
});

const unlocked = (
  id: number,
  name: string,
  time: string | null,
  source: UnlockTimeSource,
  senderSlotId: number,
  extra = {},
) =>
  slotRow({
    id,
    name,
    lockStatus: 'unlocked',
    unlockTime: time === null ? null : at(time),
    unlockTimeSource: source,
    locks: [lock(senderSlotId, time === null ? null : at(time), { timeSource: source })],
    ...extra,
  });

const slots = [
  slotRow({ id: 1, name: 'Locker', isSlotLock: true, isSelectedSlotLock: true }),
  slotRow({
    id: 2,
    name: 'Start',
    lockStatus: 'start_slot',
    discordUserId: 'a',
    discordName: 'alice',
    game: 'Zelda',
    checksTotal: 30,
  }),
  unlocked(3, 'B', '11:00', 'sync', 2, {
    discordUserId: 'b',
    discordName: 'bob',
    game: 'Metroid',
    checksDone: 4,
    checksTotal: 10,
  }),
  unlocked(4, 'C', '10:00', 'estimated', 3, {
    discordUserId: 'a',
    discordName: 'alice',
    game: 'Zelda',
    checksTotal: 10,
  }),
  unlocked(5, 'D', null, 'unknown', 3, { discordUserId: 'c', discordName: 'carol', game: 'Zelda', checksTotal: 10 }),
  slotRow({ id: 6, name: 'E', lockStatus: 'locked', discordUserId: 'b', discordName: 'bob', game: 'Metroid' }),
];

describe('unlockCurve', () => {
  it('counts the unlocked slots with a known time in time order', () => {
    expect(unlockCurve(slots)).toEqual({
      points: [
        { time: ms('10:00'), value: 1 },
        { time: ms('11:00'), value: 2 },
      ],
      lockableCount: 4,
      withoutTimeCount: 1,
    });
  });
});

describe('waitTimes', () => {
  it('gives the time from the start until the unlock and the time of locked slots until now', () => {
    const result = waitTimes(slots, ms('09:00'), ms('12:00'));
    expect(result.unlocked.map((row) => [row.name, row.minutes, row.estimated])).toEqual([
      ['B', 120, false],
      ['C', 60, true],
    ]);
    expect(result.stillLocked.map((row) => [row.name, row.minutes])).toEqual([['E', 180]]);
  });
});

describe('reactionTimes', () => {
  it('measures only slots with a recorded unlock time', () => {
    const firstChecks = new Map([
      [3, at('11:30')],
      [4, at('10:00')],
    ]);
    expect(reactionTimes(slots, firstChecks).map((row) => [row.name, row.minutes])).toEqual([['B', 30]]);
  });
});

describe('unlockedWithoutChecks', () => {
  it('lists the unlocked slots without checks', () => {
    expect(unlockedWithoutChecks(slots, ms('12:00')).map((row) => [row.name, row.minutes])).toEqual([
      ['C', 120],
      ['D', 0],
    ]);
  });
});

describe('leadTimes', () => {
  it('gives the time between the first and the second unlock item', () => {
    const withLater = [
      ...slots,
      slotRow({
        id: 7,
        name: 'F',
        lockStatus: 'unlocked',
        locks: [
          lock(2, at('10:00'), {
            laterUnlocks: [
              { senderSlotId: 3, firstSeenAt: at('12:30') },
              { senderSlotId: 4, firstSeenAt: at('13:00') },
            ],
          }),
        ],
      }),
      slotRow({
        id: 8,
        name: 'G',
        lockStatus: 'unlocked',
        locks: [lock(2, at('10:00'), { laterUnlocks: [{ senderSlotId: 3, firstSeenAt: null }] })],
      }),
    ];
    expect(leadTimes(withLater)).toEqual({
      rows: [{ slotId: 7, name: 'F', firstSenderName: 'Start', laterSenderName: 'B', minutes: 150 }],
      unlockedPairCount: 5,
      pairsWithLaterItems: 2,
    });
  });
});

describe('unlockMatrix', () => {
  it('counts the unlocks from each sender player to each receiver player', () => {
    const matrix = unlockMatrix(slots);
    expect(matrix.senders.map((player) => player.name)).toEqual(['alice', 'bob']);
    expect(matrix.receivers.map((player) => player.name)).toEqual(['alice', 'bob', 'carol']);
    expect(matrix.values).toEqual([
      [0, 1, 0],
      [1, 0, 1],
    ]);
    expect(matrix.selfUnlocks).toBe(0);
    expect(matrix.mutualPairs).toEqual([['alice', 'bob']]);
  });
});

describe('gameBalance', () => {
  it('compares the unlocks of each game with its share of the locations', () => {
    const games = gameBalance(slots);
    expect(games.map((game) => [game.game, game.unlocksSentCount, game.byLocations.expected])).toEqual([
      ['Metroid', 2, 0.9],
      ['Zelda', 1, 2.1],
    ]);
  });
});

describe('treeMetrics', () => {
  it('gives the depth and the longest chain of the unlock tree', () => {
    const metrics = treeMetrics(buildUnlockForest(slots));
    expect(metrics.maxDepth).toBe(3);
    expect(metrics.longestChain).toEqual(['Start', 'B', 'C']);
    expect(metrics.depthDistribution).toEqual([
      { depth: 1, slotCount: 1 },
      { depth: 2, slotCount: 1 },
      { depth: 3, slotCount: 2 },
    ]);
    expect(metrics.largestSubtrees.map((subtree) => [subtree.name, subtree.descendants])).toEqual([
      ['Start', 3],
      ['B', 2],
    ]);
  });
});
