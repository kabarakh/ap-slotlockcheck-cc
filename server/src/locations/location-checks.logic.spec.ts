import { isGoaled } from './goal.logic.js';
import { newlyCheckedLocationIds } from './location-checks.logic.js';

describe('newlyCheckedLocationIds', () => {
  const unchecked = [
    { id: 1, finderPosition: 2, locationId: 1n },
    { id: 2, finderPosition: 2, locationId: 2n },
    { id: 3, finderPosition: 3, locationId: 1n },
    { id: 4, finderPosition: 3, locationId: 3000000101n },
  ];

  it('finds the locations that Archipelago reports as checked', () => {
    expect(
      newlyCheckedLocationIds(unchecked, [
        { player: 2, locations: [1, 99] },
        { player: 3, locations: [3000000101] },
      ]),
    ).toEqual([1, 4]);
  });

  it('compares the location ID only within the same player', () => {
    expect(newlyCheckedLocationIds(unchecked, [{ player: 4, locations: [1, 2] }])).toEqual([]);
  });

  it('merges more entries of the same player', () => {
    expect(
      newlyCheckedLocationIds(unchecked, [
        { player: 2, locations: [1] },
        { player: 2, locations: [2] },
      ]),
    ).toEqual([1, 2]);
  });
});

describe('isGoaled', () => {
  it.each([
    ['incomplete', false, false],
    ['all_checks', false, false],
    ['goal', false, true],
    ['done', false, true],
    ['released', false, true],
    ['incomplete', true, true],
  ])('gives the goal for %s and Archipelago goal %s', (completionStatus, archipelagoGoal, expected) => {
    expect(isGoaled({ completionStatus, archipelagoGoal })).toBe(expected);
  });
});
