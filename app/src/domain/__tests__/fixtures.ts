import type { SlotRow } from '@/api/types';

export function slotRow(overrides: Partial<SlotRow>): SlotRow {
  return {
    id: 1,
    position: 1,
    name: 'Slot',
    archipelagoName: null,
    game: 'Game',
    discordUserId: null,
    discordName: null,
    checksDone: 0,
    checksTotal: 10,
    lastActivity: null,
    trackerStatus: 'playing',
    progressionStatus: 'unknown',
    completionStatus: 'incomplete',
    availabilityStatus: 'claimed',
    notes: '',
    isSlotLock: false,
    isSelectedSlotLock: false,
    lockStatus: 'not_locked',
    locks: [],
    unlockTime: null,
    unlockTimeSource: null,
    warningCount: 0,
    ...overrides,
  };
}
