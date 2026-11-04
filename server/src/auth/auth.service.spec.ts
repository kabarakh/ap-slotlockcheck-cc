import { safeReturnPath } from './auth.service.js';

describe('safeReturnPath', () => {
  it('keeps a local path with query and hash', () => {
    expect(safeReturnPath('/rooms/abc/control?tab=locks#slot-3')).toBe('/rooms/abc/control?tab=locks#slot-3');
  });

  it('falls back to the root for values that are no local path', () => {
    expect(safeReturnPath(undefined)).toBe('/');
    expect(safeReturnPath(['/rooms'])).toBe('/');
    expect(safeReturnPath('rooms')).toBe('/');
    expect(safeReturnPath('https://evil.example')).toBe('/');
    expect(safeReturnPath('//evil.example')).toBe('/');
    expect(safeReturnPath('/\\evil.example')).toBe('/');
  });

  it.each(['/\t/evil.example', '/\n/evil.example', '/\r/evil.example', '/\u0000/evil.example', '/\u007f/x'])(
    'rejects the control character trick %j',
    (returnTo) => {
      expect(safeReturnPath(returnTo)).toBe('/');
    },
  );

  it('never resolves to a foreign origin', () => {
    for (const returnTo of ['/\t/evil.example', '/%2F/evil.example', '/./\t/evil.example']) {
      const target = new URL(safeReturnPath(returnTo), 'https://slotlock.example');
      expect(target.origin).toBe('https://slotlock.example');
    }
  });
});
