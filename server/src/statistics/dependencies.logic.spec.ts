import {
  blockerRows,
  progressionFlow,
  sphereProgress,
  type DependencySlot,
  type SphereGroup,
} from './dependencies.logic.js';

const slot = (id: number, name: string, overrides: Partial<DependencySlot> = {}): DependencySlot => ({
  id,
  name,
  archipelagoName: null,
  isSelectedSlotLock: false,
  goaled: false,
  goalTime: null,
  ...overrides,
});

const slots = [
  slot(1, 'Locker', { isSelectedSlotLock: true }),
  slot(2, 'Alice'),
  slot(3, 'Bob (Bobby)', { archipelagoName: 'Bobby' }),
  slot(4, 'Carol', { goaled: true, goalTime: new Date('2026-11-02T10:00:00Z') }),
];

describe('blockerRows', () => {
  it('gives the open unlock items of the pairs that are not unlocked', () => {
    const rows = blockerRows(
      slots,
      [
        { lockerSlotId: 1, lockedSlotId: 2 },
        { lockerSlotId: 1, lockedSlotId: 3 },
      ],
      [{ lockerSlotId: 1, lockedSlotId: 2 }],
      [
        { finderSlotId: 4, receiverSlotId: 1, itemName: 'Unlock Alice', locationName: 'Chest', sphere: 1 },
        { finderSlotId: 2, receiverSlotId: 1, itemName: 'Unlock bobby', locationName: 'Boss', sphere: 3 },
        { finderSlotId: 2, receiverSlotId: 1, itemName: 'Unlock Bonus Slot 1', locationName: 'Shop', sphere: 2 },
      ],
    );
    expect(rows).toEqual([{ lockedSlotId: 3, lockerSlotId: 1, finderSlotId: 2, locationName: 'Boss', sphere: 3 }]);
  });
});

describe('progressionFlow', () => {
  it('sums the progression items of each finder and receiver', () => {
    expect(
      progressionFlow([
        { finderSlotId: 2, receiverSlotId: 3, checked: true, count: 4 },
        { finderSlotId: 2, receiverSlotId: 3, checked: false, count: 2 },
        { finderSlotId: 3, receiverSlotId: null, checked: false, count: 9 },
      ]),
    ).toEqual([{ finderSlotId: 2, receiverSlotId: 3, total: 6, open: 2 }]);
  });
});

describe('sphereProgress', () => {
  const group = (overrides: Partial<SphereGroup>): SphereGroup => ({
    sphere: 1,
    finderSlotId: 2,
    checked: true,
    fillerMarked: false,
    count: 1,
    latestCheckedAt: new Date('2026-11-01T10:00:00Z'),
    latestFillerMarkAt: null,
    ...overrides,
  });
  const uploadedAt = new Date('2026-11-01T08:00:00Z');

  it('gives the time of the last done location of each sphere', () => {
    expect(
      sphereProgress(
        [
          group({ sphere: 1, count: 2 }),
          group({
            sphere: 1,
            checked: false,
            fillerMarked: true,
            latestFillerMarkAt: new Date('2026-11-01T12:00:00Z'),
          }),
          group({ sphere: 2, checked: false, finderSlotId: 4 }),
          group({ sphere: 3, checked: false }),
          group({ sphere: 4, latestCheckedAt: null }),
        ],
        slots,
        uploadedAt,
      ),
    ).toEqual([
      { sphere: 1, locationCount: 3, doneAt: new Date('2026-11-01T12:00:00Z') },
      { sphere: 2, locationCount: 1, doneAt: new Date('2026-11-02T10:00:00Z') },
      { sphere: 3, locationCount: 1, doneAt: null },
      { sphere: 4, locationCount: 1, doneAt: uploadedAt },
    ]);
  });
});
