import type { SlotRow } from '@/api/types';

export type InactivityLevel = 'none' | 'yellow' | 'red';

export interface InactivityLimits {
  yellowLimitHours: number;
  redLimitHours: number;
}

const HOUR_MS = 60 * 60 * 1000;

export function inactivityHours(slot: SlotRow, now: Date): number | null {
  if (slot.lockStatus !== 'unlocked' && slot.lockStatus !== 'start_slot') {
    return null;
  }
  const times = [slot.lastActivity, slot.lastChecked, slot.unlockTime]
    .filter((value): value is string => value !== null)
    .map((value) => new Date(value).getTime());
  if (times.length === 0) {
    return null;
  }
  return Math.max(0, (now.getTime() - Math.max(...times)) / HOUR_MS);
}

export function inactivityLevel(hours: number | null, limits: InactivityLimits): InactivityLevel {
  if (hours === null) {
    return 'none';
  }
  if (hours > limits.redLimitHours) {
    return 'red';
  }
  if (hours > limits.yellowLimitHours) {
    return 'yellow';
  }
  return 'none';
}
