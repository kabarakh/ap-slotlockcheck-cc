import { describe, expect, it } from 'vitest';

import { barRects, donutSegments } from '../charts';

describe('donutSegments', () => {
  it('makes one path for each part with a value', () => {
    const segments = donutSegments(
      [
        { key: 'a', label: 'A', value: 3, color: 'checks' },
        { key: 'b', label: 'B', value: 0, color: 'rest' },
        { key: 'c', label: 'C', value: 1, color: 'rest' },
      ],
      50,
      10,
    );
    expect(segments.map((segment) => segment.key)).toEqual(['a', 'c']);
    expect(segments.every((segment) => segment.path.startsWith('M'))).toBe(true);
  });

  it('makes no path without values', () => {
    expect(donutSegments([{ key: 'a', label: 'A', value: 0, color: 'checks' }], 50, 10)).toEqual([]);
  });
});

describe('barRects', () => {
  it('scales the highest bar to the full height', () => {
    const rects = barRects(
      [
        { label: '0', value: 2 },
        { label: '1', value: 4 },
      ],
      200,
      100,
    );
    expect(rects.map((rect) => rect.height)).toEqual([50, 100]);
    expect(rects[1]?.y).toBe(0);
    expect(rects[0]!.x).toBeLessThan(rects[1]!.x);
  });

  it('keeps bars with zero at zero height', () => {
    expect(barRects([{ label: '0', value: 0 }], 100, 100)[0]?.height).toBe(0);
  });
});
