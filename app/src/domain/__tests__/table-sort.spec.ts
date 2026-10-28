import { describe, expect, it } from 'vitest';

import { activeCycleField, cycleSortField, nextTableSort, type SortCycle, type TableSort } from '../table-sort';

const sort = (field: string | null, order: TableSort['order']): TableSort => ({ field, order });
const unlock: SortCycle = { first: 'unlockSender', second: 'lastUnlockTime' };
const checks: SortCycle = { first: 'checksDone', second: 'checksPercentage' };
const cycles = [unlock, checks];

describe('nextTableSort', () => {
  it('cycles a column through both fields in both directions', () => {
    const firstAscending = nextTableSort(sort('position', 1), sort('checksDone', 1), cycles);
    expect(firstAscending).toEqual(sort('checksDone', 1));
    const firstDescending = nextTableSort(firstAscending, sort('checksDone', -1), cycles);
    expect(firstDescending).toEqual(sort('checksDone', -1));
    const secondAscending = nextTableSort(firstDescending, sort(null, null), cycles);
    expect(secondAscending).toEqual(sort('checksPercentage', 1));
    const secondDescending = nextTableSort(secondAscending, sort('checksPercentage', -1), cycles);
    expect(secondDescending).toEqual(sort('checksPercentage', -1));
    expect(nextTableSort(secondDescending, sort(null, null), cycles)).toEqual(sort(null, null));
  });

  it('switches to another column as requested', () => {
    expect(nextTableSort(sort('unlockSender', -1), sort('position', 1), cycles)).toEqual(sort('position', 1));
    expect(nextTableSort(sort('lastUnlockTime', -1), sort('checksDone', 1), cycles)).toEqual(sort('checksDone', 1));
  });

  it('removes the sort of other columns as requested', () => {
    expect(nextTableSort(sort('name', -1), sort(null, null), cycles)).toEqual(sort(null, null));
  });
});

describe('cycleSortField', () => {
  it('uses the second field only while the column is sorted by it', () => {
    expect(cycleSortField(sort('lastUnlockTime', 1), unlock)).toBe('lastUnlockTime');
    expect(cycleSortField(sort('unlockSender', 1), unlock)).toBe('unlockSender');
    expect(cycleSortField(sort('position', 1), unlock)).toBe('unlockSender');
  });
});

describe('activeCycleField', () => {
  it('tells which field of the column sorts the table', () => {
    expect(activeCycleField(sort('checksDone', -1), checks)).toBe('first');
    expect(activeCycleField(sort('checksPercentage', 1), checks)).toBe('second');
    expect(activeCycleField(sort(null, null), checks)).toBeNull();
  });
});
