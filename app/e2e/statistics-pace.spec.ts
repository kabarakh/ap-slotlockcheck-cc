import { expect, test } from '@playwright/test';

import { ensureRoom, loginAs, OWNER, PLAYER } from './support';

test.describe.configure({ mode: 'serial' });

test('an admin opens the pace statistics and the timeline of a slot', async ({ page }) => {
  await ensureRoom(page);
  await loginAs(page, OWNER);
  await page.goto('/room/big-chill/control');
  await page.getByTestId('control-tab-pace').click();
  await expect(page).toHaveURL(/control\/pace$/);
  const table = page.getByTestId('slot-pace-table');
  await expect(table).toContainText('A Link to the Past');
  await table.getByRole('button', { name: 'Alice' }).click();
  const drawer = page.getByTestId('pace-timeline-drawer');
  await expect(drawer).toContainText('Timeline of Alice');
  await expect(drawer.getByTestId('pace-timeline-row')).toContainText('alice_owner');
  await expect(drawer.getByTestId('pace-timeline-segments').locator('[data-kind="bulk"]')).toHaveCount(1);
  await expect(drawer.getByTestId('pace-timeline-highlight')).toHaveCount(1);
  await expect(drawer.getByTestId('pace-timeline-legend')).toContainText('BK period');
});

test('an admin helper sees the pace statistics', async ({ page }) => {
  await ensureRoom(page);
  await loginAs(page, PLAYER);
  await loginAs(page, OWNER);
  const added = await page.request.post('/api/rooms/big-chill/admins', {
    data: { discordId: PLAYER.discordId, role: 'helper' },
  });
  expect(added.ok()).toBe(true);
  const admins = (await added.json()) as { userId: number; discordId: string }[];
  const helper = admins.find((admin) => admin.discordId === PLAYER.discordId);

  await loginAs(page, PLAYER);
  await page.goto('/room/big-chill/control');
  await page.getByTestId('control-tab-pace').click();
  await expect(page.getByTestId('slot-pace-table')).toContainText('Alice');

  await loginAs(page, OWNER);
  const removed = await page.request.delete(`/api/rooms/big-chill/admins/${helper?.userId}`);
  expect(removed.ok()).toBe(true);
});

test('a player does not see the pace statistics', async ({ page }) => {
  await ensureRoom(page);
  await loginAs(page, PLAYER);
  await page.goto('/room/big-chill/control/pace');
  await expect(page).not.toHaveURL(/control/);
  await expect(page.getByTestId('control-tab-pace')).toHaveCount(0);
  await expect(page.getByTestId('slot-pace-table')).toHaveCount(0);
});
