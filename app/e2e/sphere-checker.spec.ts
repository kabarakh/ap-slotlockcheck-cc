import { expect, test } from '@playwright/test';

import { ensureRoom, ensureSeed, generationOutputFixture, loginAs, multidataFixture, OWNER, PLAYER } from './support';

test.describe.configure({ mode: 'serial' });

test('the admin uploads the multidata file only one time', async ({ page }) => {
  await ensureRoom(page);
  await loginAs(page, OWNER);
  await page.goto('/room/big-chill/admin');
  await page.getByTestId('tab-seed').click();
  await page.getByTestId('seed-file').setInputFiles(multidataFixture('other-room'));
  await expect(page.getByTestId('seed-differences')).toContainText('Alicia');
  await page.getByTestId('seed-file').setInputFiles(generationOutputFixture('without-multidata'));
  await expect(page.getByText('The ZIP file contains no multidata file')).toBeVisible();
  await page.getByTestId('seed-file').setInputFiles(generationOutputFixture('big-chill'));
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
  await expect(page).toHaveURL(/control\/locations\/open$/);
  const table = page.getByTestId('location-table');
  await expect(table.getByRole('columnheader', { name: 'Item' })).toBeVisible();
  await page.getByTestId('location-item-types').click();
  await page.getByRole('option', { name: 'Trap' }).click();
  await page.keyboard.press('Escape');
  await page.getByTestId('apply-filters').click();
  await expect(table.locator('tbody tr')).toHaveCount(1);
  await expect(table).toContainText('Evolution Trap');
  await page.getByRole('button', { name: 'Reset' }).click();
  await page.getByTestId('location-receivers').click();
  await page.getByRole('option', { name: '#1 Locker', exact: true }).click();
  await page.keyboard.press('Escape');
  await page.getByTestId('apply-filters').click();
  await expect(table.locator('tbody tr').filter({ hasText: 'Unlock Alice' })).toHaveCount(2);
  await page.getByTestId('location-tab-found').click();
  await expect(page).toHaveURL(/control\/locations\/found$/);
});

test('an admin opens the open locations of a sphere and makes the clean-up text', async ({ page }) => {
  await ensureSeed(page);
  await loginAs(page, OWNER);
  await page.goto('/room/big-chill/control');
  await expect(page).toHaveURL(/control\/spheres$/);
  await expect(page.getByTestId('control-badge-sphere')).toHaveText('0');
  await page.getByTestId('sphere-open-0').click();
  const drawer = page.getByTestId('sphere-locations');
  await expect(drawer).toContainText('Sphere 0');
  await expect(drawer.getByTestId('sphere-locations-table')).toContainText('Salubra_(Requires_Charms)');
  await drawer.getByTestId('sphere-cleanup').click();
  await expect(page).toHaveURL(/control\/messages$/);
  await expect(page.getByTestId('cleanup-message').locator('textarea')).toHaveValue(/^# Sphere 0\n/);
});

test('an admin opens a tab of the setup with its URL', async ({ page }) => {
  await ensureSeed(page);
  await loginAs(page, OWNER);
  await page.goto('/room/big-chill/admin/seed');
  await expect(page.getByTestId('seed-data')).toBeVisible();
  await page.getByTestId('tab-unlock-times').click();
  await expect(page).toHaveURL(/admin\/unlockTimes$/);
  await page.goBack();
  await expect(page.getByTestId('seed-data')).toBeVisible();
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
  await expect(row.getByLabel('Marked as filler')).toBeVisible();
  await expect(row.getByTestId('mark-filler')).toHaveCount(0);
  await expect(row.getByTestId('unmark-filler')).toHaveCount(0);
  const foreignRow = page.getByTestId('location-table').locator('tbody tr').filter({ hasText: 'Salubra' });
  await expect(foreignRow.getByTestId('mark-filler')).toHaveCount(0);

  await loginAs(page, OWNER);
  await page.goto('/room/big-chill/control/locations/filler');
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
  await page.getByRole('link', { name: 'Setup', exact: true }).click();
  await expect(page.getByTestId('tab-room')).toBeVisible();
  await expect(page.getByTestId('tab-settings')).toHaveCount(0);
  await page.getByRole('link', { name: 'Game control', exact: true }).click();
  await expect(page.getByTestId('control-tab-warnings')).toHaveCount(0);
  await page.getByTestId('control-tab-messages').click();
  await page.getByTestId('cleanup-to').locator('input').fill('3');
  await page.getByTestId('cleanup-create').click();
  const message = page.getByTestId('cleanup-message');
  await expect(message).toHaveCount(1);
  const text = message.locator('textarea');
  await expect(text).toHaveValue(/^# Spheres 0–3\n<@100000000000000001>, Locker: 1 progression/);
  await expect(text).toHaveValue(/\nalice_owner, Alice: 1 progression/);
  await expect(text).toHaveValue(/\n<@100000000000000002>, Bob: 2 progression/);
});

test('an admin sees the login form of the Archipelago server', async ({ page }) => {
  await ensureSeed(page);
  await loginAs(page, OWNER);
  await page.goto('/room/big-chill/control/server');
  await expect(page.getByText('All players see the admin commands')).toBeVisible();
  await expect(page.getByTestId('server-slot')).toBeVisible();
  await expect(page.getByTestId('server-login')).toBeDisabled();
  await expect(page.getByTestId('release-spheres')).toBeDisabled();
  await page.goto('/room/big-chill/locations/open?view=admin');
  await expect(page).toHaveURL(/control\/locations\/open$/);
  await expect(page.getByTestId('location-server-status')).toContainText('not logged in');
  await expect(page.getByTestId('location-table')).toBeVisible();
  await expect(page.getByTestId('send-location')).toHaveCount(0);
});

test('a helper leaves the room and the owner sees transfer and delete', async ({ page }) => {
  await ensureSeed(page);
  await loginAs(page, PLAYER);
  await page.goto('/room/big-chill/admin');
  await page.getByTestId('tab-room').click();
  await page.getByTestId('leave-room').click();
  await page.getByTestId('confirm-leave').click();
  await expect(page).toHaveURL(/\/room\/big-chill$/);
  await expect(page.getByRole('link', { name: 'Setup', exact: true })).toHaveCount(0);

  await loginAs(page, OWNER);
  await page.goto('/room/big-chill/admin');
  await page.getByTestId('tab-room').click();
  await expect(page.getByTestId('transfer-owner')).toBeDisabled();
  await expect(page.getByTestId('delete-room')).toBeDisabled();
  await page.getByTestId('delete-title').fill('big chill');
  await expect(page.getByTestId('delete-room')).toBeDisabled();
  await page.getByTestId('delete-title').fill('Big Chill');
  await expect(page.getByTestId('delete-room')).toBeEnabled();
});
