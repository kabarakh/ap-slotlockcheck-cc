import { describe, expect, it } from 'vitest';

import { callbackUrlFor, loginOrigin } from './login-origin.logic.js';

const allowed = new Set(['https://toast.example.com', 'http://localhost:5173', 'https://localhost:5173']);
const publicBaseUrl = 'https://toast.example.com/';

describe('loginOrigin', () => {
  it('uses the forwarded protocol and the host of an allowed origin', () => {
    expect(loginOrigin({ host: 'localhost:5173', 'x-forwarded-proto': 'http' }, 'http', allowed, publicBaseUrl)).toBe(
      'http://localhost:5173',
    );
    expect(loginOrigin({ host: 'localhost:5173', 'x-forwarded-proto': 'https' }, 'http', allowed, publicBaseUrl)).toBe(
      'https://localhost:5173',
    );
  });

  it('uses the first value of a forwarded header list', () => {
    expect(
      loginOrigin(
        { host: 'localhost:3000', 'x-forwarded-host': 'toast.example.com, proxy', 'x-forwarded-proto': 'https,http' },
        'http',
        allowed,
        publicBaseUrl,
      ),
    ).toBe('https://toast.example.com');
  });

  it('uses the request protocol without a forwarded protocol', () => {
    expect(loginOrigin({ host: 'localhost:5173' }, 'http', allowed, publicBaseUrl)).toBe('http://localhost:5173');
  });

  it('uses the public base URL for an origin that is not allowed', () => {
    expect(
      loginOrigin({ host: 'evil.example.com', 'x-forwarded-proto': 'https' }, 'http', allowed, publicBaseUrl),
    ).toBe('https://toast.example.com');
    expect(loginOrigin({}, 'http', allowed, publicBaseUrl)).toBe('https://toast.example.com');
  });
});

describe('callbackUrlFor', () => {
  it('keeps the path of the configured callback URL on the given origin', () => {
    expect(callbackUrlFor('http://localhost:5173', 'https://toast.example.com/api/auth/discord/callback')).toBe(
      'http://localhost:5173/api/auth/discord/callback',
    );
  });
});
