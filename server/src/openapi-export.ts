import { writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { NestFactory } from '@nestjs/core';
import type { NestExpressApplication } from '@nestjs/platform-express';

const EXPORT_ENVIRONMENT: Record<string, string> = {
  NODE_ENV: 'development',
  PUBLIC_BASE_URL: 'http://localhost:5173',
  DATABASE_URL: 'file::memory:',
  JWT_SECRET: 'openapi-export-secret-without-meaning-000',
  DISCORD_CLIENT_ID: 'openapi-export',
  DISCORD_CLIENT_SECRET: 'openapi-export',
  DISCORD_CALLBACK_URL: 'http://localhost:5173/api/auth/discord/callback',
  HTTP_USER_AGENT: 'SlotlockTracker/openapi-export',
};

async function exportOpenApi(): Promise<void> {
  Object.assign(process.env, EXPORT_ENVIRONMENT);
  const { AppModule } = await import('./app.module.js');
  const { configureApp, createOpenApiDocument } = await import('./setup-app.js');
  const app = await NestFactory.create<NestExpressApplication>(AppModule, { preview: true, logger: false });
  configureApp(app, false);
  const document = createOpenApiDocument(app);
  writeFileSync(join(import.meta.dirname, '..', 'openapi.json'), `${JSON.stringify(document, null, 2)}\n`);
  await app.close();
}

await exportOpenApi();
