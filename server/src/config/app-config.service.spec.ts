import { ConfigService } from '@nestjs/config';

import { AppConfigService } from './app-config.service.js';
import { validateEnvironment } from './environment.js';

const validEnvironment = {
  NODE_ENV: 'test',
  PUBLIC_BASE_URL: 'http://localhost:5173',
  DATABASE_URL: 'file:./test.db',
  JWT_SECRET: 'x'.repeat(32),
  DISCORD_CLIENT_ID: 'client',
  DISCORD_CLIENT_SECRET: 'secret',
  DISCORD_CALLBACK_URL: 'http://localhost:5173/api/auth/discord/callback',
  HTTP_USER_AGENT: 'SlotLockCheck/0.1.0',
};

describe('validateEnvironment', () => {
  it('applies default values', () => {
    const environment = validateEnvironment(validEnvironment);
    expect(environment.SYNC_INTERVAL_MINUTES).toBe(5);
    expect(environment.MANUAL_SYNC_COOLDOWN_SECONDS).toBe(60);
    expect(environment.TRUST_PROXY).toBe(false);
  });

  it('rejects a sync interval below 5 minutes', () => {
    expect(() => validateEnvironment({ ...validEnvironment, SYNC_INTERVAL_MINUTES: '4' })).toThrow(/SYNC_INTERVAL/);
  });

  it('rejects placeholders', () => {
    expect(() => validateEnvironment({ ...validEnvironment, PUBLIC_BASE_URL: 'https://<PRODUCTION_DOMAIN>' })).toThrow(
      /placeholder/,
    );
  });
});

describe('AppConfigService', () => {
  it('reads typed values', () => {
    const environment = validateEnvironment(validEnvironment);
    const service = new AppConfigService(new ConfigService(environment) as never);
    expect(service.get('PORT')).toBe(3000);
    expect(service.isTest).toBe(true);
  });
});
