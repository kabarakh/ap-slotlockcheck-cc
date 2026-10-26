import { canMarkFiller, canRemoveFillerMark } from './filler-permission.logic.js';
import { locationOrderBy, locationWhere, type LocationFilter } from './location-query.js';
import { effectiveItemType, summarizeSpheres, visibleMaxSphere, type SphereGroup } from './sphere.logic.js';

const group = (overrides: Partial<SphereGroup>): SphereGroup => ({
  sphere: 0,
  checked: false,
  itemType: 'progression',
  finderGoaled: false,
  receiverGoaled: false,
  count: 1,
  ...overrides,
});

describe('visibleMaxSphere', () => {
  it('adds the offset to the lowest open sphere', () => {
    expect(visibleMaxSphere(32, 2, 111)).toBe(34);
    expect(visibleMaxSphere(32, 0, 111)).toBe(32);
  });

  it('shows all spheres when all locations are checked', () => {
    expect(visibleMaxSphere(null, 2, 111)).toBe(111);
  });
});

describe('effectiveItemType', () => {
  it('counts progression for a slot with reached goal as filler only with the switch', () => {
    expect(effectiveItemType('progression', true, true)).toBe('normal');
    expect(effectiveItemType('progression', true, false)).toBe('progression');
    expect(effectiveItemType('progression', false, true)).toBe('progression');
    expect(effectiveItemType('useful', true, true)).toBe('useful');
  });
});

describe('summarizeSpheres', () => {
  const groups = [
    group({ sphere: 1, itemType: 'trap', count: 2 }),
    group({ sphere: 0, count: 3 }),
    group({ sphere: 0, checked: true, count: 4 }),
    group({ sphere: 0, itemType: 'useful', receiverGoaled: true, count: 1 }),
    group({ sphere: 0, receiverGoaled: true, count: 5 }),
    group({ sphere: 2, finderGoaled: true, count: 6 }),
  ];

  it('counts open, found and total locations and the open item types for each sphere', () => {
    expect(summarizeSpheres(groups, false)).toEqual([
      { sphere: 0, open: 9, found: 4, total: 13, openByType: { progression: 8, useful: 1, normal: 0, trap: 0 } },
      { sphere: 1, open: 2, found: 0, total: 2, openByType: { progression: 0, useful: 0, normal: 0, trap: 2 } },
      { sphere: 2, open: 6, found: 0, total: 6, openByType: { progression: 6, useful: 0, normal: 0, trap: 0 } },
    ]);
  });

  it('ignores finders with reached goal and counts items for them as filler with the switch', () => {
    expect(summarizeSpheres(groups, true)).toEqual([
      { sphere: 0, open: 9, found: 4, total: 13, openByType: { progression: 3, useful: 1, normal: 5, trap: 0 } },
      { sphere: 1, open: 2, found: 0, total: 2, openByType: { progression: 0, useful: 0, normal: 0, trap: 2 } },
    ]);
  });
});

describe('canMarkFiller', () => {
  const base = { role: 'player' as const, playersMarkFiller: true, isOwnSlot: true, checked: false };

  it('permits admins and helpers for each open location', () => {
    expect(canMarkFiller({ ...base, role: 'admin', playersMarkFiller: false, isOwnSlot: false })).toBe(true);
    expect(canMarkFiller({ ...base, role: 'helper', playersMarkFiller: false, isOwnSlot: false })).toBe(true);
  });

  it('permits players only for the own slots and only with the room setting', () => {
    expect(canMarkFiller(base)).toBe(true);
    expect(canMarkFiller({ ...base, isOwnSlot: false })).toBe(false);
    expect(canMarkFiller({ ...base, playersMarkFiller: false })).toBe(false);
  });

  it('never permits visitors and checked locations', () => {
    expect(canMarkFiller({ ...base, role: 'visitor' })).toBe(false);
    expect(canMarkFiller({ ...base, role: 'admin', checked: true })).toBe(false);
  });

  it('permits the removal of a mark only for helpers and admins', () => {
    expect(canRemoveFillerMark('admin')).toBe(true);
    expect(canRemoveFillerMark('helper')).toBe(true);
    expect(canRemoveFillerMark('player')).toBe(false);
    expect(canRemoveFillerMark('visitor')).toBe(false);
  });
});

describe('locationWhere', () => {
  const filter: LocationFilter = {
    roomId: 7,
    state: 'open',
    slots: 'all',
    slotIds: [],
    receiverSlotIds: [],
    discordUserId: null,
    itemTypes: [],
    fromSphere: null,
    toSphere: null,
    excludeGoaled: false,
  };

  it('filters by room and state', () => {
    expect(locationWhere(filter)).toEqual({ AND: [{ roomId: 7 }, { checked: false }] });
    expect(locationWhere({ ...filter, state: 'found' })).toEqual({ AND: [{ roomId: 7 }, { checked: true }] });
    expect(locationWhere({ ...filter, state: 'filler' })).toEqual({
      AND: [{ roomId: 7 }, { fillerMarkedAt: { not: null } }],
    });
  });

  it('adds the slot, item type, sphere and goal filters', () => {
    expect(
      locationWhere({
        ...filter,
        slots: 'mine',
        discordUserId: '42',
        itemTypes: ['trap'],
        fromSphere: 2,
        toSphere: 5,
        excludeGoaled: true,
      }).AND,
    ).toEqual([
      { roomId: 7 },
      { checked: false },
      { finderSlot: { discordUserId: '42' } },
      { itemType: { in: ['trap'] } },
      { sphere: { gte: 2 } },
      { sphere: { lte: 5 } },
      { finderSlot: { archipelagoGoal: false, completionStatus: { notIn: ['goal', 'done', 'released'] } } },
    ]);
    expect(locationWhere({ ...filter, receiverSlotIds: [1] }).AND).toContainEqual({ receiverSlotId: { in: [1] } });
    expect(locationWhere({ ...filter, slots: 'selected', slotIds: [3, 4] }).AND).toContainEqual({
      finderSlotId: { in: [3, 4] },
    });
  });

  it('finds no slot for "mine" without a Discord user', () => {
    expect(locationWhere({ ...filter, slots: 'mine' }).AND).toContainEqual({ finderSlot: { discordUserId: '' } });
  });
});

describe('locationOrderBy', () => {
  it('sorts by the selected field, then by sphere, finder and ID', () => {
    expect(locationOrderBy('game', 'desc')).toEqual([
      { finderSlot: { game: 'desc' } },
      { sphere: 'asc' },
      { finderSlot: { position: 'asc' } },
      { id: 'asc' },
    ]);
    expect(locationOrderBy('receiver', 'asc')[0]).toEqual({ receiverName: 'asc' });
    expect(locationOrderBy('item', 'asc')[0]).toEqual({ itemName: 'asc' });
    expect(locationOrderBy('location', 'asc')[0]).toEqual({ locationName: 'asc' });
    expect(locationOrderBy('finder', 'asc')[0]).toEqual({ finderSlot: { name: 'asc' } });
    expect(locationOrderBy('sphere', 'desc')[0]).toEqual({ sphere: 'desc' });
  });
});
