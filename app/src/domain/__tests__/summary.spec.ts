import { describe, expect, it } from 'vite-plus/test';

import {
  calculateStatistics,
  isGoaled,
  OTHER_PLAYERS_KEY,
  summarizePlayers,
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
  const lock = (lockerSlotId: number, senderSlotId: number | null, unlocked = true) => ({
    lockerSlotId,
    lockerName: 'Locker',
    unlocked,
    senderSlotId,
    senderName: null,
    unlockTime: null,
    timeSource: null,
  });
  const unlockSlots = [
    slotRow({ id: 1, name: 'Locker', isSlotLock: true, discordUserId: '1', discordName: 'alice' }),
    slotRow({ id: 2, name: 'A', discordUserId: '1', discordName: 'alice', lockStatus: 'start_slot' }),
    slotRow({ id: 3, name: 'B', discordUserId: '2', discordName: 'bob', locks: [lock(1, 2)], lockStatus: 'unlocked' }),
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
      unlockedCount: 0,
      goaledCount: 0,
      lockedCount: 0,
      unlocksSentCount: 10 - index,
      warningCount: 0,
      unlockedNames: [],
      goaledNames: [],
      lockedNames: [],
      unlocksSentNames: [],
    }));
    const shares = unlocksSentShares(players, 'Others');
    expect(shares).toHaveLength(8);
    expect(shares[7]).toMatchObject({ key: OTHER_PLAYERS_KEY, label: 'Others', value: 6, color: 'rest' });
    expect(shares.reduce((sum, share) => sum + share.value, 0)).toBe(55);
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
