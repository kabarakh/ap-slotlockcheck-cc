import type { SlotLockState } from '../lock/lock.types.js';
import type { ChecksHistoryPoint } from '../lock/unlock-time.logic.js';
import type { GamePaceDto, SlotPaceDto, SlotTimelineDto, TimePeriodDto } from './dto/pace.dto.js';
import type { SignalPeriod, SignalSource, SlotSignals } from './pace-signals.js';
import {
  gamePaceValues,
  type PaceHistoryPoint,
  type Segment,
  type SlotPaceRow,
  type SlotRange,
  type SlotRangeLock,
} from './pace.logic.js';

export interface PaceSlot {
  id: number;
  name: string;
  game: string;
  discordUserId: string | null;
  discordName: string | null;
}

export interface SnapshotEntry {
  id: number;
  source: SignalSource;
  firstSyncRunId: number;
}

export interface OrderedSnapshot extends SignalPeriod {
  id: number;
  source: SignalSource;
}

export interface TimelineInput {
  slotId: number;
  range: SlotRange;
  segments: Segment[];
  signals: SlotSignals;
  unreadableSnapshots: SignalPeriod[];
}

export interface SnapshotOrder {
  snapshots: OrderedSnapshot[];
  withoutRun: number[];
}

export function pacedSlots<T extends { isSlotLock: boolean }>(slots: T[]): T[] {
  return slots.filter((slot) => !slot.isSlotLock);
}

export function slotRangeLock(
  state: Pick<SlotLockState, 'status' | 'unlockTime' | 'unlockTimeSource'> | undefined,
): SlotRangeLock {
  if (state === undefined) {
    return { status: 'not_locked' };
  }
  if (state.status !== 'unlocked') {
    return { status: state.status };
  }
  if (state.unlockTime === null || state.unlockTimeSource === null || state.unlockTimeSource === 'unknown') {
    return { status: 'unlocked', unlockTime: null, unlockTimeSource: 'unknown' };
  }
  return { status: 'unlocked', unlockTime: state.unlockTime, unlockTimeSource: state.unlockTimeSource };
}

export function firstHistoryTime(history: ChecksHistoryPoint[]): Date | null {
  return history.reduce<Date | null>(
    (first, point) => (first === null || point.time < first ? point.time : first),
    null,
  );
}

export function slotHistory(history: ChecksHistoryPoint[], cheeseGameId: number): PaceHistoryPoint[] {
  const key = String(cheeseGameId);
  return history.flatMap((point) => {
    const checks = point.checksBySlotKey[key];
    return checks === undefined ? [] : [{ time: point.time, checks }];
  });
}

export function orderSnapshots(entries: SnapshotEntry[], runStarts: Map<number, Date>, now: Date): SnapshotOrder {
  const withoutRun = entries.filter((entry) => !runStarts.has(entry.firstSyncRunId)).map((entry) => entry.id);
  const timed = entries
    .flatMap((entry) => {
      const from = runStarts.get(entry.firstSyncRunId);
      return from === undefined ? [] : [{ id: entry.id, source: entry.source, from }];
    })
    .sort((a, b) => a.from.getTime() - b.from.getTime() || a.id - b.id);
  const snapshots = timed.map((snapshot, index) => ({
    ...snapshot,
    to: timed.slice(index + 1).find((next) => next.source === snapshot.source)?.from ?? now,
  }));
  return { snapshots, withoutRun };
}

export function slotPaceDtos(slot: PaceSlot, rows: SlotPaceRow[]): SlotPaceDto[] {
  const base = { slotId: slot.id, name: slot.name, game: slot.game };
  if (rows.length === 0) {
    return [
      {
        ...base,
        hasRange: false,
        discordUserId: slot.discordUserId,
        discordName: slot.discordName,
        from: null,
        to: null,
        activeMinutes: null,
        checks: null,
        checksPerHour: null,
        minutesPerCheck: null,
        bkMinutes: null,
        bkShare: null,
        bkCount: null,
        longestBkMinutes: null,
        breakMinutes: null,
        startKind: null,
        partialSignals: false,
      },
    ];
  }
  return rows.map((row) => ({
    ...base,
    hasRange: true,
    discordUserId: row.discordUserId,
    discordName: row.discordName,
    from: row.from.toISOString(),
    to: row.to.toISOString(),
    activeMinutes: row.activeMinutes,
    checks: row.checks,
    checksPerHour: row.checksPerHour,
    minutesPerCheck: row.minutesPerCheck,
    bkMinutes: row.bkMinutes,
    bkShare: row.bkShare,
    bkCount: row.bkCount,
    longestBkMinutes: row.longestBkMinutes,
    breakMinutes: row.breakMinutes,
    startKind: row.startKind,
    partialSignals: row.partialSignals,
  }));
}

export function gamePaceDtos(slots: Pick<PaceSlot, 'game'>[], rows: SlotPaceDto[]): GamePaceDto[] {
  return [...new Set(slots.map((slot) => slot.game))]
    .sort((a, b) => a.localeCompare(b))
    .map((game) => ({
      game,
      ...gamePaceValues(rows.filter((row) => row.game === game && row.hasRange)),
    }));
}

const periodDto = ({ from, to }: SignalPeriod): TimePeriodDto => ({ from: from.toISOString(), to: to.toISOString() });

export function slotTimelineDto(input: TimelineInput): SlotTimelineDto {
  const { signals } = input;
  return {
    slotId: input.slotId,
    from: input.range.start.toISOString(),
    to: input.range.end.toISOString(),
    segments: input.segments.map((segment) => ({
      kind: segment.kind,
      from: segment.from.toISOString(),
      to: segment.to.toISOString(),
      checks: segment.checks,
    })),
    progressionItemTimes: signals.progressionItemTimes.map((time) => time.toISOString()),
    statusChanges: signals.statusChanges.map(({ time, status }) => ({ time: time.toISOString(), status })),
    playerPeriods: signals.playerPeriods.map((period) => ({
      from: period.from.toISOString(),
      to: period.to.toISOString(),
      discordUserId: period.discordUserId,
      discordName: period.discordName,
    })),
    unreadableSnapshots: input.unreadableSnapshots.map(periodDto),
  };
}
