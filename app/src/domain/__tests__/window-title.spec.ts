import { describe, expect, it } from 'vite-plus/test';

import { windowTitle } from '../window-title';

describe('windowTitle', () => {
  it('puts the room before the application name', () => {
    expect(windowTitle('Big Chill Slotlock', 'TOAST')).toBe('Big Chill Slotlock - TOAST');
  });

  it('shows only the application name without a room', () => {
    expect(windowTitle(null, 'TOAST')).toBe('TOAST');
    expect(windowTitle('', 'TOAST')).toBe('TOAST');
  });
});
