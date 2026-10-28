export type SortOrder = 1 | -1 | null;

export interface TableSort {
  field: string | null;
  order: SortOrder;
}

export interface SortCycle {
  first: string;
  second: string;
}

export function nextTableSort(previous: TableSort, requested: TableSort, cycles: SortCycle[]): TableSort {
  const cycle = cycles.find((candidate) => candidate.first === previous.field);
  if (cycle && previous.order === -1 && requested.field === null) {
    return { field: cycle.second, order: 1 };
  }
  return requested;
}

export function cycleSortField(sort: TableSort, cycle: SortCycle): string {
  return sort.field === cycle.second ? cycle.second : cycle.first;
}

export function activeCycleField(sort: TableSort, cycle: SortCycle): 'first' | 'second' | null {
  if (sort.field === cycle.first) {
    return 'first';
  }
  return sort.field === cycle.second ? 'second' : null;
}
