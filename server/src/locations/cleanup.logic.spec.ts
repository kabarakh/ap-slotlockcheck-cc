import { cleanupEntries, type CleanupGroup, type CleanupSlot } from './cleanup.logic.js';

const slots: CleanupSlot[] = [
  { id: 20, position: 2, name: 'Bob', discordUserId: '2', discordName: 'bob' },
  { id: 10, position: 1, name: 'Alice', discordUserId: '1', discordName: 'alice' },
  { id: 30, position: 3, name: 'Carol', discordUserId: null, discordName: null },
];

const group = (overrides: Partial<CleanupGroup>): CleanupGroup => ({
  sphere: 0,
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

const counts = (progression: number, useful: number, normal: number, trap: number) => ({
  progression,
  useful,
  normal,
  trap,
});

describe('cleanupEntries', () => {
  it('counts the open items of each finder slot in the order of the slot numbers within a sphere', () => {
    expect(cleanupEntries(groups, slots, 'all', false)).toEqual([
      {
        lowestSphere: 0,
        slotId: 10,
        slotName: 'Alice',
        discordUserId: '1',
        discordName: 'alice',
        ...counts(2, 3, 0, 0),
      },
      { lowestSphere: 0, slotId: 20, slotName: 'Bob', discordUserId: '2', discordName: 'bob', ...counts(1, 0, 0, 1) },
      { lowestSphere: 0, slotId: 30, slotName: 'Carol', discordUserId: null, discordName: null, ...counts(0, 0, 4, 0) },
    ]);
  });

  it('sorts by the lowest open sphere of each slot, then by the slot number', () => {
    const entries = cleanupEntries(
      [
        group({ finderSlotId: 10, sphere: 5 }),
        group({ finderSlotId: 10, sphere: 7 }),
        group({ finderSlotId: 20, sphere: 3 }),
        group({ finderSlotId: 30, sphere: 5 }),
      ],
      slots,
      'all',
      false,
    );
    expect(entries.map((entry) => [entry.slotName, entry.lowestSphere])).toEqual([
      ['Bob', 3],
      ['Alice', 5],
      ['Carol', 5],
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
