import { minutesBetween, timeOf, type TimePoint } from './statistics-time';
import { expectation, isGoaled, isLocked, playerKey, type UnlocksSentExpectation } from './summary';
import type { UnlockForest, UnlockTreeNode } from './unlock-tree';
import type { SlotRow, UnlockTimeSource } from '@/api/types';

const KNOWN_SOURCES = new Set<UnlockTimeSource>(['sync', 'manual', 'csv']);

export interface UnlockCurve {
  points: TimePoint[];
  lockableCount: number;
  withoutTimeCount: number;
}

export interface SlotDuration {
  slotId: number;
  name: string;
  discordName: string | null;
  minutes: number;
  estimated: boolean;
}

export interface WaitTimes {
  unlocked: SlotDuration[];
  stillLocked: SlotDuration[];
}

export interface LeadTime {
  slotId: number;
  name: string;
  firstSenderName: string | null;
  laterSenderName: string | null;
  minutes: number;
}

export interface LeadTimes {
  rows: LeadTime[];
  unlockedPairCount: number;
  pairsWithLaterItems: number;
}

export interface MatrixPlayer {
  key: string;
  name: string;
}

export interface UnlockMatrix {
  senders: MatrixPlayer[];
  receivers: MatrixPlayer[];
  values: number[][];
  selfUnlocks: number;
  mutualPairs: [string, string][];
}

export interface GameBalance {
  game: string;
  slotCount: number;
  locationCount: number;
  unlocksSentCount: number;
  byLocations: UnlocksSentExpectation;
}

export interface TreeSubtree {
  id: number;
  name: string;
  discordName: string | null;
  descendants: number;
}

export interface TreeMetrics {
  maxDepth: number;
  longestChain: string[];
  depthDistribution: { depth: number; slotCount: number }[];
  largestSubtrees: TreeSubtree[];
}

const isUnlockedWithTime = (slot: SlotRow): boolean =>
  slot.lockStatus === 'unlocked' && slot.unlockTime !== null && slot.unlockTimeSource !== 'unknown';

const playable = (slots: SlotRow[]): SlotRow[] => slots.filter((slot) => !slot.isSlotLock);

const lockable = (slot: SlotRow): boolean => slot.lockStatus !== 'not_locked' && slot.lockStatus !== 'start_slot';

export function unlockCurve(slots: SlotRow[]): UnlockCurve {
  const candidates = playable(slots).filter(lockable);
  const times = candidates
    .filter(isUnlockedWithTime)
    .map((slot) => timeOf(slot.unlockTime) as number)
    .sort((a, b) => a - b);
  return {
    points: times.map((time, index) => ({ time, value: index + 1 })),
    lockableCount: candidates.length,
    withoutTimeCount: candidates.filter((slot) => slot.lockStatus === 'unlocked' && !isUnlockedWithTime(slot)).length,
  };
}

const duration = (slot: SlotRow, minutes: number): SlotDuration => ({
  slotId: slot.id,
  name: slot.name,
  discordName: slot.discordName,
  minutes,
  estimated: slot.unlockTimeSource === 'estimated',
});

const byMinutesDescending = (a: SlotDuration, b: SlotDuration) => b.minutes - a.minutes || a.name.localeCompare(b.name);

export function waitTimes(slots: SlotRow[], start: number, now: number): WaitTimes {
  const candidates = playable(slots).filter(lockable);
  return {
    unlocked: candidates
      .filter(isUnlockedWithTime)
      .map((slot) => duration(slot, minutesBetween(start, timeOf(slot.unlockTime) as number)))
      .sort(byMinutesDescending),
    stillLocked: candidates
      .filter(isLocked)
      .map((slot) => duration(slot, minutesBetween(start, now)))
      .sort(byMinutesDescending),
  };
}

export function reactionTimes(
  slots: SlotRow[],
  firstCheckBySlotId: ReadonlyMap<number, string | null>,
): SlotDuration[] {
  return playable(slots)
    .filter(
      (slot) =>
        slot.lockStatus === 'unlocked' &&
        slot.unlockTimeSource !== null &&
        KNOWN_SOURCES.has(slot.unlockTimeSource) &&
        slot.unlockTime !== null,
    )
    .flatMap((slot) => {
      const firstCheck = timeOf(firstCheckBySlotId.get(slot.id) ?? null);
      return firstCheck === null ? [] : [duration(slot, minutesBetween(timeOf(slot.unlockTime) as number, firstCheck))];
    })
    .sort(byMinutesDescending);
}

export function unlockedWithoutChecks(slots: SlotRow[], now: number): SlotDuration[] {
  return playable(slots)
    .filter((slot) => slot.lockStatus === 'unlocked' && slot.checksDone === 0 && !isGoaled(slot))
    .map((slot) => {
      const unlockTime = timeOf(slot.unlockTimeSource === 'unknown' ? null : slot.unlockTime);
      return duration(slot, unlockTime === null ? 0 : minutesBetween(unlockTime, now));
    })
    .sort(byMinutesDescending);
}

export function leadTimes(slots: SlotRow[]): LeadTimes {
  const slotsById = new Map(slots.map((slot) => [slot.id, slot]));
  const nameOf = (slotId: number | null) => (slotId === null ? null : (slotsById.get(slotId)?.name ?? null));
  const rows: LeadTime[] = [];
  let unlockedPairCount = 0;
  let pairsWithLaterItems = 0;
  for (const slot of playable(slots)) {
    for (const lock of slot.locks.filter((candidate) => candidate.unlocked)) {
      unlockedPairCount += 1;
      const later = lock.laterUnlocks[0];
      if (later === undefined) {
        continue;
      }
      pairsWithLaterItems += 1;
      const firstTime = lock.timeSource !== null && KNOWN_SOURCES.has(lock.timeSource) ? timeOf(lock.unlockTime) : null;
      const laterTime = timeOf(later.firstSeenAt);
      if (firstTime === null || laterTime === null) {
        continue;
      }
      rows.push({
        slotId: slot.id,
        name: slot.name,
        firstSenderName: nameOf(lock.senderSlotId),
        laterSenderName: nameOf(later.senderSlotId),
        minutes: minutesBetween(firstTime, laterTime),
      });
    }
  }
  return {
    rows: rows.sort((a, b) => b.minutes - a.minutes || a.name.localeCompare(b.name)),
    unlockedPairCount,
    pairsWithLaterItems,
  };
}

export function unlockMatrix(slots: SlotRow[]): UnlockMatrix {
  const players = new Map<string, string>();
  const slotsById = new Map(playable(slots).map((slot) => [slot.id, slot]));
  const counts = new Map<string, Map<string, number>>();
  for (const slot of playable(slots)) {
    players.set(playerKey(slot), slot.discordName ?? '');
    for (const lock of slot.locks) {
      const sender = lock.unlocked && lock.senderSlotId !== null ? slotsById.get(lock.senderSlotId) : undefined;
      if (sender === undefined) {
        continue;
      }
      const row = counts.get(playerKey(sender)) ?? new Map<string, number>();
      row.set(playerKey(slot), (row.get(playerKey(slot)) ?? 0) + 1);
      counts.set(playerKey(sender), row);
    }
  }
  const count = (sender: string, receiver: string) => counts.get(sender)?.get(receiver) ?? 0;
  const player = (key: string): MatrixPlayer => ({ key, name: players.get(key) ?? '' });
  const byName = (a: MatrixPlayer, b: MatrixPlayer) => a.name.localeCompare(b.name);
  const senders = [...counts.keys()].map(player).sort(byName);
  const receiverKeys = new Set([...counts.values()].flatMap((row) => [...row.keys()]));
  const receivers = [...receiverKeys].map(player).sort(byName);
  const mutualPairs: [string, string][] = [];
  for (const [index, a] of senders.entries()) {
    for (const b of senders.slice(index + 1)) {
      if (count(a.key, b.key) > 0 && count(b.key, a.key) > 0) {
        mutualPairs.push([a.name, b.name]);
      }
    }
  }
  return {
    senders,
    receivers,
    values: senders.map((sender) => receivers.map((receiver) => count(sender.key, receiver.key))),
    selfUnlocks: [...players.keys()].reduce((sum, key) => sum + count(key, key), 0),
    mutualPairs,
  };
}

export function gameBalance(slots: SlotRow[]): GameBalance[] {
  const games = new Map<string, Omit<GameBalance, 'byLocations'>>();
  const slotsById = new Map(playable(slots).map((slot) => [slot.id, slot]));
  const gameOf = (game: string) => {
    const current = games.get(game) ?? { game, slotCount: 0, locationCount: 0, unlocksSentCount: 0 };
    games.set(game, current);
    return current;
  };
  for (const slot of playable(slots)) {
    const entry = gameOf(slot.game);
    entry.slotCount += 1;
    entry.locationCount += slot.checksTotal;
  }
  for (const slot of playable(slots)) {
    for (const lock of slot.locks) {
      const sender = lock.unlocked && lock.senderSlotId !== null ? slotsById.get(lock.senderSlotId) : undefined;
      if (sender !== undefined) {
        gameOf(sender.game).unlocksSentCount += 1;
      }
    }
  }
  const entries = [...games.values()];
  const locationTotal = entries.reduce((sum, entry) => sum + entry.locationCount, 0);
  const unlocksTotal = entries.reduce((sum, entry) => sum + entry.unlocksSentCount, 0);
  return entries
    .map((entry) => ({
      ...entry,
      byLocations: expectation(entry.locationCount, locationTotal, unlocksTotal, entry.unlocksSentCount),
    }))
    .sort((a, b) => b.byLocations.deviation - a.byLocations.deviation || a.game.localeCompare(b.game));
}

const LARGEST_SUBTREE_COUNT = 10;

export function treeMetrics(forest: UnlockForest): TreeMetrics {
  const depthCounts = new Map<number, number>();
  const subtrees: TreeSubtree[] = [];
  let longestChain: string[] = [];

  const visit = (node: UnlockTreeNode, depth: number, chain: string[]): number => {
    const path = node.kind === 'slotlock' ? chain : [...chain, node.name];
    if (node.kind !== 'slotlock') {
      depthCounts.set(depth, (depthCounts.get(depth) ?? 0) + 1);
      if (path.length > longestChain.length) {
        longestChain = path;
      }
    }
    const descendants = node.children.reduce((sum, child) => sum + 1 + visit(child, depth + 1, path), 0);
    if (node.kind !== 'slotlock') {
      subtrees.push({ id: node.id, name: node.name, discordName: node.discordName, descendants });
    }
    return descendants;
  };
  for (const root of forest.roots) {
    visit(root, root.kind === 'slotlock' ? 0 : 1, []);
  }
  const depthDistribution = [...depthCounts.entries()]
    .sort(([a], [b]) => a - b)
    .map(([depth, slotCount]) => ({ depth, slotCount }));
  return {
    maxDepth: depthDistribution[depthDistribution.length - 1]?.depth ?? 0,
    longestChain,
    depthDistribution,
    largestSubtrees: subtrees
      .filter((subtree) => subtree.descendants > 0)
      .sort((a, b) => b.descendants - a.descendants || a.name.localeCompare(b.name))
      .slice(0, LARGEST_SUBTREE_COUNT),
  };
}
