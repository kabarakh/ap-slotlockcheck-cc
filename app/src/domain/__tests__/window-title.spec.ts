import { describe, expect, it } from 'vite-plus/test';

import { windowTitle } from '../window-title';

describe('windowTitle', () => {
  it('puts the view and the room before the application name', () => {
    expect(windowTitle(['Unlock times', 'Statistics', 'Big Chill Slotlock'], 'TOAST')).toBe(
      'Unlock times - Statistics - Big Chill Slotlock - TOAST',
    );
  });

  it('leaves out empty parts', () => {
    expect(windowTitle(['Rooms', null], 'TOAST')).toBe('Rooms - TOAST');
    expect(windowTitle([undefined, ''], 'TOAST')).toBe('TOAST');
  });
});
