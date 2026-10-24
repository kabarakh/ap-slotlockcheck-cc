import { detectLocks, detectStartSlots, evaluateSlotLockStates } from '../lock/lock.logic.js';
import type { SlotLockState } from '../lock/lock.types.js';
import {
  archipelagoNamesByPosition,
  lockedSlotNamesByPosition,
  slotIdentity,
  receivedItemsByPosition,
  slotRecordsFromCheese,
  type SlotRecord,
} from '../sync/room-source.mapper.js';
import type { RoomSource } from '../sync/room-source.service.js';

export interface PrototypeReport {
  roster: string[][];
  players: string[][];
  unknownSlotNames: string[];
}

const GOALED_STATUSES = new Set(['goal', 'done', 'released']);

export function buildPrototypeReport(source: RoomSource, slotLockPositions?: number[]): PrototypeReport {
  const slots = slotRecordsFromCheese(source.cheese, archipelagoNamesByPosition(source.roomStatus, source.tracker));
  const lockers = slotLockPositions ?? slots.filter((slot) => slot.isSlotLock).map((slot) => slot.position);
  const lockedSlotNamesByLocker = lockedSlotNamesByPosition(source.slotData, lockers);
  const detection = detectLocks({
    slots: slots.map(slotIdentity),
    slotLockPositions: lockers,
    lockedSlotNamesByLocker,
    receivedItemsByLocker: receivedItemsByPosition(source.tracker, lockers, source.slotLockItemNames),
    overrides: [],
  });
  const states = evaluateSlotLockStates(
    slots.map((slot) => slot.position),
    detection.assignments.map((lock) => ({ lockerSlotId: lock.lockerPosition, lockedSlotId: lock.lockedPosition })),
    detection.firstUnlockItems.map((unlock) => ({
      lockerSlotId: unlock.lockerPosition,
      lockedSlotId: unlock.lockedPosition,
      senderSlotId: unlock.senderPosition,
      unlockTime: null,
      timeSource: 'unknown',
    })),
    new Set(
      detectStartSlots(
        slots.map((slot) => ({ ...slotIdentity(slot), isSlotLock: slot.isSlotLock })),
        lockedSlotNamesByLocker,
        detection.assignments,
      ),
    ),
  );
  const nameByPosition = new Map(slots.map((slot) => [slot.position, slot.name]));
  return {
    roster: rosterRows(slots, states, nameByPosition),
    players: playerRows(slots, states),
    unknownSlotNames: detection.unknownSlotNames,
  };
}

function rosterRows(slots: SlotRecord[], states: Map<number, SlotLockState>, names: Map<number, string>): string[][] {
  return [
    ['#', 'Slot', 'Discord', 'Game', 'Lock status', 'Unlocked by', 'Completion'],
    ...slots.map((slot) => {
      const state = states.get(slot.position);
      const unlockedBy = (state?.locks ?? [])
        .filter((lock) => lock.unlocked)
        .map((lock) => `${names.get(lock.senderSlotId ?? -1) ?? '?'} (${names.get(lock.lockerSlotId) ?? '?'})`)
        .join(', ');
      return [
        String(slot.position),
        slot.name,
        slot.discordName ?? '',
        slot.game,
        state?.status ?? 'not_locked',
        unlockedBy,
        slot.completionStatus,
      ];
    }),
  ];
}

function playerRows(slots: SlotRecord[], states: Map<number, SlotLockState>): string[][] {
  const players = new Map<string, SlotRecord[]>();
  for (const slot of slots.filter((candidate) => !candidate.isSlotLock)) {
    const key = slot.discordName ?? '(unclaimed)';
    players.set(key, [...(players.get(key) ?? []), slot]);
  }
  return [
    ['Player', 'Slots', 'Unlocked', 'Goaled', 'Locked'],
    ...[...players.entries()]
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([player, playerSlots]) => {
        const status = (slot: SlotRecord) => states.get(slot.position)?.status;
        return [
          player,
          String(playerSlots.length),
          String(playerSlots.filter((slot) => status(slot) === 'unlocked').length),
          String(playerSlots.filter((slot) => GOALED_STATUSES.has(slot.completionStatus)).length),
          String(
            playerSlots.filter((slot) => status(slot) === 'locked' || status(slot) === 'partially_unlocked').length,
          ),
        ];
      }),
  ];
}

export function formatTable(rows: string[][]): string {
  const widths = rows[0]?.map((_, column) => Math.max(...rows.map((row) => (row[column] ?? '').length))) ?? [];
  return rows.map((row) => row.map((cell, column) => cell.padEnd(widths[column] ?? 0)).join('  ')).join('\n');
}
