import { expect, test, type Browser } from '@playwright/test';

import { ASYNC_CHEESE_TRACKER_ID, loginAs, OWNER } from './support';

test.describe.configure({ mode: 'serial' });

const deleteArchiveRoom = async (browser: Browser): Promise<void> => {
  const page = await browser.newPage();
  await loginAs(page, OWNER);
  await page.request.delete('/api/rooms/archive', { data: { title: 'Archive test' } });
  await page.close();
};

test.beforeAll(async ({ browser }) => {
  await deleteArchiveRoom(browser);
  const page = await browser.newPage();
  await loginAs(page, OWNER);
  const created = await page.request.post('/api/room-setup', {
    data: { cheeseTrackerId: ASYNC_CHEESE_TRACKER_ID, slug: 'archive', title: 'Archive test', slotLockPositions: [] },
  });
  expect(created.ok()).toBe(true);
  await page.close();
});

test.afterAll(async ({ browser }) => {
  await deleteArchiveRoom(browser);
});

test('an admin archives a room and the room stops the synchronization', async ({ page }) => {
  await loginAs(page, OWNER);
  await page.goto('/room/archive/admin/room');
  await page.getByTestId('archive-room').click();
  await page.getByTestId('confirm-archive').click();
  await expect(page.getByText('The room is archived.')).toBeVisible();
  await expect(page.getByTestId('archived-tag')).toBeVisible();
  await expect(page.getByTestId('sync-now')).toHaveCount(0);
  await expect(page.getByTestId('reopen-room')).toBeVisible();

  await page.goto('/');
  await expect(page.getByRole('link', { name: 'Archive test' })).toHaveCount(0);
  await page.getByTestId('show-archived-rooms').click();
  const row = page.getByRole('row').filter({ has: page.getByRole('link', { name: 'Archive test' }) });
  await expect(row.getByTestId('room-archived')).toBeVisible();
});

test('an admin reopens an archived room', async ({ page }) => {
  await loginAs(page, OWNER);
  await page.goto('/room/archive/admin/room');
  await page.getByTestId('reopen-room').click();
  await expect(page.getByText('The room is open again.')).toBeVisible();
  await expect(page.getByTestId('archived-tag')).toHaveCount(0);
  await expect(page.getByTestId('sync-now')).toBeVisible();
  await expect(page.getByTestId('archive-room')).toBeVisible();
});
