import { expect, test } from '@playwright/test';
import { ensureRoom, ensureSeed, loginAs, multidataFixture, OWNER, PLAYER } from './support';

test.describe.configure({ mode: 'serial' });

test('the admin uploads the multidata file only one time', async ({ page }) => {
  await ensureRoom(page);
  await loginAs(page, OWNER);
  await page.goto('/room/big-chill/admin');
  await page.getByTestId('tab-seed').click();
  await page.getByTestId('seed-file').setInputFiles(multidataFixture('other-room'));
  await expect(page.getByTestId('seed-differences')).toContainText('Alicia');
  await page.getByTestId('seed-file').setInputFiles(multidataFixture('big-chill'));
  await expect(page.getByTestId('seed-data')).toContainText('12345678901234567890');
  await expect(page.getByTestId('seed-file')).toHaveCount(0);
});

test('the seed data stays after a reload', async ({ page }) => {
  await ensureSeed(page);
  await loginAs(page, OWNER);
  await page.goto('/room/big-chill/admin');
  await page.getByTestId('tab-seed').click();
  await expect(page.getByTestId('seed-data')).toContainText('0.6.8');
});

test('a player sees the sphere overview and the open locations up to the limit', async ({ page }) => {
  await ensureSeed(page);
  await loginAs(page, PLAYER);
  await page.goto('/room/big-chill');
  await page.getByRole('link', { name: 'Spheres' }).click();
  await expect(page.getByTestId('sphere-summary')).toContainText('lowest sphere with open locations is 0');
  await expect(page.getByTestId('sphere-table').locator('tbody tr')).toHaveCount(1);
  await page.getByRole('link', { name: 'Locations' }).click();
  const table = page.getByTestId('location-table');
  await expect(table).toContainText('Salubra_(Requires_Charms)');
  await expect(table.getByRole('columnheader', { name: 'Item' })).toHaveCount(0);
  await expect(page.getByTestId('location-view-switch')).toHaveCount(0);
});

test('an admin switches to the admin view and filters by item type', async ({ page }) => {
  await ensureSeed(page);
  await loginAs(page, OWNER);
  await page.goto('/room/big-chill/locations/open');
  await page.getByTestId('location-view-switch').click();
  await expect(page).toHaveURL(/view=admin/);
  const table = page.getByTestId('location-table');
  await expect(table.getByRole('columnheader', { name: 'Item' })).toBeVisible();
  await page.getByTestId('location-item-types').click();
  await page.getByRole('option', { name: 'Trap' }).click();
  await page.keyboard.press('Escape');
  await page.getByTestId('apply-filters').click();
  await expect(table.locator('tbody tr')).toHaveCount(1);
  await expect(table).toContainText('Evolution Trap');
  await page.getByTestId('location-tab-found').click();
  await expect(page).toHaveURL(/locations\/found\?view=admin/);
});

test('a visitor sees the locations only with the room setting', async ({ page }) => {
  await ensureSeed(page);
  await page.context().clearCookies();
  await page.goto('/room/big-chill');
  await expect(page.getByRole('link', { name: 'Spheres' })).toHaveCount(0);
  await loginAs(page, OWNER);
  await page.goto('/room/big-chill/admin');
  await page.getByTestId('tab-seed').click();
  await page.getByTestId('visitors-see-locations').click();
  await page.getByTestId('save-sphere-settings').click();
  await expect(page.getByText('The settings are saved.')).toBeVisible();
  await page.context().clearCookies();
  await page.goto('/room/big-chill/locations/open');
  await expect(page.getByTestId('location-table')).toContainText('Salubra_(Requires_Charms)');
});

test('a player marks an own location as filler and the admin sees who marked it', async ({ page }) => {
  await ensureSeed(page);
  await loginAs(page, OWNER);
  await page.goto('/room/big-chill/admin');
  await page.getByTestId('tab-seed').click();
  await page.getByTestId('sphere-offset').locator('input').fill('2');
  await page.getByTestId('players-mark-filler').click();
  await page.getByTestId('save-sphere-settings').click();
  await expect(page.getByText('The settings are saved.')).toBeVisible();

  await loginAs(page, PLAYER);
  await page.goto('/room/big-chill/locations/open');
  const row = page.getByTestId('location-table').locator('tbody tr').filter({ hasText: 'Old Site: Strawberry 2' });
  await row.getByTestId('mark-filler').click();
  await expect(row.getByTestId('unmark-filler')).toBeVisible();
  const foreignRow = page.getByTestId('location-table').locator('tbody tr').filter({ hasText: 'Salubra' });
  await expect(foreignRow.getByTestId('mark-filler')).toHaveCount(0);

  await loginAs(page, OWNER);
  await page.goto('/room/big-chill/locations/filler?view=admin');
  await expect(page.getByTestId('location-table')).toContainText('Old Site: Strawberry 2');
  await expect(page.getByTestId('location-table')).toContainText('Carol');
});

test('an admin makes a player an admin helper', async ({ page }) => {
  await ensureSeed(page);
  await loginAs(page, OWNER);
  await page.goto('/room/big-chill/admin');
  await page.getByRole('tab', { name: 'Admins' }).click();
  await page.getByRole('combobox', { name: 'Select a player' }).click();
  await page.getByRole('option', { name: 'Carol' }).click();
  await page.getByTestId('new-admin-role').click();
  await page.getByRole('option', { name: 'Admin helper' }).click();
  await page.getByRole('button', { name: 'Make admin' }).click();
  await expect(page.getByTestId('admins-table')).toContainText('Admin helper');

  await loginAs(page, PLAYER);
  await page.goto('/room/big-chill/locations/open');
  await page.getByTestId('location-view-switch').click();
  await expect(page.getByTestId('location-table').getByRole('columnheader', { name: 'Item' })).toBeVisible();
  await page.getByRole('link', { name: 'Admin', exact: true }).click();
  await expect(page.getByTestId('tab-settings')).toHaveCount(0);
  await page.getByTestId('cleanup-to').locator('input').fill('3');
  await page.getByTestId('cleanup-create').click();
  const message = page.getByTestId('cleanup-message');
  await expect(message).toHaveCount(1);
  const text = message.locator('textarea');
  await expect(text).toHaveValue(/^# Spheres 0–3\n<@100000000000000001>, Locker: 1 progression/);
  await expect(text).toHaveValue(/\nalice_owner, Alice: 1 progression/);
  await expect(text).toHaveValue(/\n<@100000000000000002>, Bob: 2 progression/);
});
