import { scaleBand, scaleLinear } from 'd3-scale';
import { arc, pie, type PieArcDatum } from 'd3-shape';

export type ChartColor = 'unlocks' | 'checks' | 'goal' | 'locked' | 'rest';

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
