import { expect, test, type Page } from '@playwright/test';

import { ASYNC_CHEESE_TRACKER_ID, loginAs, OWNER } from './support';

test.describe.configure({ mode: 'serial' });

const deleteAsyncRoom = async (page: Page): Promise<void> => {
  await loginAs(page, OWNER);
  const room = await page.request.get('/api/rooms/async');
  if (room.ok()) {
    const { title } = (await room.json()) as { title: string };
    await page.request.delete('/api/rooms/async', { data: { title } });
  }
};

test.beforeAll(async ({ browser }) => {
  const page = await browser.newPage();
  await deleteAsyncRoom(page);
  await page.close();
});

test.afterAll(async ({ browser }) => {
  const page = await browser.newPage();
  await deleteAsyncRoom(page);
  await page.close();
});

test('the owner creates a room without a selected SlotLock slot', async ({ page }) => {
  await loginAs(page, OWNER);
  await page.goto('/rooms/new');
  await page.getByTestId('tracker-input').fill(ASYNC_CHEESE_TRACKER_ID);
  await page.getByTestId('preview-button').click();
  await page.getByTestId('room-title').fill('Async');
  await page.getByTestId('room-slug').fill('async');
  for (const checkbox of await page.locator('fieldset input[type="checkbox"]').all()) {
    await checkbox.uncheck();
  }
  await expect(page.getByTestId('without-slotlock')).toBeVisible();
  await page.getByTestId('create-room-button').click();
  await expect(page).toHaveURL(/\/room\/async$/);
});

test('a room without SlotLock hides the lock functions', async ({ page }) => {
  await loginAs(page, OWNER);
  await page.goto('/');
  await expect(page.getByRole('link', { name: 'Async' })).toBeVisible();
  const asyncRow = page.getByRole('row').filter({ has: page.getByRole('link', { name: 'Async' }) });
  await expect(asyncRow.getByTestId('room-unlocks')).toHaveCount(0);
  await expect(asyncRow.getByTestId('room-checks')).toBeVisible();

  await page.goto('/room/async');
  const roster = page.getByTestId('roster-table');
  await expect(roster).toBeVisible();
  await expect(roster.getByRole('columnheader', { name: 'Lock status' })).toHaveCount(0);
  await expect(roster.getByTestId('inactivity-action').first()).toBeVisible();
  await expect(page.getByTestId('roster-checks')).not.toContainText('locked slots');
  await expect(page.getByRole('link', { name: 'Unlock tree' })).toHaveCount(0);

  await page.goto('/room/async/unlock-tree');
  await expect(page).toHaveURL(/\/room\/async$/);

  await page.goto('/room/async/statistics');
  await expect(page.getByTestId('statistics-unlocked')).toHaveCount(0);
  await expect(page.getByTestId('bar-chart')).toHaveCount(0);
});

test('the setup of a room without SlotLock has no lock tabs and saves the settings', async ({ page }) => {
  await loginAs(page, OWNER);
  await page.goto('/room/async/admin/locks');
  await expect(page.getByTestId('tab-settings')).toBeVisible();
  await expect(page.getByTestId('tab-unlock-times')).toHaveCount(0);
  await expect(page.getByRole('tab', { name: 'Lock assignment' })).toHaveCount(0);
  await page.getByRole('button', { name: 'Save' }).first().click();
  await expect(page.getByText('The settings are saved.')).toBeVisible();
});
