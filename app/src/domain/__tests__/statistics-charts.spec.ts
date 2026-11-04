import { describe, expect, it } from 'vite-plus/test';

import { formatLongDuration } from '../duration';
import { ganttLayout, heatmapCells, lineChartLayout, timeTickFormat } from '../statistics-charts';
import { durationHistogram, median } from '../statistics-time';

describe('statistics helpers', () => {
  it('puts durations into ranges', () => {
    const bars = durationHistogram([10, 70, 2000, 9000]);
    expect(bars.filter((bar) => bar.value > 0).map((bar) => bar.label)).toEqual(['< 1 h', '1–3 h', '1–2 d', '> 4 d']);
  });

  it('gives the median', () => {
    expect(median([])).toBeNull();
    expect(median([3, 1, 2])).toBe(2);
    expect(median([4, 1, 3, 2])).toBe(2.5);
  });

  it('formats long durations with days', () => {
    expect(formatLongDuration(90)).toBe('1 h 30 min');
    expect(formatLongDuration(1440)).toBe('1 d');
    expect(formatLongDuration(1560)).toBe('1 d 2 h');
  });
});

describe('chart layouts', () => {
  it('makes one path for each series with points', () => {
    const layout = lineChartLayout(
      [
        {
          key: 'a',
          label: 'A',
          color: 'checks',
          points: [
            { time: 0, value: 0 },
            { time: 3_600_000, value: 10 },
          ],
        },
        { key: 'b', label: 'B', color: 'checks', points: [] },
      ],
      100,
      50,
    );
    expect(layout.paths.map((path) => path.key)).toEqual(['a']);
    expect(layout.yTicks.length).toBeGreaterThan(0);
  });

  it('gives no layout without points', () => {
    expect(lineChartLayout([], 100, 50)).toEqual({ paths: [], xTicks: [], yTicks: [] });
    expect(ganttLayout([], 100)).toEqual({ rects: [], goals: [], ticks: [] });
  });

  it('scales the heatmap opacity to the maximum', () => {
    expect(heatmapCells([[0, 2, 4]]).map((cell) => [cell.opacity, cell.strong])).toEqual([
      [0, false],
      [0.575, true],
      [1, true],
    ]);
    expect(heatmapCells([[1, 10]])[0]?.strong).toBe(false);
  });

  it('places the gantt segments on one time scale', () => {
    const layout = ganttLayout(
      [{ key: 'a', label: 'A', goalAt: 7_200_000, segments: [{ kind: 'playing', from: 0, to: 3_600_000 }] }],
      200,
    );
    expect(layout.rects).toEqual([{ rowKey: 'a', kind: 'playing', x: 0, width: 100 }]);
    expect(layout.goals).toEqual([{ rowKey: 'a', x: 200 }]);
  });
});

describe('timeTickFormat', () => {
  const tick = (value: number) => ({ position: 0, value });
  const day = (date: number, hour: number) => new Date(2026, 10, date, hour).getTime();

  it('shows only the time for a short span', () => {
    expect(timeTickFormat([tick(day(1, 10)), tick(day(1, 14))], day(1, 12))).toBe('time');
  });

  it('shows the day for a long span', () => {
    const ticks = [tick(day(1, 0)), tick(day(4, 0))];
    expect(timeTickFormat(ticks, day(2, 0))).toBe('day');
    expect(timeTickFormat(ticks, day(2, 12))).toBe('dayTime');
  });
});
