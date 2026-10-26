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
