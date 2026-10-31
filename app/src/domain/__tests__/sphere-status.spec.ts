import { describe, expect, it } from 'vite-plus/test';

import { isSphereDone } from '../sphere-status';

describe('isSphereDone', () => {
  it('is done without open locations', () => {
    expect(isSphereDone({ open: 0 })).toBe(true);
  });

  it('is not done while a location is open', () => {
    expect(isSphereDone({ open: 1 })).toBe(false);
  });
});
