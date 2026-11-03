import { scaleBand, scaleLinear } from 'd3-scale';
import { arc, pie, type PieArcDatum } from 'd3-shape';

export const CHART_SERIES_COLORS = [
  'series-1',
  'series-2',
  'series-3',
  'series-4',
  'series-5',
  'series-6',
  'series-7',
  'series-8',
] as const;

export type ChartSeriesColor = (typeof CHART_SERIES_COLORS)[number];

export type ChartColor = 'unlocks' | 'checks' | 'goal' | 'locked' | 'rest' | ChartSeriesColor;

export interface ChartPart {
  key: string;
  label: string;
  value: number;
  color: ChartColor;
}

export interface DonutSegment extends ChartPart {
  path: string;
}

export interface ChartBar {
  label: string;
  value: number;
}

export interface BarRect extends ChartBar {
  x: number;
  y: number;
  width: number;
  height: number;
}

export function donutSegments(parts: ChartPart[], radius: number, thickness: number): DonutSegment[] {
  const layout = pie<ChartPart>()
    .value((part) => part.value)
    .sort(null);
  const shape = arc<PieArcDatum<ChartPart>>()
    .innerRadius(radius - thickness)
    .outerRadius(radius);
  return layout(parts)
    .filter((slice) => slice.value > 0)
    .map((slice) => ({ ...slice.data, path: shape(slice) ?? '' }));
}

export function barRects(bars: ChartBar[], width: number, height: number): BarRect[] {
  const x = scaleBand<string>()
    .domain(bars.map((bar) => bar.label))
    .range([0, width])
    .padding(0.2);
  const y = scaleLinear()
    .domain([0, Math.max(1, ...bars.map((bar) => bar.value))])
    .range([height, 0]);
  return bars.map((bar) => ({
    ...bar,
    x: x(bar.label) ?? 0,
    y: y(bar.value),
    width: x.bandwidth(),
    height: height - y(bar.value),
  }));
}

export interface ChartRow {
  key: string;
  label: string;
  values: { key: string; value: number; color: ChartColor }[];
}

export interface ChartRowRect {
  key: string;
  rowKey: string;
  value: number;
  color: ChartColor;
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface DivergingBarLayout {
  rects: ChartRowRect[];
  rowCenters: { key: string; label: string; y: number }[];
  zeroX: number;
  limit: number;
}

export function divergingBars(rows: ChartRow[], width: number, rowHeight: number): DivergingBarLayout {
  const limit = Math.max(1, ...rows.flatMap((row) => row.values.map((entry) => Math.abs(entry.value))));
  const x = scaleLinear().domain([-limit, limit]).range([0, width]);
  const rowPadding = rowHeight * 0.1;
  const rowTop = (index: number) => index * rowHeight + rowPadding;
  const rects = rows.flatMap((row, index) => {
    const series = scaleBand<string>()
      .domain(row.values.map((entry) => entry.key))
      .range([0, rowHeight - 2 * rowPadding])
      .padding(0.1);
    return row.values.map((entry) => ({
      key: entry.key,
      rowKey: row.key,
      value: entry.value,
      color: entry.color,
      x: Math.min(x(0), x(entry.value)),
      y: rowTop(index) + (series(entry.key) ?? 0),
      width: Math.abs(x(entry.value) - x(0)),
      height: series.bandwidth(),
    }));
  });
  return {
    rects,
    rowCenters: rows.map((row, index) => ({ key: row.key, label: row.label, y: index * rowHeight + rowHeight / 2 })),
    zeroX: x(0),
    limit,
  };
}
