import { isGoaled } from './summary';
import type { SortCycle } from './table-sort';
import type { SlotRow } from '@/api/types';

export const STATUS_SORT: SortCycle = { first: 'statusOrder', second: 'goalTimeOrder' };

const GOALED_RANK: Record<string, number> = { goal: 0, done: 1, released: 2 };
const PROGRESSION_RANK: Record<string, number> = { bk: 0, soft_bk: 1, go: 2, unblocked: 3, unknown: 4 };
const GROUP_SIZE = 10;

export function statusSortKey(slot: SlotRow): number {
  if (isGoaled(slot)) {
    return GOALED_RANK[slot.completionStatus] ?? 0;
  }
  const group = slot.completionStatus === 'all_checks' ? 1 : 2;
  return group * GROUP_SIZE + (PROGRESSION_RANK[slot.progressionStatus] ?? GROUP_SIZE - 1);
}

export function goalTimeSortKey(slot: SlotRow): string | null {
  return isGoaled(slot) && slot.goalTime ? new Date(slot.goalTime).toISOString() : null;
}
