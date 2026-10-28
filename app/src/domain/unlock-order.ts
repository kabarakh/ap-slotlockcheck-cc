import type { SlotRow } from '@/api/types';
import type { SortCycle } from './table-sort';

export const UNLOCK_SORT: SortCycle = { first: 'unlockSender', second: 'lastUnlockTime' };

export function unlockSenderKey(slot: SlotRow): string | null {
  const senders = slot.locks
    .filter((lock) => lock.unlocked && lock.senderName !== null)
    .map((lock) => lock.senderName as string)
    .sort((a, b) => a.localeCompare(b));
  return senders.length > 0 ? senders.join(', ') : null;
}

export function lastUnlockTimeKey(slot: SlotRow): string | null {
  const times = slot.locks
    .filter((lock) => lock.unlocked && lock.unlockTime !== null)
    .map((lock) => new Date(lock.unlockTime as string).toISOString())
    .sort();
  return times[times.length - 1] ?? null;
}
