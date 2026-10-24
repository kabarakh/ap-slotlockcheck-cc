export type LockSource = 'detected' | 'admin';
export type UnlockTimeSource = 'sync' | 'estimated' | 'manual' | 'csv' | 'unknown';
export type LockStatus = 'not_locked' | 'locked' | 'partially_unlocked' | 'unlocked';

export interface SlotIdentity {
  position: number;
  name: string;
  aliases?: string[];
}

export interface ReceivedItem {
  itemName: string;
  senderPosition: number;
}

export interface LockOverride {
  lockerPosition: number;
  lockedPosition: number;
  notLocked: boolean;
}

export interface LockDetectionInput {
  slots: SlotIdentity[];
  slotLockPositions: number[];
  lockedSlotNamesByLocker: Map<number, string[]>;
  receivedItemsByLocker: Map<number, ReceivedItem[]>;
  overrides: LockOverride[];
}

export interface LockAssignmentResult {
  lockerPosition: number;
  lockedPosition: number;
  source: LockSource;
}

export interface FirstUnlockItem {
  lockerPosition: number;
  lockedPosition: number;
  senderPosition: number;
}

export interface LockDetectionResult {
  assignments: LockAssignmentResult[];
  firstUnlockItems: FirstUnlockItem[];
  unknownSlotNames: string[];
}

export interface StoredLock {
  lockerSlotId: number;
  lockedSlotId: number;
}

export interface StoredUnlock {
  lockerSlotId: number;
  lockedSlotId: number;
  senderSlotId: number | null;
  unlockTime: Date | null;
  timeSource: UnlockTimeSource;
}

export interface SlotLockState {
  slotId: number;
  status: LockStatus;
  locks: {
    lockerSlotId: number;
    unlocked: boolean;
    senderSlotId: number | null;
    unlockTime: Date | null;
    timeSource: UnlockTimeSource | null;
  }[];
  unlockTime: Date | null;
  unlockTimeSource: UnlockTimeSource | null;
}
