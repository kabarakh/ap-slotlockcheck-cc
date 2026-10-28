import { Injectable } from '@nestjs/common';

import { detectLocks, evaluateSlotLockStates } from './lock.logic.js';
import type { LockDetectionInput, LockDetectionResult, SlotLockState, StoredLock, StoredUnlock } from './lock.types.js';
import type { UnlockTimeSource } from './lock.types.js';
import { canReplaceUnlockTime, estimateUnlockTime, type ChecksHistoryPoint } from './unlock-time.logic.js';

@Injectable()
export class LockService {
  detect(input: LockDetectionInput): LockDetectionResult {
    return detectLocks(input);
  }

  evaluate(slotIds: number[], locks: StoredLock[], unlocks: StoredUnlock[]): Map<number, SlotLockState> {
    return evaluateSlotLockStates(slotIds, locks, unlocks);
  }

  estimateUnlockTime(history: ChecksHistoryPoint[], slotKey: string): Date | undefined {
    return estimateUnlockTime(history, slotKey);
  }

  canReplaceUnlockTime(current: UnlockTimeSource, candidate: UnlockTimeSource): boolean {
    return canReplaceUnlockTime(current, candidate);
  }
}
