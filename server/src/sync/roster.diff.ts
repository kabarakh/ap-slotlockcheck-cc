import type { SlotRowDto } from '../rooms/dto/slot-row.dto.js';

export interface RosterDiff {
  changedSlots: SlotRowDto[];
  removedSlotIds: number[];
}

export function diffRoster(before: SlotRowDto[], after: SlotRowDto[]): RosterDiff {
  const beforeById = new Map(before.map((row) => [row.id, JSON.stringify(row)]));
  const afterIds = new Set(after.map((row) => row.id));
  return {
    changedSlots: after.filter((row) => beforeById.get(row.id) !== JSON.stringify(row)),
    removedSlotIds: before.filter((row) => !afterIds.has(row.id)).map((row) => row.id),
  };
}
