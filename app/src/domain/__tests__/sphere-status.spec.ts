import { describe, expect, it } from 'vite-plus/test';

import { isSphereDone } from '../sphere-status';

describe('isSphereDone', () => {
  it('is done without open locations', () => {
    expect(isSphereDone({ open: 0, fillerMarked: 0 })).toBe(true);
  });

  it('is done when all open locations are marked as filler', () => {
    expect(isSphereDone({ open: 3, fillerMarked: 3 })).toBe(true);
  });

  it('is not done while an open location is not marked', () => {
    expect(isSphereDone({ open: 3, fillerMarked: 2 })).toBe(false);
  });
});
