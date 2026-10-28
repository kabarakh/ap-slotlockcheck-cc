import type { Page } from '@playwright/test';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

export const CHEESE_TRACKER_ID = 'AbCdEfGhIjKlMnOpQrStUv';

export const OWNER = { discordId: '100000000000000001', name: 'Alice', username: 'alice_owner' };
export const PLAYER = { discordId: '100000000000000003', name: 'Carol', username: 'carol' };

export async function loginAs(page: Page, user: typeof OWNER): Promise<void> {
  const response = await page.request.post('/api/auth/test-login', { data: user });
  if (!response.ok()) {
    throw new Error(`Test login failed: ${response.status()}`);
  }
}

export async function ensureRoom(page: Page): Promise<void> {
  const existing = await page.request.get('/api/rooms/big-chill');
  if (existing.ok()) {
    return;
  }
  await loginAs(page, OWNER);
  const created = await page.request.post('/api/room-setup', {
    data: { cheeseTrackerId: CHEESE_TRACKER_ID, slug: 'big-chill', title: 'Big Chill', slotLockPositions: [1, 6] },
  });
  if (!created.ok()) {
    throw new Error(`Room setup failed: ${created.status()} ${await created.text()}`);
  }
}

export const multidataFixture = (name: 'big-chill' | 'other-room'): string =>
  fileURLToPath(new URL(`../../server/test/fixtures/multidata-${name}.archipelago`, import.meta.url));

export const generationOutputFixture = (name: 'big-chill' | 'without-multidata'): string =>
  fileURLToPath(new URL(`../../server/test/fixtures/generation-${name}.zip`, import.meta.url));

export async function ensureSeed(page: Page): Promise<void> {
  await ensureRoom(page);
  const room = await page.request.get('/api/rooms/big-chill');
  if (((await room.json()) as { hasSeed: boolean }).hasSeed) {
    return;
  }
  await loginAs(page, OWNER);
  const uploaded = await page.request.post('/api/rooms/big-chill/seed', {
    multipart: {
      file: {
        name: 'AP_1.archipelago',
        mimeType: 'application/octet-stream',
        buffer: readFileSync(multidataFixture('big-chill')),
      },
    },
  });
  if (!uploaded.ok()) {
    throw new Error(`Seed upload failed: ${uploaded.status()} ${await uploaded.text()}`);
  }
}
