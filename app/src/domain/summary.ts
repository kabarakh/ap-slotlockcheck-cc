import type { SlotRow } from '@/api/types';

export interface PlayerSummary {
  key: string;
  name: string;
  discordUserId: string | null;
  slotCount: number;
  unlockedCount: number;
  goaledCount: number;
  lockedCount: number;
  warningCount: number;
}

export interface GlobalStatistics {
  slotCount: number;
  lockableCount: number;
  unlockedCount: number;
  unlockedPercentage: number;
  goaledCount: number;
  goaledPercentage: number;
  allChecksCount: number;
  allChecksPercentage: number;
  playersByLockedCount: { lockedCount: number; playerCount: number }[];
}

const GOALED_STATUSES = new Set(['goal', 'done', 'released']);

export function isGoaled(slot: SlotRow): boolean {
  return GOALED_STATUSES.has(slot.completionStatus);
}

export function isLocked(slot: SlotRow): boolean {
  return slot.lockStatus === 'locked' || slot.lockStatus === 'partially_unlocked';
}

export function hasAllChecks(slot: SlotRow): boolean {
  return slot.checksTotal > 0 && slot.checksDone >= slot.checksTotal;
}

function percentage(part: number, total: number): number {
  return total === 0 ? 0 : Math.round((part / total) * 1000) / 10;
}

export function playerKey(slot: SlotRow): string {
  return slot.discordUserId ?? `name:${slot.discordName ?? ''}`;
}

export function summarizePlayers(slots: SlotRow[]): PlayerSummary[] {
  const players = new Map<string, PlayerSummary>();
  for (const slot of slots.filter((candidate) => !candidate.isSlotLock)) {
    const key = playerKey(slot);
    const current = players.get(key) ?? {
      key,
      name: slot.discordName ?? '',
      discordUserId: slot.discordUserId,
      slotCount: 0,
      unlockedCount: 0,
      goaledCount: 0,
      lockedCount: 0,
      warningCount: 0,
    };
    current.slotCount += 1;
    current.unlockedCount += slot.lockStatus === 'unlocked' ? 1 : 0;
    current.goaledCount += isGoaled(slot) ? 1 : 0;
    current.lockedCount += isLocked(slot) ? 1 : 0;
    current.warningCount += slot.warningCount;
    players.set(key, current);
  }
  return [...players.values()].sort((a, b) => a.name.localeCompare(b.name));
}

export function calculateStatistics(slots: SlotRow[]): GlobalStatistics {
  const playable = slots.filter((slot) => !slot.isSlotLock);
  const lockable = playable.filter((slot) => slot.lockStatus !== 'not_locked');
  const unlockedCount = lockable.filter((slot) => slot.lockStatus === 'unlocked').length;
  const goaledCount = playable.filter(isGoaled).length;
  const allChecksCount = playable.filter(hasAllChecks).length;
  const playerCountByLocked = new Map<number, number>();
  for (const player of summarizePlayers(slots)) {
    playerCountByLocked.set(player.lockedCount, (playerCountByLocked.get(player.lockedCount) ?? 0) + 1);
  }
  return {
    slotCount: playable.length,
    lockableCount: lockable.length,
    unlockedCount,
    unlockedPercentage: percentage(unlockedCount, lockable.length),
    goaledCount,
    goaledPercentage: percentage(goaledCount, playable.length),
    allChecksCount,
    allChecksPercentage: percentage(allChecksCount, playable.length),
    playersByLockedCount: [...playerCountByLocked.entries()]
      .sort(([a], [b]) => a - b)
      .map(([lockedCount, playerCount]) => ({ lockedCount, playerCount })),
  };
}
