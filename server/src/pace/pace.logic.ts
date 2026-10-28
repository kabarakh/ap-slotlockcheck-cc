import type { LockStatus, UnlockTimeSource } from '../lock/lock.types.js';
import type { PlayerPeriod, SignalPeriod, SlotSignals } from './pace-signals.js';
import { CHECKS_HISTORY_STEP_MINUTES, MIN_ACTIVE_MINUTES_FOR_PACE } from './pace.constants.js';

export interface PaceHistoryPoint {
  time: Date;
  checks: number;
}

export type SlotStartKind = 'unlock' | 'estimated' | 'history_start' | 'unknown';

export interface SlotRange {
  start: Date;
  end: Date;
  startKind: SlotStartKind;
}

export interface PaceLimits {
  breakLimitMinutes: number;
  bulkLimitChecks: number;
}

export type SegmentKind = 'locked' | 'active' | 'pause' | 'bk' | 'break' | 'bulk' | 'after_goal';

export interface Segment {
  kind: SegmentKind;
  from: Date;
  to: Date;
  checks: number;
}

export type SlotRangeLock =
  | { status: Extract<LockStatus, 'locked' | 'partially_unlocked'> }
  | { status: Extract<LockStatus, 'start_slot' | 'not_locked'> }
  | { status: 'unlocked'; unlockTime: Date; unlockTimeSource: Exclude<UnlockTimeSource, 'unknown'> }
  | { status: 'unlocked'; unlockTime: null; unlockTimeSource: 'unknown' };

export interface SlotRangeInput {
  lock: SlotRangeLock;
  goalReached: boolean;
  goalTime: Date | null;
  firstHistoryTime: Date | null;
  now: Date;
}

export type SlotPlayer = Pick<PlayerPeriod, 'discordUserId' | 'discordName'>;

export interface SlotPaceInput {
  history: PaceHistoryPoint[];
  range: SlotRange | null;
  signals: SlotSignals;
  limits: PaceLimits;
  currentPlayer: SlotPlayer;
  now: Date;
}

export interface SlotPaceValues {
  activeMinutes: number;
  checks: number;
  checksPerHour: number | null;
  minutesPerCheck: number | null;
  bkMinutes: number;
  bkShare: number | null;
  bkCount: number;
  longestBkMinutes: number;
  breakMinutes: number;
  startKind: SlotStartKind | null;
  partialSignals: boolean;
}

export interface SlotPaceRow extends SlotPaceValues {
  discordUserId: string | null;
  discordName: string | null;
  from: Date;
  to: Date;
}

export interface GamePaceSlot {
  activeMinutes: number | null;
  checks: number | null;
  checksPerHour: number | null;
}

export interface GamePaceValues {
  slotCount: number;
  activeMinutes: number;
  checks: number;
  checksPerHour: number | null;
  medianChecksPerHour: number | null;
}

interface Step {
  from: Date;
  to: Date;
  checks: number;
}

interface QuietPeriod {
  steps: Step[];
  nextActive: Step | undefined;
}

interface BkPeriod {
  start: Date;
  minutes: number;
}

interface Classification {
  before: Segment[];
  inside: Segment[];
  after: Segment[];
  bkPeriods: BkPeriod[];
}

type PlayerRow = Pick<SlotPaceRow, 'discordUserId' | 'discordName' | 'from' | 'to'>;

const MS_PER_MINUTE = 60_000;
const HISTORY_STEP_MS = CHECKS_HISTORY_STEP_MINUTES * MS_PER_MINUTE;

export function slotRange(input: SlotRangeInput): SlotRange | null {
  const { lock } = input;
  if (lock.status === 'locked' || lock.status === 'partially_unlocked') {
    return null;
  }
  if (input.goalReached && input.goalTime === null) {
    return null;
  }
  const end = input.goalReached && input.goalTime !== null ? input.goalTime : input.now;
  if (lock.status !== 'unlocked' || lock.unlockTime === null) {
    if (input.firstHistoryTime === null) {
      return null;
    }
    return {
      start: input.firstHistoryTime,
      end,
      startKind: lock.status === 'unlocked' ? 'unknown' : 'history_start',
    };
  }
  return {
    start: lock.unlockTime,
    end,
    startKind: lock.unlockTimeSource === 'estimated' ? 'estimated' : 'unlock',
  };
}

export function classifySlot(input: SlotPaceInput): Segment[] {
  if (input.range === null) {
    return [];
  }
  const { before, inside, after } = classify(input, input.range);
  return joinSegments([...before, ...inside, ...after]);
}

export function slotPaceRows(input: SlotPaceInput): SlotPaceRow[] {
  const { range, signals } = input;
  if (range === null) {
    return [];
  }
  const { inside, bkPeriods } = classify(input, range);
  return playerRows(range, signals.playerPeriods, input.currentPlayer)
    .flatMap((row): Omit<SlotPaceRow, 'startKind'>[] => {
      const segments = inside.flatMap((segment) => segmentInRow(segment, row));
      if (!segments.some((segment) => minutes(segment) > 0)) {
        return [];
      }
      return [
        {
          ...row,
          ...rowValues(
            segments,
            bkPeriods.filter((period) => period.start >= row.from && period.start < row.to),
          ),
          partialSignals: signals.signalsFrom === null || signals.signalsFrom > row.from,
        },
      ];
    })
    .map((row, index) => ({ ...row, startKind: index === 0 ? range.startKind : null }));
}

export function gamePaceValues(slots: GamePaceSlot[]): GamePaceValues {
  const activeMinutes = slots.reduce((sum, slot) => sum + (slot.activeMinutes ?? 0), 0);
  const checks = slots.reduce((sum, slot) => sum + (slot.checks ?? 0), 0);
  const paces = slots
    .map((slot) => slot.checksPerHour)
    .filter((pace): pace is number => pace !== null)
    .sort((a, b) => a - b);
  return {
    slotCount: slots.length,
    activeMinutes,
    checks,
    checksPerHour: activeMinutes >= MIN_ACTIVE_MINUTES_FOR_PACE && checks > 0 ? checks / (activeMinutes / 60) : null,
    medianChecksPerHour: median(paces),
  };
}

function classify({ history, signals, limits, now }: SlotPaceInput, range: SlotRange): Classification {
  const before: Segment[] = [];
  const inside: Step[] = [];
  const after: Segment[] = [];
  for (const step of steps(history, now)) {
    if (step.to <= range.start) {
      before.push({ kind: 'locked', ...step });
    } else if (step.from >= range.end) {
      after.push({ kind: 'after_goal', ...step });
    } else {
      if (step.from < range.start) {
        before.push({ kind: 'locked', from: step.from, to: range.start, checks: 0 });
      }
      inside.push({
        from: step.from < range.start ? range.start : step.from,
        to: step.to > range.end ? range.end : step.to,
        checks: step.checks,
      });
      if (step.to > range.end) {
        after.push({ kind: 'after_goal', from: range.end, to: step.to, checks: 0 });
      }
    }
  }

  const isActive = (step: Step) => step.checks > 0 && step.checks <= limits.bulkLimitChecks;
  const isBulk = (step: Step) => step.checks > limits.bulkLimitChecks;
  const classified: Segment[] = [];
  const bkPeriods: BkPeriod[] = [];
  let index = 0;
  while (index < inside.length) {
    const step = inside[index];
    if (isActive(step)) {
      classified.push({ kind: 'active', ...step });
      index += 1;
      continue;
    }
    const quietSteps: Step[] = [];
    while (index < inside.length && !isActive(inside[index])) {
      quietSteps.push(inside[index]);
      index += 1;
    }
    const kind = quietKind({ steps: quietSteps, nextActive: inside[index] }, signals, limits);
    const quietSegments = quietSteps.map((quietStep): Segment => ({
      kind: isBulk(quietStep) ? 'bulk' : kind,
      ...quietStep,
    }));
    if (kind === 'bk') {
      bkPeriods.push({
        start: quietSteps[0].from,
        minutes: quietSegments
          .filter((segment) => segment.kind === 'bk')
          .reduce((sum, segment) => sum + minutes(segment), 0),
      });
    }
    classified.push(...quietSegments);
  }

  return { before, inside: classified, after, bkPeriods };
}

function playerRows(range: SlotRange, periods: PlayerPeriod[], currentPlayer: SlotPlayer): PlayerRow[] {
  if (periods.length === 0) {
    const { discordUserId, discordName } = currentPlayer;
    return [{ discordUserId, discordName, from: range.start, to: range.end }];
  }
  return [...periods]
    .sort((a, b) => a.from.getTime() - b.from.getTime())
    .map((period, index) => (index === 0 && period.from > range.start ? { ...period, from: range.start } : period))
    .filter((period) => period.from < range.end && period.to > range.start)
    .map(({ discordUserId, discordName, from, to }) => ({
      discordUserId,
      discordName,
      from: from < range.start ? range.start : from,
      to: to > range.end ? range.end : to,
    }));
}

function segmentInRow(segment: Segment, row: PlayerRow): Segment[] {
  if (segment.checks > 0) {
    return segment.to > row.from && segment.to <= row.to ? [segment] : [];
  }
  const from = segment.from < row.from ? row.from : segment.from;
  const to = segment.to > row.to ? row.to : segment.to;
  return from < to ? [{ ...segment, from, to }] : [];
}

function rowValues(segments: Segment[], bkPeriods: BkPeriod[]): Omit<SlotPaceValues, 'startKind' | 'partialSignals'> {
  const minutesOf = (...kinds: SegmentKind[]) =>
    segments.filter((segment) => kinds.includes(segment.kind)).reduce((sum, segment) => sum + minutes(segment), 0);
  const activeMinutes = minutesOf('active', 'pause');
  const checks = segments
    .filter((segment) => segment.kind === 'active')
    .reduce((sum, segment) => sum + segment.checks, 0);
  const bkMinutes = minutesOf('bk');
  const hasPace = activeMinutes >= MIN_ACTIVE_MINUTES_FOR_PACE && checks > 0;
  return {
    activeMinutes,
    checks,
    checksPerHour: hasPace ? checks / (activeMinutes / 60) : null,
    minutesPerCheck: hasPace ? activeMinutes / checks : null,
    bkMinutes,
    bkShare: activeMinutes + bkMinutes > 0 ? bkMinutes / (activeMinutes + bkMinutes) : null,
    bkCount: bkPeriods.length,
    longestBkMinutes: Math.max(0, ...bkPeriods.map((period) => period.minutes)),
    breakMinutes: minutesOf('break'),
  };
}

function steps(history: PaceHistoryPoint[], now: Date): Step[] {
  const points = filledHistory(
    [...history].sort((a, b) => a.time.getTime() - b.time.getTime()),
    now,
  );
  return points.slice(1).map((point, index) => ({
    from: points[index].time,
    to: point.time,
    checks: Math.max(0, point.checks - points[index].checks),
  }));
}

function filledHistory(points: PaceHistoryPoint[], now: Date): PaceHistoryPoint[] {
  return points.flatMap((point, index) => {
    const next = points[index + 1];
    const start = point.time.getTime();
    const count = Math.max(
      0,
      next === undefined
        ? Math.floor((now.getTime() - start) / HISTORY_STEP_MS)
        : Math.ceil((next.time.getTime() - start) / HISTORY_STEP_MS) - 1,
    );
    return [
      point,
      ...Array.from({ length: count }, (_, step) => ({
        time: new Date(start + (step + 1) * HISTORY_STEP_MS),
        checks: point.checks,
      })),
    ];
  });
}

function quietKind(quiet: QuietPeriod, signals: SlotSignals, limits: PaceLimits): 'bk' | 'break' | 'pause' {
  const from = quiet.steps[0].from;
  const to = quiet.steps[quiet.steps.length - 1].to;
  if (signals.signalsFrom !== null && to > signals.signalsFrom) {
    const cheeseBk = signals.bkPeriods.some((period) => period.from < to && period.to > from);
    const nextActive = quiet.nextActive;
    const itemBk =
      nextActive !== undefined && signals.progressionItemTimes.some((time) => time > from && time <= nextActive.to);
    if (cheeseBk || itemBk) {
      return 'bk';
    }
  }
  return minutes({ from, to }) > limits.breakLimitMinutes ? 'break' : 'pause';
}

function joinSegments(segments: Segment[]): Segment[] {
  const joined: Segment[] = [];
  for (const segment of segments) {
    const previous = joined[joined.length - 1];
    if (previous?.kind === segment.kind && previous.to.getTime() === segment.from.getTime()) {
      joined[joined.length - 1] = { ...previous, to: segment.to, checks: previous.checks + segment.checks };
    } else {
      joined.push(segment);
    }
  }
  return joined;
}

function minutes(period: SignalPeriod): number {
  return (period.to.getTime() - period.from.getTime()) / MS_PER_MINUTE;
}

function median(sorted: number[]): number | null {
  if (sorted.length === 0) {
    return null;
  }
  const middle = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 1 ? sorted[middle] : (sorted[middle - 1] + sorted[middle]) / 2;
}
