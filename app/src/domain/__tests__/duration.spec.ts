import { describe, expect, it } from 'vite-plus/test';

import { formatDuration } from '../duration';

describe('formatDuration', () => {
  it('shows hours and minutes', () => {
    expect(formatDuration(205)).toBe('3 h 25 min');
    expect(formatDuration(61)).toBe('1 h 1 min');
  });

  it('leaves out the hours below one hour and the minutes at full hours', () => {
    expect(formatDuration(0)).toBe('0 min');
    expect(formatDuration(45)).toBe('45 min');
    expect(formatDuration(120)).toBe('2 h');
  });

  it('rounds to full minutes', () => {
    expect(formatDuration(59.6)).toBe('1 h');
    expect(formatDuration(10.4)).toBe('10 min');
  });

  it('does not show negative durations', () => {
    expect(formatDuration(-5)).toBe('0 min');
  });

  it('does not change hours into days', () => {
    expect(formatDuration(3000)).toBe('50 h');
  });
});
