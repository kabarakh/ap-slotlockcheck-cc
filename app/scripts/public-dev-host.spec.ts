import { describe, expect, it } from 'vitest';

import { publicHostFromEnv } from './public-dev-host';

describe('publicHostFromEnv', () => {
  it('returns the host name of PUBLIC_BASE_URL', () => {
    expect(publicHostFromEnv('PORT=3000\nPUBLIC_BASE_URL=https://slotlock.test\n')).toBe('slotlock.test');
  });

  it('rejects a missing or invalid PUBLIC_BASE_URL', () => {
    expect(() => publicHostFromEnv('PORT=3000\n')).toThrow(/PUBLIC_BASE_URL/);
    expect(() => publicHostFromEnv('PUBLIC_BASE_URL=not a url\n')).toThrow(/PUBLIC_BASE_URL/);
  });

  it('rejects local hosts', () => {
    expect(() => publicHostFromEnv('PUBLIC_BASE_URL=http://localhost:5173\n')).toThrow(/localhost/);
  });
});
