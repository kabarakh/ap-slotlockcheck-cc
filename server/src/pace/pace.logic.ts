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

export type SegmentKind =
  | 'locked'
  | 'not_started'
  | 'active'
  | 'pause'
  | 'bk'
  | 'break'
  | 'bulk'
  | 'no_data'
  | 'after_goal';

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

export interface NoLogicSignals {
  from: Date;
  periods: SignalPeriod[];
}

export interface SlotPaceInput {
  history: PaceHistoryPoint[];
  range: SlotRange | null;
  signals: SlotSignals;
  noLogic: NoLogicSignals | null;
  dataGaps: SignalPeriod[];
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

export interface Step {
  from: Date;
  to: Date;
  checks: number;
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
  const signalsFrom = bkSignalsFrom(signals, input.noLogic);
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
          partialSignals: signalsFrom === null || signalsFrom > row.from,
        },
      ];
    })
    .map((row, index) => ({ ...row, startKind: index === 0 ? range.startKind : null }));
}

export function bkSignalsFrom(signals: SlotSignals, noLogic: NoLogicSignals | null): Date | null {
  const starts = [signals.signalsFrom, noLogic?.from ?? null].filter((time): time is Date => time !== null);
  return starts.length === 0 ? null : new Date(Math.min(...starts.map((time) => time.getTime())));
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

function classify(input: SlotPaceInput, range: SlotRange): Classification {
  const { history, now } = input;
  const before: Segment[] = [];
  const inside: Step[] = [];
  const after: Segment[] = [];
  for (const step of historySteps(history, now)) {
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

  const classified = classifySteps(inside, input, range);
  const bkPeriods: BkPeriod[] = [];
  let previousKind: SegmentKind | undefined;
  for (const segment of classified) {
    if (segment.kind === 'bulk') {
      continue;
    }
    if (segment.kind === 'bk' && previousKind === 'bk') {
      bkPeriods[bkPeriods.length - 1].minutes += minutes(segment);
    } else if (segment.kind === 'bk') {
      bkPeriods.push({ start: segment.from, minutes: minutes(segment) });
    }
    previousKind = segment.kind;
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
    .filter((segment) => segment.kind === 'active' || segment.kind === 'no_data')
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

export function historySteps(history: PaceHistoryPoint[], now: Date): Step[] {
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

type StepKind = Exclude<SegmentKind, 'locked' | 'after_goal' | 'not_started' | 'pause' | 'break'> | 'quiet';

const overlaps = (period: SignalPeriod, step: Step): boolean => period.from < step.to && period.to > step.from;

function isBk(step: Step, { signals, noLogic }: SlotPaceInput): boolean {
  if (noLogic !== null && step.from >= noLogic.from) {
    return noLogic.periods.some((period) => overlaps(period, step));
  }
  return (
    signals.signalsFrom !== null &&
    step.to > signals.signalsFrom &&
    signals.bkPeriods.some((period) => overlaps(period, step))
  );
}

function stepKind(step: Step, input: SlotPaceInput): StepKind {
  if (input.dataGaps.some((gap) => step.from <= gap.to && step.to > gap.from)) {
    return 'no_data';
  }
  if (step.checks > input.limits.bulkLimitChecks) {
    return 'bulk';
  }
  if (step.checks > 0) {
    return 'active';
  }
  return isBk(step, input) ? 'bk' : 'quiet';
}

function classifySteps(steps: Step[], input: SlotPaceInput, range: SlotRange): Segment[] {
  const kinds = steps.map((step) => stepKind(step, input));
  const firstChecks = steps.findIndex((step) => step.checks > 0);
  const started = firstChecks === -1 ? steps.length : firstChecks;
  const closedAtEnd = range.end < input.now;
  const segments: Segment[] = [];
  let index = 0;
  while (index < steps.length) {
    const kind = kinds[index];
    if (kind !== 'quiet') {
      segments.push({ kind, ...steps[index] });
      index += 1;
      continue;
    }
    if (index < started) {
      segments.push({ kind: 'not_started', ...steps[index] });
      index += 1;
      continue;
    }
    const runStart = index;
    let runEnd = index;
    while (index < steps.length && (kinds[index] === 'quiet' || kinds[index] === 'bulk')) {
      if (kinds[index] === 'quiet') {
        runEnd = index;
      }
      index += 1;
    }
    const next = kinds[index];
    index = runEnd + 1;
    const previous = kinds[runStart - 1];
    const closed =
      previous !== undefined && previous !== 'no_data' && (next === undefined ? closedAtEnd : next !== 'no_data');
    const short = minutes({ from: steps[runStart].from, to: steps[runEnd].to }) <= input.limits.breakLimitMinutes;
    const runKind = closed && short ? 'pause' : 'break';
    segments.push(
      ...steps
        .slice(runStart, index)
        .map((step, offset): Segment => ({ kind: kinds[runStart + offset] === 'bulk' ? 'bulk' : runKind, ...step })),
    );
  }
  return segments;
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
