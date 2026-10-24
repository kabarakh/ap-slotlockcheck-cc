import { evaluateSlotLockStates } from '../lock/lock.logic.js';
import type { StoredLock, StoredUnlock, UnlockTimeSource } from '../lock/lock.types.js';
import type {
  AvailabilityStatus,
  CompletionStatus,
  ProgressionStatus,
  TrackerStatus,
} from '../sources/cheese/cheese.schemas.js';
import type { SlotRowDto } from './dto/slot-row.dto.js';

export interface RosterSlot {
  id: number;
  position: number;
  name: string;
  archipelagoName: string | null;
  game: string;
  discordUserId: string | null;
  discordName: string | null;
  checksDone: number;
  checksTotal: number;
  lastActivity: Date | null;
  lastChecked: Date | null;
  trackerStatus: string;
  progressionStatus: string;
  completionStatus: string;
  availabilityStatus: string;
  notes: string;
  isSlotLock: boolean;
  isSelectedSlotLock: boolean;
  isStartSlot: boolean;
}

export interface RosterInput {
  slots: RosterSlot[];
  locks: StoredLock[];
  unlocks: (Omit<StoredUnlock, 'timeSource'> & { timeSource: string })[];
  warningCountBySlotId: Map<number, number>;
}

const toIso = (date: Date | null): string | null => date?.toISOString() ?? null;

export function buildRoster(input: RosterInput): SlotRowDto[] {
  const slotsById = new Map(input.slots.map((slot) => [slot.id, slot]));
  const unlocks = input.unlocks.map((unlock) => ({ ...unlock, timeSource: unlock.timeSource as UnlockTimeSource }));
  const states = evaluateSlotLockStates(
    input.slots.map((slot) => slot.id),
    input.locks,
    unlocks,
    new Set(input.slots.filter((slot) => slot.isStartSlot).map((slot) => slot.id)),
  );

  return [...input.slots]
    .sort((a, b) => a.position - b.position)
    .map((slot) => {
      const state = states.get(slot.id);
      return {
        id: slot.id,
        position: slot.position,
        name: slot.name,
        archipelagoName: slot.archipelagoName,
        game: slot.game,
        discordUserId: slot.discordUserId,
        discordName: slot.discordName,
        checksDone: slot.checksDone,
        checksTotal: slot.checksTotal,
        lastActivity: toIso(slot.lastActivity),
        lastChecked: toIso(slot.lastChecked),
        trackerStatus: slot.trackerStatus as TrackerStatus,
        progressionStatus: slot.progressionStatus as ProgressionStatus,
        completionStatus: slot.completionStatus as CompletionStatus,
        availabilityStatus: slot.availabilityStatus as AvailabilityStatus,
        notes: slot.notes,
        isSlotLock: slot.isSlotLock,
        isSelectedSlotLock: slot.isSelectedSlotLock,
        lockStatus: state?.status ?? 'not_locked',
        locks: (state?.locks ?? []).map((lock) => ({
          lockerSlotId: lock.lockerSlotId,
          lockerName: slotsById.get(lock.lockerSlotId)?.name ?? '',
          unlocked: lock.unlocked,
          senderSlotId: lock.senderSlotId,
          senderName: lock.senderSlotId === null ? null : (slotsById.get(lock.senderSlotId)?.name ?? null),
          unlockTime: toIso(lock.unlockTime),
          timeSource: lock.timeSource,
        })),
        unlockTime: toIso(state?.unlockTime ?? null),
        unlockTimeSource: state?.unlockTimeSource ?? null,
        warningCount: input.warningCountBySlotId.get(slot.id) ?? 0,
      };
    });
}

export function countLockStates(rows: SlotRowDto[]): { locked: number; unlocked: number; percentage: number } {
  const locked = rows.filter((row) => row.lockStatus !== 'not_locked' && row.lockStatus !== 'start_slot').length;
  const unlocked = rows.filter((row) => row.lockStatus === 'unlocked').length;
  return { locked, unlocked, percentage: locked === 0 ? 0 : Math.round((unlocked / locked) * 1000) / 10 };
}
