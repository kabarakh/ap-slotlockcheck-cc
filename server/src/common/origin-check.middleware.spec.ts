import { allowedOrigins } from './origin-check.middleware.js';

describe('allowedOrigins', () => {
  it('allows the origin of the public base URL', () => {
    expect(allowedOrigins('http://slotlock.example.com:5173/', undefined)).toEqual(
      new Set(['http://slotlock.example.com:5173']),
    );
  });

  it('adds the additional origins', () => {
    expect(
      allowedOrigins('http://slotlock.example.com:5173', 'http://localhost:5173, http://127.0.0.1:5173/'),
    ).toEqual(new Set(['http://slotlock.example.com:5173', 'http://localhost:5173', 'http://127.0.0.1:5173']));
  });
});
