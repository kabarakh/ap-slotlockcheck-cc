import { scaleLinear, scaleTime } from 'd3-scale';
import { curveLinear, curveStepAfter, line } from 'd3-shape';

import type { ChartColor } from './charts';
import type { TimePoint } from './statistics-time';

export interface LineSeries {
  key: string;
  label: string;
  color: ChartColor;
  points: TimePoint[];
  dashed?: boolean;
  step?: boolean;
}

export interface LinePath {
  key: string;
  label: string;
  color: ChartColor;
  dashed: boolean;
  path: string;
}

export interface AxisTick {
  position: number;
  value: number;
}

const MIN_TIME_SPAN_MS = 3_600_000;
const DAY_MS = 24 * MIN_TIME_SPAN_MS;

export type TickFormat = 'day' | 'dayTime' | 'time';

export function timeTickFormat(ticks: AxisTick[], tick: number): TickFormat {
  const first = ticks[0]?.value ?? tick;
  const last = ticks[ticks.length - 1]?.value ?? tick;
  const value = new Date(tick);
  const midnight = value.getHours() === 0 && value.getMinutes() === 0;
  if (last - first < DAY_MS) {
    return 'time';
  }
  return midnight ? 'day' : 'dayTime';
}

const timeDomain = (first: number, last: number): [Date, Date] => [
  new Date(first),
  new Date(Math.max(last, first + MIN_TIME_SPAN_MS)),
];

export interface LineChartLayout {
  paths: LinePath[];
  xTicks: AxisTick[];
  yTicks: AxisTick[];
}

export function lineChartLayout(series: LineSeries[], width: number, height: number, minY = 0): LineChartLayout {
  const points = series.flatMap((entry) => entry.points);
  if (points.length === 0) {
    return { paths: [], xTicks: [], yTicks: [] };
  }
  const times = points.map((point) => point.time);
  const values = points.map((point) => point.value);
  const firstTime = Math.min(...times);
  const lastTime = Math.max(...times);
  const x = scaleTime().domain(timeDomain(firstTime, lastTime)).range([0, width]);
  const y = scaleLinear()
    .domain([Math.min(minY, ...values), Math.max(minY + 1, ...values)])
    .nice()
    .range([height, 0]);
  return {
    paths: series
      .filter((entry) => entry.points.length > 0)
      .map((entry) => {
        const shape = line<TimePoint>()
          .x((point) => x(new Date(point.time)))
          .y((point) => y(point.value))
          .curve(entry.step ? curveStepAfter : curveLinear);
        return {
          key: entry.key,
          label: entry.label,
          color: entry.color,
          dashed: entry.dashed ?? false,
          path: shape(entry.points) ?? '',
        };
      }),
    xTicks: x.ticks(6).map((tick) => ({ position: x(tick), value: tick.getTime() })),
    yTicks: y.ticks(4).map((tick) => ({ position: y(tick), value: tick })),
  };
}

export interface HeatmapCell {
  row: number;
  column: number;
  value: number;
  opacity: number;
}

export function heatmapCells(values: number[][], max = Math.max(0, ...values.flat())): HeatmapCell[] {
  return values.flatMap((row, rowIndex) =>
    row.map((value, column) => ({
      row: rowIndex,
      column,
      value,
      opacity: max === 0 || value === 0 ? 0 : 0.15 + 0.85 * (value / max),
    })),
  );
}

export interface GanttSegment {
  kind: 'locked' | 'playing';
  from: number;
  to: number;
}

export interface GanttRow {
  key: string;
  label: string;
  segments: GanttSegment[];
  goalAt: number | null;
}

export interface GanttRect {
  rowKey: string;
  kind: GanttSegment['kind'];
  x: number;
  width: number;
}

export interface GanttLayout {
  rects: GanttRect[];
  goals: { rowKey: string; x: number }[];
  ticks: AxisTick[];
}

export function ganttLayout(rows: GanttRow[], width: number): GanttLayout {
  const times = rows.flatMap((row) => [
    ...row.segments.flatMap((segment) => [segment.from, segment.to]),
    ...(row.goalAt === null ? [] : [row.goalAt]),
  ]);
  if (times.length === 0) {
    return { rects: [], goals: [], ticks: [] };
  }
  const first = Math.min(...times);
  const last = Math.max(...times);
  const x = scaleTime().domain(timeDomain(first, last)).range([0, width]);
  return {
    rects: rows.flatMap((row) =>
      row.segments.map((segment) => ({
        rowKey: row.key,
        kind: segment.kind,
        x: x(new Date(segment.from)),
        width: Math.max(1, x(new Date(segment.to)) - x(new Date(segment.from))),
      })),
    ),
    goals: rows.flatMap((row) => (row.goalAt === null ? [] : [{ rowKey: row.key, x: x(new Date(row.goalAt)) }])),
    ticks: x.ticks(6).map((tick) => ({ position: x(tick), value: tick.getTime() })),
  };
}
