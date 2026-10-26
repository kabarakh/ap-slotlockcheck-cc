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
  unlockedNames: string[];
  goaledNames: string[];
  lockedNames: string[];
}

export interface PlayerDistributionEntry {
  slotCount: number;
  playerCount: number;
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
  checksDone: number;
  checksTotal: number;
  checksPercentage: number;
  openChecksInLockedSlots: number;
  openChecksInOpenSlots: number;
  playersByLockedCount: { lockedCount: number; playerCount: number }[];
  playersByUnlockedCount: PlayerDistributionEntry[];
}

const GOALED_STATUSES = new Set(['goal', 'done', 'released']);

export function isGoaled(slot: SlotRow): boolean {
  return GOALED_STATUSES.has(slot.completionStatus) || slot.archipelagoGoal;
}

export function isLocked(slot: SlotRow): boolean {
  return slot.lockStatus === 'locked' || slot.lockStatus === 'partially_unlocked';
}

export function openChecks(slot: SlotRow): number {
  return Math.max(0, slot.checksTotal - slot.checksDone);
}

export function checksPercentage(done: number, total: number): number {
  return percentage(done, total);
}

export function hasAllChecks(slot: SlotRow): boolean {
  return slot.checksTotal > 0 && slot.checksDone >= slot.checksTotal;
}

function percentage(part: number, total: number): number {
  return total === 0 ? 0 : Math.round((part / total) * 1000) / 10;
}

function distribution(counts: number[]): PlayerDistributionEntry[] {
  const playersByCount = new Map<number, number>();
  for (const count of counts) {
    playersByCount.set(count, (playersByCount.get(count) ?? 0) + 1);
  }
  return [...playersByCount.entries()]
    .sort(([a], [b]) => a - b)
    .map(([slotCount, playerCount]) => ({ slotCount, playerCount }));
}

export function playerKey(slot: SlotRow): string {
  return slot.discordUserId ?? `name:${slot.discordName ?? ''}`;
}

export function summarizePlayers(
  slots: SlotRow[],
  warningCountBySlotId: ReadonlyMap<number, number> = new Map(),
): PlayerSummary[] {
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
      unlockedNames: [],
      goaledNames: [],
      lockedNames: [],
    };
    current.slotCount += 1;
    current.warningCount += warningCountBySlotId.get(slot.id) ?? 0;
    if (slot.lockStatus === 'unlocked') {
      current.unlockedCount += 1;
      current.unlockedNames.push(slot.name);
    }
    if (isGoaled(slot)) {
      current.goaledCount += 1;
      current.goaledNames.push(slot.name);
    }
    if (isLocked(slot)) {
      current.lockedCount += 1;
      current.lockedNames.push(slot.name);
    }
    players.set(key, current);
  }
  return [...players.values()].sort((a, b) => a.name.localeCompare(b.name));
}

export function calculateStatistics(slots: SlotRow[]): GlobalStatistics {
  const playable = slots.filter((slot) => !slot.isSlotLock);
  const lockable = playable.filter((slot) => slot.lockStatus !== 'not_locked' && slot.lockStatus !== 'start_slot');
  const unlockedCount = lockable.filter((slot) => slot.lockStatus === 'unlocked').length;
  const goaledCount = playable.filter(isGoaled).length;
  const allChecksCount = playable.filter(hasAllChecks).length;
  const checksDone = slots.reduce((sum, slot) => sum + slot.checksDone, 0);
  const checksTotal = slots.reduce((sum, slot) => sum + slot.checksTotal, 0);
  const players = summarizePlayers(slots);
  return {
    slotCount: playable.length,
    lockableCount: lockable.length,
    unlockedCount,
    unlockedPercentage: percentage(unlockedCount, lockable.length),
    goaledCount,
    goaledPercentage: percentage(goaledCount, playable.length),
    allChecksCount,
    allChecksPercentage: percentage(allChecksCount, playable.length),
    checksDone,
    checksTotal,
    checksPercentage: percentage(checksDone, checksTotal),
    openChecksInLockedSlots: playable.filter(isLocked).reduce((sum, slot) => sum + openChecks(slot), 0),
    openChecksInOpenSlots: playable.filter((slot) => !isLocked(slot)).reduce((sum, slot) => sum + openChecks(slot), 0),
    playersByLockedCount: distribution(players.map((player) => player.lockedCount)).map((entry) => ({
      lockedCount: entry.slotCount,
      playerCount: entry.playerCount,
    })),
    playersByUnlockedCount: distribution(players.map((player) => player.unlockedCount)),
  };
}
