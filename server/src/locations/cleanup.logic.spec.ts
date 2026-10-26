import { cleanupEntries, type CleanupGroup, type CleanupSlot } from './cleanup.logic.js';

const slots: CleanupSlot[] = [
  { id: 20, position: 2, name: 'Bob', discordUserId: '2', discordName: 'bob' },
  { id: 10, position: 1, name: 'Alice', discordUserId: '1', discordName: 'alice' },
  { id: 30, position: 3, name: 'Carol', discordUserId: null, discordName: null },
];

const group = (overrides: Partial<CleanupGroup>): CleanupGroup => ({
  finderSlotId: 10,
  itemType: 'progression',
  finderGoaled: false,
  receiverGoaled: false,
  count: 1,
  ...overrides,
});

const groups = [
  group({ count: 2 }),
  group({ itemType: 'useful', count: 3 }),
  group({ finderSlotId: 20, itemType: 'trap' }),
  group({ finderSlotId: 20, receiverGoaled: true }),
  group({ finderSlotId: 30, finderGoaled: true, itemType: 'normal', count: 4 }),
];

describe('cleanupEntries', () => {
  it('counts the open items of each finder slot in the order of the slots', () => {
    expect(cleanupEntries(groups, slots, 'all', false)).toEqual([
      {
        slotId: 10,
        slotName: 'Alice',
        discordUserId: '1',
        discordName: 'alice',
        progression: 2,
        useful: 3,
        normal: 0,
        trap: 0,
      },
      {
        slotId: 20,
        slotName: 'Bob',
        discordUserId: '2',
        discordName: 'bob',
        progression: 1,
        useful: 0,
        normal: 0,
        trap: 1,
      },
      {
        slotId: 30,
        slotName: 'Carol',
        discordUserId: null,
        discordName: null,
        progression: 0,
        useful: 0,
        normal: 4,
        trap: 0,
      },
    ]);
  });

  it('gives only the slots with open progression on request', () => {
    expect(cleanupEntries(groups, slots, 'progression', false).map((entry) => entry.slotName)).toEqual([
      'Alice',
      'Bob',
    ]);
  });

  it('excludes finders with reached goal and counts their items as filler with the switch', () => {
    const entries = cleanupEntries(groups, slots, 'progression', true);
    expect(entries.map((entry) => entry.slotName)).toEqual(['Alice']);
    expect(cleanupEntries(groups, slots, 'all', true)[1]).toMatchObject({ slotName: 'Bob', progression: 0, normal: 1 });
  });
});
