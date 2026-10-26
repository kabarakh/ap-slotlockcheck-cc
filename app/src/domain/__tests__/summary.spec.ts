import { describe, expect, it } from 'vitest';
import { calculateStatistics, isGoaled, summarizePlayers } from '../summary';
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
