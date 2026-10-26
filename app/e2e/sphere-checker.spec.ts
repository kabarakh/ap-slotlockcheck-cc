import { expect, test } from '@playwright/test';
import { ensureRoom, ensureSeed, loginAs, multidataFixture, OWNER } from './support';

test.describe.configure({ mode: 'serial' });

test('the admin uploads the multidata file only one time', async ({ page }) => {
  await ensureRoom(page);
  await loginAs(page, OWNER);
  await page.goto('/room/big-chill/admin');
  await page.getByTestId('tab-seed').click();
  const room = await page.request.get('/api/rooms/big-chill');
  if (!((await room.json()) as { hasSeed: boolean }).hasSeed) {
    await page.getByTestId('seed-file').setInputFiles(multidataFixture('other-room'));
    await expect(page.getByTestId('seed-differences')).toContainText('Alicia');
    await page.getByTestId('seed-file').setInputFiles(multidataFixture('big-chill'));
  }
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
