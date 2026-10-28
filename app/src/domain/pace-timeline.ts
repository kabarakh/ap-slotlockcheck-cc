import { scaleTime } from 'd3-scale';

import type { ProgressionStatus, SegmentKind, SlotTimeline } from '@/api/types';

export const SEGMENT_KINDS: SegmentKind[] = ['locked', 'active', 'pause', 'bk', 'break', 'bulk', 'after_goal'];

export interface TimelinePeriod {
  from: string;
  to: string;
}

export interface TimelineSpan extends TimelinePeriod {
  x: number;
  width: number;
}

export interface TimelineSegment extends TimelineSpan {
  kind: SegmentKind;
  checks: number;
}

export interface TimelinePlayer extends TimelineSpan {
  discordName: string | null;
  highlighted: boolean;
}

export interface TimelineMark {
  x: number;
  time: string;
}

export interface TimelineStatusMark extends TimelineMark {
  status: ProgressionStatus;
  showLabel: boolean;
}

export interface TimelineTick {
  x: number;
  time: Date;
}

export interface TimelineLayout {
  segments: TimelineSegment[];
  players: TimelinePlayer[];
  playerChanges: TimelineMark[];
  items: TimelineMark[];
  statuses: TimelineStatusMark[];
  unreadable: TimelineSpan[];
  highlight: TimelineSpan | null;
  ticks: TimelineTick[];
}

export interface TimelineOptions {
  width: number;
  highlight: TimelinePeriod | null;
  tickCount: number;
  statusLabelWidth: number;
}

const timeOf = (value: string): number => new Date(value).getTime();

export function paceTimelineLayout(timeline: SlotTimeline, options: TimelineOptions): TimelineLayout {
  const start = Math.min(timeOf(timeline.from), ...timeline.segments.map((segment) => timeOf(segment.from)));
  const end = Math.max(timeOf(timeline.to), ...timeline.segments.map((segment) => timeOf(segment.to)), start + 1);
  const scale = scaleTime()
    .domain([new Date(start), new Date(end)])
    .range([0, options.width])
    .clamp(true);
  const xOf = (value: string): number => scale(new Date(value));
  const inside = (value: string): boolean => timeOf(value) >= start && timeOf(value) <= end;

  const span = (period: TimelinePeriod): TimelineSpan | null => {
    const x = xOf(period.from);
    const width = xOf(period.to) - x;
    return width > 0 ? { from: period.from, to: period.to, x, width } : null;
  };

  const highlight = options.highlight ? span(options.highlight) : null;

  const playerPeriods = timeline.playerPeriods.map((period, index) =>
    index === 0 && timeOf(period.from) > start ? { ...period, from: new Date(start).toISOString() } : period,
  );
  const players = playerPeriods.flatMap((period): TimelinePlayer[] => {
    const placed = span(period);
    if (placed === null) {
      return [];
    }
    const highlighted =
      options.highlight !== null &&
      timeOf(period.from) < timeOf(options.highlight.to) &&
      timeOf(period.to) > timeOf(options.highlight.from);
    return [{ ...placed, discordName: period.discordName, highlighted }];
  });

  const statusesBefore = timeline.statusChanges.filter((change) => timeOf(change.time) < start);
  const visibleStatuses = [
    ...statusesBefore.slice(-1),
    ...timeline.statusChanges.filter((change) => inside(change.time)),
  ];
  let lastLabelX = Number.NEGATIVE_INFINITY;
  const statuses = visibleStatuses.map((change): TimelineStatusMark => {
    const x = xOf(change.time);
    const showLabel = x - lastLabelX >= options.statusLabelWidth;
    if (showLabel) {
      lastLabelX = x;
    }
    return { x, time: change.time, status: change.status, showLabel };
  });

  return {
    segments: timeline.segments.flatMap((segment): TimelineSegment[] => {
      const placed = span(segment);
      return placed === null ? [] : [{ ...placed, kind: segment.kind, checks: segment.checks }];
    }),
    players,
    playerChanges: timeline.playerPeriods
      .slice(1)
      .filter((period) => timeOf(period.from) > start && timeOf(period.from) < end)
      .map((period) => ({ x: xOf(period.from), time: period.from })),
    items: timeline.progressionItemTimes.filter(inside).map((time) => ({ x: xOf(time), time })),
    statuses,
    unreadable: timeline.unreadableSnapshots.flatMap((period) => {
      const placed = span(period);
      return placed === null ? [] : [placed];
    }),
    highlight,
    ticks: scale.ticks(options.tickCount).map((time) => ({ x: scale(time), time })),
  };
}
