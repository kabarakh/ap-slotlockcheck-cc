import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { applyMigrations } from './support/migrations.ts';
import { startMockSources } from './support/mock-sources.ts';

const SERVER_PORT = 4173;
const MOCK_PORT = 4010;

const directory = mkdtempSync(join(tmpdir(), 'slotlock-e2e-'));
const databaseFile = join(directory, 'e2e.db');
applyMigrations(databaseFile);
await startMockSources(MOCK_PORT);

Object.assign(process.env, {
  NODE_ENV: 'test',
  PORT: String(SERVER_PORT),
  PUBLIC_BASE_URL: `http://localhost:${SERVER_PORT}`,
  DATABASE_URL: `file:${databaseFile}`,
  JWT_SECRET: 'end-to-end-test-secret-0123456789abcdef',
  DISCORD_CLIENT_ID: 'e2e',
  DISCORD_CLIENT_SECRET: 'e2e',
  DISCORD_CALLBACK_URL: `http://localhost:${SERVER_PORT}/api/auth/discord/callback`,
  CHEESE_BASE_URL: `http://127.0.0.1:${MOCK_PORT}`,
  HTTP_USER_AGENT: 'SlotLockCheck/e2e',
  APP_DIST_PATH: join(import.meta.dirname, '..', '..', 'app', 'dist'),
});

await import('../dist/main.js');
