import { mkdtempSync, readdirSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import Database from 'better-sqlite3';
import type { INestApplication } from '@nestjs/common';
import type { NestExpressApplication } from '@nestjs/platform-express';
import { Test } from '@nestjs/testing';
import { loadFixture, type FixtureName } from '../fixtures/fixtures.js';

const MIGRATIONS_PATH = join(import.meta.dirname, '..', '..', 'prisma', 'migrations');

const FIXTURE_ROUTES: [RegExp, FixtureName][] = [
  [/\/api\/tracker\/[^/]+\/checks_history$/, 'cheese-checks-history'],
  [/^https:\/\/cheese\.test\/api\/tracker\/[^/]+$/, 'cheese-tracker'],
  [/\/api\/room_status\//, 'ap-room-status'],
  [/\/api\/static_tracker\//, 'ap-static-tracker'],
  [/\/api\/slot_data_tracker\//, 'ap-slot-data'],
  [/\/api\/datapackage\//, 'ap-datapackage-slotlock'],
  [/^https:\/\/archipelago\.gg\/api\/tracker\//, 'ap-tracker'],
];

export interface TestApp {
  app: INestApplication;
  fixtureOverrides: Map<FixtureName, unknown>;
  close(): Promise<void>;
}

function applyMigrations(databaseFile: string): void {
  const database = new Database(databaseFile);
  for (const migration of readdirSync(MIGRATIONS_PATH)
    .filter((entry) => !entry.endsWith('.toml'))
    .sort()) {
    database.exec(readFileSync(join(MIGRATIONS_PATH, migration, 'migration.sql'), 'utf8'));
  }
  database.close();
}

export async function createTestApp(): Promise<TestApp> {
  const directory = mkdtempSync(join(tmpdir(), 'slotlock-test-'));
  const databaseFile = join(directory, 'test.db');
  applyMigrations(databaseFile);
  Object.assign(process.env, {
    NODE_ENV: 'test',
    PUBLIC_BASE_URL: 'http://localhost:5173',
    DATABASE_URL: `file:${databaseFile}`,
    JWT_SECRET: 'integration-test-secret-0123456789abcdef',
    DISCORD_CLIENT_ID: 'test',
    DISCORD_CLIENT_SECRET: 'test',
    DISCORD_CALLBACK_URL: 'http://localhost:5173/api/auth/discord/callback',
    CHEESE_BASE_URL: 'https://cheese.test',
    HTTP_USER_AGENT: 'SlotlockTracker/test',
    APP_DIST_PATH: directory,
  });

  const fixtureOverrides = new Map<FixtureName, unknown>();
  vi.stubGlobal(
    'fetch',
    vi.fn((input: string | URL) => {
      const url = input.toString();
      const route = FIXTURE_ROUTES.find(([pattern]) => pattern.test(url));
      if (!route) {
        return Promise.resolve(new Response('not found', { status: 404 }));
      }
      const body = fixtureOverrides.get(route[1]) ?? loadFixture(route[1]);
      return Promise.resolve(new Response(JSON.stringify(body), { status: 200 }));
    }),
  );

  const { AppModule } = await import('../../src/app.module.js');
  const { configureApp } = await import('../../src/setup-app.js');
  const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();
  const app = moduleRef.createNestApplication<NestExpressApplication>({ logger: false });
  configureApp(app, false);
  await app.init();

  return {
    app,
    fixtureOverrides,
    close: async () => {
      await app.close();
      vi.unstubAllGlobals();
      rmSync(directory, { recursive: true, force: true });
    },
  };
}
