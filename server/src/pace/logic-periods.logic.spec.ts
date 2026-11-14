import { noLogicPeriods, type LogicLocation, type NoLogicInput } from './logic-periods.logic.js';

const base = new Date('2026-11-14T10:00:00Z');
const at = (minutes: number) => new Date(base.getTime() + minutes * 60_000);
const location = (sphere: number, checkedAt: number | null = null): LogicLocation => ({
  sphere,
  checkedAt: checkedAt === null ? null : at(checkedAt),
});

const input = (overrides: Partial<NoLogicInput>): NoLogicInput => ({
  ownLocations: [],
  progressionItems: [],
  unreachableSphere: 20,
  from: at(0),
  to: at(100),
  ...overrides,
});

describe('noLogicPeriods', () => {
  it('has no period while an own location up to the lowest open progression sphere is open', () => {
    expect(
      noLogicPeriods(input({ ownLocations: [location(1), location(3)], progressionItems: [location(2)] })),
    ).toEqual([]);
  });

  it('gives a period from the check of the last location in logic up to the check of the needed item', () => {
    expect(
      noLogicPeriods(
        input({
          ownLocations: [location(1, 20), location(3)],
          progressionItems: [location(2, 50)],
        }),
      ),
    ).toEqual([{ from: at(20), to: at(50) }]);
  });

  it('keeps a period open up to the end', () => {
    expect(
      noLogicPeriods(input({ ownLocations: [location(1, 30), location(3)], progressionItems: [location(2)] })),
    ).toEqual([{ from: at(30), to: at(100) }]);
  });

  it('starts a period at the start when nothing is in logic there', () => {
    expect(
      noLogicPeriods(input({ ownLocations: [location(1, -10), location(3)], progressionItems: [location(2, 40)] })),
    ).toEqual([{ from: at(0), to: at(40) }]);
  });

  it('always counts the lowest own sphere as in logic', () => {
    expect(
      noLogicPeriods(input({ ownLocations: [location(7), location(8)], progressionItems: [location(4)] })),
    ).toEqual([]);
    expect(
      noLogicPeriods(
        input({ ownLocations: [location(7, 10), location(8)], progressionItems: [location(4), location(6)] }),
      ),
    ).toEqual([{ from: at(10), to: at(100) }]);
  });

  it('counts all open own locations when no progression item for the slot is open', () => {
    expect(
      noLogicPeriods(input({ ownLocations: [location(1, 10), location(15)], progressionItems: [location(2, 5)] })),
    ).toEqual([]);
  });

  it('does not count locations that are not reachable', () => {
    expect(noLogicPeriods(input({ ownLocations: [location(1, 10), location(20)] }))).toEqual([
      { from: at(10), to: at(100) },
    ]);
  });

  it('has no period without own locations or without time', () => {
    expect(noLogicPeriods(input({ ownLocations: [location(20)] }))).toEqual([]);
    expect(noLogicPeriods(input({ ownLocations: [location(1, 10)], to: at(0) }))).toEqual([]);
  });

  it('takes all checks at the same time together', () => {
    expect(
      noLogicPeriods(
        input({
          ownLocations: [location(1, 20), location(2, 40), location(3)],
          progressionItems: [location(2, 40)],
        }),
      ),
    ).toEqual([]);
  });
});
