import { describe, expect, it } from 'vitest';
import { inactivityHours, inactivityLevel } from '../inactivity';
import { slotRow } from './fixtures';

const now = new Date('2026-10-24T12:00:00Z');
const limits = { yellowLimitHours: 24, redLimitHours: 48 };

describe('inactivityHours', () => {
  it('is null for slots that are not unlocked', () => {
    expect(inactivityHours(slotRow({ lockStatus: 'locked', lastActivity: '2026-10-20T12:00:00Z' }), now)).toBeNull();
  });

  it('uses the later value of last activity and unlock time', () => {
    const slot = slotRow({
      lockStatus: 'unlocked',
      lastActivity: '2026-10-22T12:00:00Z',
      unlockTime: '2026-10-23T12:00:00Z',
    });
    expect(inactivityHours(slot, now)).toBe(24);
  });

  it('uses only the last activity if the unlock time is unknown', () => {
    const slot = slotRow({ lockStatus: 'unlocked', lastActivity: '2026-10-21T12:00:00Z', unlockTime: null });
    expect(inactivityHours(slot, now)).toBe(72);
  });

  it('is null without any time', () => {
    expect(inactivityHours(slotRow({ lockStatus: 'unlocked' }), now)).toBeNull();
  });
});

describe('inactivityLevel', () => {
  it('compares the hours with the limits', () => {
    expect(inactivityLevel(null, limits)).toBe('none');
    expect(inactivityLevel(24, limits)).toBe('none');
    expect(inactivityLevel(25, limits)).toBe('yellow');
    expect(inactivityLevel(49, limits)).toBe('red');
  });
});
