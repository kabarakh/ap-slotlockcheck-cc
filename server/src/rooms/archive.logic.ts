import { isGoaled, type GoalFields } from '../locations/goal.logic.js';

export const ARCHIVE_REASONS = ['manual', 'auto'] as const;
export type ArchiveReason = (typeof ARCHIVE_REASONS)[number];

export interface ArchiveRoomFields {
  archivedAt: Date | null;
  autoArchive: boolean;
}

export function shouldAutoArchive(room: ArchiveRoomFields, slots: (GoalFields & { isSlotLock: boolean })[]): boolean {
  if (room.archivedAt !== null || !room.autoArchive) {
    return false;
  }
  const playable = slots.filter((slot) => !slot.isSlotLock);
  return playable.length > 0 && playable.every(isGoaled);
}

export function roomNow(room: Pick<ArchiveRoomFields, 'archivedAt'>, now: Date): Date {
  return room.archivedAt ?? now;
}
