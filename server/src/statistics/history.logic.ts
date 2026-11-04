import type { ChecksHistoryPoint } from '../lock/unlock-time.logic.js';
import { historySteps } from '../pace/pace.logic.js';
import { slotHistory } from '../pace/pace.mapper.js';

export const HISTORY_BUCKET_MINUTES = 60;
export const RATE_WINDOW_HOURS = 24;

const MS_PER_MINUTE = 60_000;
const BUCKET_MS = HISTORY_BUCKET_MINUTES * MS_PER_MINUTE;
const RATE_WINDOW_MS = RATE_WINDOW_HOURS * 60 * MS_PER_MINUTE;

export interface HistorySlot {
  id: number;
  cheeseGameId: number;
  discordUserId: string | null;
  discordName: string | null;
}

export interface HistoryInput {
  history: ChecksHistoryPoint[];
  slots: HistorySlot[];
  bulkLimitChecks: number;
  now: Date;
}

export interface HistoryBucket {
  time: Date;
  checks: number;
  newChecks: number;
  activeSlots: number;
  activePlayers: number;
}

export interface SlotHistoryValues {
  slotId: number;
  firstCheckTime: Date | null;
  recentChecks: number;
}

export interface RoomHistory {
  historyFrom: Date | null;
  startedAt: Date | null;
  buckets: HistoryBucket[];
  slots: SlotHistoryValues[];
}

interface BucketDraft {
  newChecks: number;
  activeSlots: Set<number>;
  activePlayers: Set<string>;
}

const bucketStart = (time: Date): number => Math.floor(time.getTime() / BUCKET_MS) * BUCKET_MS;

function playerKey(slot: HistorySlot): string {
  return slot.discordUserId ?? `name:${slot.discordName ?? `slot:${slot.id}`}`;
}

export function roomHistory(input: HistoryInput): RoomHistory {
  const drafts = new Map<number, BucketDraft>();
  const draft = (start: number): BucketDraft => {
    const existing = drafts.get(start);
    if (existing) {
      return existing;
    }
    const created = { newChecks: 0, activeSlots: new Set<number>(), activePlayers: new Set<string>() };
    drafts.set(start, created);
    return created;
  };
  const rateFrom = input.now.getTime() - RATE_WINDOW_MS;
  let initialChecks = 0;
  let historyFrom: Date | null = null;
  let startedAt: Date | null = null;
  const slots: SlotHistoryValues[] = [];

  for (const slot of input.slots) {
    const points = slotHistory(input.history, slot.cheeseGameId).sort((a, b) => a.time.getTime() - b.time.getTime());
    const first = points[0];
    if (first === undefined) {
      slots.push({ slotId: slot.id, firstCheckTime: null, recentChecks: 0 });
      continue;
    }
    initialChecks += first.checks;
    if (historyFrom === null || first.time < historyFrom) {
      historyFrom = first.time;
    }
    let firstCheckTime: Date | null = null;
    let recentChecks = 0;
    for (const step of historySteps(points, input.now)) {
      if (step.checks === 0) {
        continue;
      }
      if (first.checks === 0 && firstCheckTime === null) {
        firstCheckTime = step.to;
      }
      const bucket = draft(bucketStart(step.from));
      bucket.newChecks += step.checks;
      if (step.checks > input.bulkLimitChecks) {
        continue;
      }
      bucket.activeSlots.add(slot.id);
      bucket.activePlayers.add(playerKey(slot));
      if (step.to.getTime() > rateFrom) {
        recentChecks += step.checks;
      }
    }
    const slotStart = first.checks > 0 ? first.time : firstCheckTime;
    if (slotStart !== null && (startedAt === null || slotStart < startedAt)) {
      startedAt = slotStart;
    }
    slots.push({ slotId: slot.id, firstCheckTime, recentChecks });
  }

  const buckets: HistoryBucket[] = [];
  if (historyFrom !== null) {
    let checks = initialChecks;
    for (let start = bucketStart(historyFrom); start <= input.now.getTime(); start += BUCKET_MS) {
      const current = drafts.get(start);
      checks += current?.newChecks ?? 0;
      buckets.push({
        time: new Date(start),
        checks,
        newChecks: current?.newChecks ?? 0,
        activeSlots: current?.activeSlots.size ?? 0,
        activePlayers: current?.activePlayers.size ?? 0,
      });
    }
  }
  return { historyFrom, startedAt, buckets, slots };
}
