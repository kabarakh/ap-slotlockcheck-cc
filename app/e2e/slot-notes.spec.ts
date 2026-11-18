import { expect, test } from '@playwright/test';

import { ensureRoom, loginAs, OWNER } from './support';

test.describe.configure({ mode: 'serial' });

test('an admin writes a public and an internal note in the game control', async ({ page }) => {
  await ensureRoom(page);
  await loginAs(page, OWNER);
  await page.goto('/room/big-chill/control/notes');
  const row = page
    .getByTestId('notes-table')
    .locator('tbody tr')
    .filter({ has: page.locator('td:nth-child(2)').getByText('Bob', { exact: true }) });
  await row.getByTestId('edit-notes').click();
  await page.getByTestId('slot-note-public').fill('Away until Friday');
  await page.getByTestId('slot-note-internal').fill('Second reminder sent');
  await page.getByTestId('save-slot-notes').click();
  await expect(row.getByTestId('staff-note-public')).toHaveText('Away until Friday');
  await expect(row.getByTestId('staff-note-internal')).toHaveText('Second reminder sent');
  await page.getByTestId('notes-only-with-notes').click();
  await expect(page.getByTestId('notes-table').locator('tbody tr')).toHaveCount(2);
});

test('the roster shows the internal note only to admins and helpers', async ({ page }) => {
  await loginAs(page, OWNER);
  await page.goto('/room/big-chill');
  const table = page.getByTestId('roster-table');
  await expect(table.getByTestId('staff-note-public')).toHaveText('Away until Friday');
  await expect(table.getByTestId('staff-note-internal')).toHaveText('Second reminder sent');
  await page.context().clearCookies();
  await page.goto('/room/big-chill');
  await expect(table.getByTestId('staff-note-public')).toHaveText('Away until Friday');
  await expect(table.getByTestId('staff-note-internal')).toHaveCount(0);
  await expect(table.getByTestId('edit-notes')).toHaveCount(0);
  await expect(page.getByText('Second reminder sent')).toHaveCount(0);
});
