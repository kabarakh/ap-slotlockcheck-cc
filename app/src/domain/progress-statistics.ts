import { minutesBetween, timeOf, type TimePoint } from './statistics-time';
import { isGoaled, isLocked, openChecks } from './summary';
import type { RoomHistory, SlotRow } from '@/api/types';

const MS_PER_HOUR = 3_600_000;

export interface ChecksForecast {
  points: TimePoint[];
  forecast: TimePoint[];
  checksTotal: number;
  checksPerHour: number;
  expectedEnd: number | null;
}

export interface SlotForecast {
  slotId: number;
  name: string;
  discordName: string | null;
  game: string;
  openChecks: number;
  recentChecks: number;
  expectedEnd: number | null;
}

export interface ActivityHeatmap {
  values: number[][];
  max: number;
}

export interface GoalTimelineRow {
  slotId: number;
  name: string;
  discordName: string | null;
  lockedFrom: number | null;
  playFrom: number | null;
  goalAt: number | null;
  minutesToGoal: number | null;
}

const candidates = (slots: SlotRow[]) => slots.filter((slot) => !slot.isSlotLock && !isGoaled(slot));

export function checksForecast(history: RoomHistory, slots: SlotRow[]): ChecksForecast {
  const points = history.buckets.map((bucket) => ({ time: new Date(bucket.time).getTime(), value: bucket.checks }));
  const recentChecks = history.slots.reduce((sum, slot) => sum + slot.recentChecks, 0);
  const checksPerHour = recentChecks / history.rateWindowHours;
  const playable = slots.filter((slot) => !slot.isSlotLock);
  const checksTotal = playable.reduce((sum, slot) => sum + slot.checksTotal, 0);
  const remaining = candidates(slots).reduce((sum, slot) => sum + openChecks(slot), 0);
  const now = new Date(history.calculatedAt).getTime();
  const current = playable.reduce((sum, slot) => sum + slot.checksDone, 0);
  const expectedEnd =
    remaining === 0 ? now : checksPerHour > 0 ? now + (remaining / checksPerHour) * MS_PER_HOUR : null;
  return {
    points,
    forecast:
      expectedEnd === null || remaining === 0
        ? []
        : [
            { time: now, value: current },
            { time: expectedEnd, value: current + remaining },
          ],
    checksTotal,
    checksPerHour: Math.round(checksPerHour * 10) / 10,
    expectedEnd,
  };
}

export function slotForecasts(history: RoomHistory, slots: SlotRow[]): SlotForecast[] {
  const recentBySlotId = new Map(history.slots.map((slot) => [slot.slotId, slot.recentChecks]));
  const now = new Date(history.calculatedAt).getTime();
  return candidates(slots)
    .filter((slot) => !isLocked(slot) && openChecks(slot) > 0)
    .map((slot) => {
      const recentChecks = recentBySlotId.get(slot.id) ?? 0;
      const perHour = recentChecks / history.rateWindowHours;
      return {
        slotId: slot.id,
        name: slot.name,
        discordName: slot.discordName,
        game: slot.game,
        openChecks: openChecks(slot),
        recentChecks,
        expectedEnd: perHour > 0 ? now + (openChecks(slot) / perHour) * MS_PER_HOUR : null,
      };
    })
    .sort(
      (a, b) =>
        (b.expectedEnd ?? Infinity) - (a.expectedEnd ?? Infinity) ||
        b.openChecks - a.openChecks ||
        a.name.localeCompare(b.name),
    );
}

const WEEKDAYS = 7;
const HOURS = 24;

export function activityHeatmap(history: RoomHistory): ActivityHeatmap {
  const sums = Array.from({ length: WEEKDAYS }, () => Array.from({ length: HOURS }, () => 0));
  const counts = Array.from({ length: WEEKDAYS }, () => Array.from({ length: HOURS }, () => 0));
  for (const bucket of history.buckets) {
    const time = new Date(bucket.time);
    const weekday = (time.getDay() + 6) % WEEKDAYS;
    const hour = time.getHours();
    (sums[weekday] as number[])[hour] = ((sums[weekday] as number[])[hour] ?? 0) + bucket.activePlayers;
    (counts[weekday] as number[])[hour] = ((counts[weekday] as number[])[hour] ?? 0) + 1;
  }
  const values = sums.map((row, weekday) =>
    row.map((sum, hour) => {
      const count = (counts[weekday] as number[])[hour] ?? 0;
      return count === 0 ? 0 : Math.round((sum / count) * 10) / 10;
    }),
  );
  return { values, max: Math.max(0, ...values.flat()) };
}

export function concurrentPlayers(history: RoomHistory): { points: TimePoint[]; peak: TimePoint | null } {
  const points = history.buckets.map((bucket) => ({
    time: new Date(bucket.time).getTime(),
    value: bucket.activePlayers,
  }));
  const peak = points.reduce<TimePoint | null>(
    (best, point) => (best === null || point.value > best.value ? point : best),
    null,
  );
  return { points, peak: peak === null || peak.value === 0 ? null : peak };
}

export function goalTimeline(slots: SlotRow[], start: number | null): GoalTimelineRow[] {
  return slots
    .filter((slot) => !slot.isSlotLock)
    .map((slot) => {
      const unlockTime = slot.lockStatus === 'unlocked' ? timeOf(slot.unlockTime) : null;
      const playFrom = isLocked(slot) ? null : (unlockTime ?? start);
      const goalAt = isGoaled(slot) ? timeOf(slot.goalTime) : null;
      return {
        slotId: slot.id,
        name: slot.name,
        discordName: slot.discordName,
        lockedFrom: unlockTime !== null || isLocked(slot) ? start : null,
        playFrom,
        goalAt,
        minutesToGoal: goalAt !== null && playFrom !== null ? minutesBetween(playFrom, goalAt) : null,
      };
    })
    .sort(
      (a, b) =>
        (a.goalAt ?? Infinity) - (b.goalAt ?? Infinity) ||
        (a.playFrom ?? Infinity) - (b.playFrom ?? Infinity) ||
        a.name.localeCompare(b.name),
    );
}
