import { describe, expect, it } from 'vite-plus/test';

import {
  calculateStatistics,
  isGoaled,
  OTHER_PLAYERS_KEY,
  summarizePlayers,
  unlocksSentBalance,
  unlocksSentShares,
  type PlayerSummary,
} from '../summary';
import { slotRow } from './fixtures';

const slots = [
  slotRow({ id: 1, name: 'Locker', isSlotLock: true, discordUserId: '1', discordName: 'alice' }),
  slotRow({ id: 2, name: 'A', discordUserId: '1', discordName: 'alice', lockStatus: 'unlocked' }),
  slotRow({ id: 3, name: 'B', discordUserId: '2', discordName: 'bob', lockStatus: 'locked' }),
  slotRow({
    id: 4,
    name: 'C',
    discordUserId: '2',
    discordName: 'bob',
    lockStatus: 'partially_unlocked',
    completionStatus: 'done',
    checksDone: 10,
  }),
  slotRow({
    id: 5,
    name: 'D',
    discordUserId: '3',
    discordName: 'carol',
    completionStatus: 'released',
    lockStatus: 'start_slot',
  }),
];

describe('isGoaled', () => {
  it('uses the Cheese completion status and the Archipelago goal', () => {
    expect(isGoaled(slotRow({ completionStatus: 'goal' }))).toBe(true);
    expect(isGoaled(slotRow({ archipelagoGoal: true }))).toBe(true);
    expect(isGoaled(slotRow({ completionStatus: 'all_checks' }))).toBe(false);
  });
});

describe('summarizePlayers', () => {
  it('summarizes the slots of each player without SlotLock slots', () => {
    expect(summarizePlayers(slots, new Map([[2, 1]]))).toEqual([
      expect.objectContaining({ name: 'alice', slotCount: 1, unlockedCount: 1, lockedCount: 0, warningCount: 1 }),
      expect.objectContaining({ name: 'bob', slotCount: 2, unlockedCount: 0, goaledCount: 1, lockedCount: 2 }),
      expect.objectContaining({ name: 'carol', slotCount: 1, goaledCount: 1, lockedCount: 0 }),
    ]);
  });

  it('lists the slot names of each category', () => {
    const bob = summarizePlayers(slots).find((player) => player.name === 'bob');
    expect(bob).toMatchObject({ unlockedNames: [], goaledNames: ['C'], lockedNames: ['B', 'C'] });
  });
});

describe('unlocks sent by a player', () => {
  const lock = (
    lockerSlotId: number,
    senderSlotId: number | null,
    unlocked = true,
    laterSenderSlotIds: number[] = [],
  ) => ({
    lockerSlotId,
    lockerName: 'Locker',
    unlocked,
    senderSlotId,
    senderName: null,
    unlockTime: null,
    timeSource: null,
    laterSenderSlotIds,
  });
  const unlockSlots = [
    slotRow({ id: 1, name: 'Locker', isSlotLock: true, discordUserId: '1', discordName: 'alice' }),
    slotRow({ id: 2, name: 'A', discordUserId: '1', discordName: 'alice', lockStatus: 'start_slot' }),
    slotRow({
      id: 3,
      name: 'B',
      discordUserId: '2',
      discordName: 'bob',
      locks: [lock(1, 2, true, [3, 6, 1, 6])],
      lockStatus: 'unlocked',
    }),
    slotRow({
      id: 4,
      name: 'C',
      discordUserId: '2',
      discordName: 'bob',
      locks: [lock(1, 2), lock(5, 3)],
      lockStatus: 'unlocked',
    }),
    slotRow({
      id: 6,
      name: 'D',
      discordUserId: '3',
      discordName: 'carol',
      locks: [lock(1, 1), lock(5, 2, false)],
      lockStatus: 'partially_unlocked',
    }),
  ];

  it('counts each slot once for each player that sent one of its unlock items', () => {
    expect(summarizePlayers(unlockSlots)).toEqual([
      expect.objectContaining({ name: 'alice', unlocksSentCount: 2, unlocksSentNames: ['B', 'C'] }),
      expect.objectContaining({ name: 'bob', unlocksSentCount: 1, unlocksSentNames: ['C'] }),
      expect.objectContaining({ name: 'carol', unlocksSentCount: 0, unlocksSentNames: [] }),
    ]);
  });

  it('counts the first and the later unlock items that each player found', () => {
    expect(summarizePlayers(unlockSlots)).toEqual([
      expect.objectContaining({
        name: 'alice',
        firstUnlockItemCount: 2,
        laterUnlockItemCount: 0,
        laterUnlockNames: [],
      }),
      expect.objectContaining({
        name: 'bob',
        firstUnlockItemCount: 1,
        laterUnlockItemCount: 1,
        laterUnlockNames: ['B'],
      }),
      expect.objectContaining({
        name: 'carol',
        firstUnlockItemCount: 0,
        laterUnlockItemCount: 2,
        laterUnlockNames: ['B'],
      }),
    ]);
  });

  it('gives the share of each player that sent unlock items', () => {
    expect(unlocksSentShares(summarizePlayers(unlockSlots), 'Others')).toEqual([
      expect.objectContaining({ label: 'alice', value: 2, percentage: 66.7, color: 'series-1' }),
      expect.objectContaining({ label: 'bob', value: 1, percentage: 33.3, color: 'series-2' }),
    ]);
  });

  it('puts the players after the last series color into one part', () => {
    const players = Array.from({ length: 10 }, (_, index): PlayerSummary => ({
      key: `p${index}`,
      name: `p${index}`,
      discordUserId: null,
      slotCount: 1,
      locationCount: 10,
      unlockedCount: 0,
      goaledCount: 0,
      lockedCount: 0,
      unlocksSentCount: 10 - index,
      firstUnlockItemCount: 0,
      laterUnlockItemCount: 0,
      warningCount: 0,
      unlockedNames: [],
      goaledNames: [],
      lockedNames: [],
      unlocksSentNames: [],
      laterUnlockNames: [],
    }));
    const shares = unlocksSentShares(players, 'Others');
    expect(shares).toHaveLength(8);
    expect(shares[7]).toMatchObject({ key: OTHER_PLAYERS_KEY, label: 'Others', value: 6, color: 'rest' });
    expect(shares.reduce((sum, share) => sum + share.value, 0)).toBe(55);
  });
});

describe('unlocksSentBalance', () => {
  const player = (name: string, slotCount: number, locationCount: number, unlocksSentCount: number): PlayerSummary => ({
    key: name,
    name,
    discordUserId: null,
    slotCount,
    locationCount,
    unlockedCount: 0,
    goaledCount: 0,
    lockedCount: 0,
    unlocksSentCount,
    firstUnlockItemCount: 0,
    laterUnlockItemCount: 0,
    warningCount: 0,
    unlockedNames: [],
    goaledNames: [],
    lockedNames: [],
    unlocksSentNames: [],
    laterUnlockNames: [],
  });

  it('compares the unlocks of each player with the share of slots and of locations', () => {
    const balance = unlocksSentBalance([player('a', 2, 100, 2), player('b', 1, 300, 6), player('c', 1, 100, 0)]);
    expect(balance).toEqual([
      expect.objectContaining({
        key: 'b',
        name: 'b',
        unlocksSentCount: 6,
        bySlots: { share: 25, expected: 2, deviation: 4 },
        byLocations: { share: 60, expected: 4.8, deviation: 1.2 },
      }),
      expect.objectContaining({
        key: 'a',
        name: 'a',
        unlocksSentCount: 2,
        bySlots: { share: 50, expected: 4, deviation: -2 },
        byLocations: { share: 20, expected: 1.6, deviation: 0.4 },
      }),
      expect.objectContaining({
        key: 'c',
        name: 'c',
        unlocksSentCount: 0,
        bySlots: { share: 25, expected: 2, deviation: -2 },
        byLocations: { share: 20, expected: 1.6, deviation: -1.6 },
      }),
    ]);
  });

  it('compares also all found unlock items with the expectation', () => {
    const balance = unlocksSentBalance([
      { ...player('a', 1, 100, 1), firstUnlockItemCount: 1, laterUnlockItemCount: 0 },
      { ...player('b', 1, 100, 0), firstUnlockItemCount: 0, laterUnlockItemCount: 3 },
    ]);
    expect(
      balance.map((entry) => [entry.name, entry.foundUnlockItemCount, entry.byLocations, entry.byLocationsWithLater]),
    ).toEqual([
      ['a', 1, { share: 50, expected: 0.5, deviation: 0.5 }, { share: 50, expected: 2, deviation: -1 }],
      ['b', 3, { share: 50, expected: 0.5, deviation: -0.5 }, { share: 50, expected: 2, deviation: 1 }],
    ]);
  });

  it('expects nothing without locations', () => {
    expect(unlocksSentBalance([player('a', 1, 0, 0)])[0]?.byLocations).toEqual({ share: 0, expected: 0, deviation: 0 });
  });
});

describe('calculateStatistics', () => {
  it('calculates the global statistics', () => {
    expect(calculateStatistics(slots)).toEqual({
      slotCount: 4,
      lockableCount: 3,
      unlockedCount: 1,
      unlockedPercentage: 33.3,
      goaledCount: 2,
      goaledPercentage: 50,
      allChecksCount: 1,
      allChecksPercentage: 25,
      checksDone: 10,
      checksTotal: 50,
      checksPercentage: 20,
      openChecksInLockedSlots: 10,
      openChecksInOpenSlots: 20,
      playersByLockedCount: [
        { lockedCount: 0, playerCount: 2 },
        { lockedCount: 2, playerCount: 1 },
      ],
      playersByUnlockedCount: [
        { slotCount: 0, playerCount: 2 },
        { slotCount: 1, playerCount: 1 },
      ],
    });
  });
});
