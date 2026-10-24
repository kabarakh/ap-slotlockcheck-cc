import type { Page } from '@playwright/test';

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
