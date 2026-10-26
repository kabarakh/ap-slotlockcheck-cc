import { describe, expect, it } from 'vitest';

import { windowTitle } from '../window-title';

describe('windowTitle', () => {
  it('puts the room before the application name', () => {
    expect(windowTitle('Big Chill Slotlock', 'SlotLockCheck')).toBe('Big Chill Slotlock - SlotLockCheck');
  });

  it('shows only the application name without a room', () => {
    expect(windowTitle(null, 'SlotLockCheck')).toBe('SlotLockCheck');
    expect(windowTitle('', 'SlotLockCheck')).toBe('SlotLockCheck');
  });
});
