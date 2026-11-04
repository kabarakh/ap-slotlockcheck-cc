import { CHART_SERIES_COLORS, type ChartPart, type ChartSeriesColor } from './charts';
import type { SlotRow } from '@/api/types';

export interface PlayerSummary {
  key: string;
  name: string;
  discordUserId: string | null;
  slotCount: number;
  locationCount: number;
  unlockedCount: number;
  goaledCount: number;
  lockedCount: number;
  unlocksSentCount: number;
  firstUnlockItemCount: number;
  laterUnlockItemCount: number;
  warningCount: number;
  unlockedNames: string[];
  goaledNames: string[];
  lockedNames: string[];
  unlocksSentNames: string[];
  laterUnlockNames: string[];
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

function addUnlocksSent(slots: SlotRow[], players: Map<string, PlayerSummary>): void {
  const senderSlotsById = new Map(slots.filter((slot) => !slot.isSlotLock).map((slot) => [slot.id, slot]));
  for (const slot of slots) {
    const senderKeys = new Set(
      slot.locks
        .filter((lock) => lock.unlocked && lock.senderSlotId !== null)
        .map((lock) => senderSlotsById.get(lock.senderSlotId as number))
        .filter((sender): sender is SlotRow => sender !== undefined)
        .map(playerKey),
    );
    for (const senderKey of senderKeys) {
      const sender = players.get(senderKey);
      if (sender) {
        sender.unlocksSentCount += 1;
        sender.unlocksSentNames.push(slot.name);
      }
    }
  }
}

function addFoundUnlockItems(slots: SlotRow[], players: Map<string, PlayerSummary>): void {
  const senderSlotsById = new Map(slots.filter((slot) => !slot.isSlotLock).map((slot) => [slot.id, slot]));
  const senderOf = (senderSlotId: number | null) => {
    const sender = senderSlotId === null ? undefined : senderSlotsById.get(senderSlotId);
    return sender ? players.get(playerKey(sender)) : undefined;
  };
  for (const slot of slots) {
    for (const lock of slot.locks) {
      const firstSender = lock.unlocked ? senderOf(lock.senderSlotId) : undefined;
      if (firstSender) {
        firstSender.firstUnlockItemCount += 1;
      }
      for (const laterUnlock of lock.laterUnlocks) {
        const laterSender = senderOf(laterUnlock.senderSlotId);
        if (!laterSender) {
          continue;
        }
        laterSender.laterUnlockItemCount += 1;
        if (!laterSender.laterUnlockNames.includes(slot.name)) {
          laterSender.laterUnlockNames.push(slot.name);
        }
      }
    }
  }
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
      locationCount: 0,
      unlockedCount: 0,
      goaledCount: 0,
      lockedCount: 0,
      unlocksSentCount: 0,
      firstUnlockItemCount: 0,
      laterUnlockItemCount: 0,
      warningCount: 0,
      unlockedNames: [],
      goaledNames: [],
      lockedNames: [],
      unlocksSentNames: [],
      laterUnlockNames: [],
    };
    current.slotCount += 1;
    current.locationCount += slot.checksTotal;
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
  addUnlocksSent(slots, players);
  addFoundUnlockItems(slots, players);
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

export interface UnlocksSentShare extends ChartPart {
  percentage: number;
}

export const OTHER_PLAYERS_KEY = 'other-players';

export function unlocksSentShares(players: PlayerSummary[], otherLabel: string): UnlocksSentShare[] {
  const senders = players
    .filter((player) => player.unlocksSentCount > 0)
    .sort((a, b) => b.unlocksSentCount - a.unlocksSentCount || a.name.localeCompare(b.name));
  const total = senders.reduce((sum, player) => sum + player.unlocksSentCount, 0);
  const needsOtherPart = senders.length > CHART_SERIES_COLORS.length;
  const namedCount = needsOtherPart ? CHART_SERIES_COLORS.length - 1 : senders.length;
  const share = (key: string, label: string, value: number, color: ChartSeriesColor | 'rest'): UnlocksSentShare => ({
    key,
    label,
    value,
    color,
    percentage: percentage(value, total),
  });
  const shares = senders
    .slice(0, namedCount)
    .map((player, index) =>
      share(player.key, player.name, player.unlocksSentCount, CHART_SERIES_COLORS[index] as ChartSeriesColor),
    );
  if (needsOtherPart) {
    const otherValue = senders.slice(namedCount).reduce((sum, player) => sum + player.unlocksSentCount, 0);
    shares.push(share(OTHER_PLAYERS_KEY, otherLabel, otherValue, 'rest'));
  }
  return shares;
}

export interface UnlocksSentExpectation {
  share: number;
  expected: number;
  deviation: number;
}

export interface UnlocksSentBalance {
  key: string;
  name: string;
  unlocksSentCount: number;
  foundUnlockItemCount: number;
  laterUnlockItemCount: number;
  laterUnlockNames: string[];
  bySlots: UnlocksSentExpectation;
  byLocations: UnlocksSentExpectation;
  bySlotsWithLater: UnlocksSentExpectation;
  byLocationsWithLater: UnlocksSentExpectation;
}

function roundToTenth(value: number): number {
  return Math.round(value * 10) / 10;
}

export function expectation(part: number, total: number, unlocksTotal: number, actual: number): UnlocksSentExpectation {
  const expected = total === 0 ? 0 : (part / total) * unlocksTotal;
  return {
    share: percentage(part, total),
    expected: roundToTenth(expected),
    deviation: roundToTenth(actual - expected),
  };
}

export function foundUnlockItemCount(player: PlayerSummary): number {
  return player.firstUnlockItemCount + player.laterUnlockItemCount;
}

export function unlocksSentBalance(players: PlayerSummary[]): UnlocksSentBalance[] {
  const sum = (value: (player: PlayerSummary) => number) => players.reduce((total, player) => total + value(player), 0);
  const unlocksTotal = sum((player) => player.unlocksSentCount);
  const foundTotal = sum(foundUnlockItemCount);
  const slotTotal = sum((player) => player.slotCount);
  const locationTotal = sum((player) => player.locationCount);
  return players
    .map((player) => ({
      key: player.key,
      name: player.name,
      unlocksSentCount: player.unlocksSentCount,
      foundUnlockItemCount: foundUnlockItemCount(player),
      laterUnlockItemCount: player.laterUnlockItemCount,
      laterUnlockNames: player.laterUnlockNames,
      bySlots: expectation(player.slotCount, slotTotal, unlocksTotal, player.unlocksSentCount),
      byLocations: expectation(player.locationCount, locationTotal, unlocksTotal, player.unlocksSentCount),
      bySlotsWithLater: expectation(player.slotCount, slotTotal, foundTotal, foundUnlockItemCount(player)),
      byLocationsWithLater: expectation(player.locationCount, locationTotal, foundTotal, foundUnlockItemCount(player)),
    }))
    .sort((a, b) => b.byLocations.deviation - a.byLocations.deviation || a.name.localeCompare(b.name));
}
