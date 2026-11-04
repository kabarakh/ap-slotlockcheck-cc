import type { ChartBar } from './charts';

export interface TimePoint {
  time: number;
  value: number;
}

export interface DurationRange {
  key: string;
  label: string;
  fromMinutes: number;
  toMinutes: number;
}

const HOUR = 60;
const DAY = 24 * HOUR;

export const DURATION_RANGES: DurationRange[] = [
  { key: 'under-1h', label: '< 1 h', fromMinutes: 0, toMinutes: HOUR },
  { key: '1h-3h', label: '1–3 h', fromMinutes: HOUR, toMinutes: 3 * HOUR },
  { key: '3h-6h', label: '3–6 h', fromMinutes: 3 * HOUR, toMinutes: 6 * HOUR },
  { key: '6h-12h', label: '6–12 h', fromMinutes: 6 * HOUR, toMinutes: 12 * HOUR },
  { key: '12h-1d', label: '12–24 h', fromMinutes: 12 * HOUR, toMinutes: DAY },
  { key: '1d-2d', label: '1–2 d', fromMinutes: DAY, toMinutes: 2 * DAY },
  { key: '2d-4d', label: '2–4 d', fromMinutes: 2 * DAY, toMinutes: 4 * DAY },
  { key: 'over-4d', label: '> 4 d', fromMinutes: 4 * DAY, toMinutes: Infinity },
];

export const minutesBetween = (from: number, to: number): number => Math.max(0, (to - from) / 60_000);

export const timeOf = (value: string | null): number | null => (value === null ? null : new Date(value).getTime());

export function durationHistogram(minutes: number[]): ChartBar[] {
  return DURATION_RANGES.map((range) => ({
    label: range.label,
    value: minutes.filter((value) => value >= range.fromMinutes && value < range.toMinutes).length,
  }));
}

export function median(values: number[]): number | null {
  if (values.length === 0) {
    return null;
  }
  const sorted = [...values].sort((a, b) => a - b);
  const middle = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 1
    ? (sorted[middle] as number)
    : ((sorted[middle - 1] as number) + (sorted[middle] as number)) / 2;
}
