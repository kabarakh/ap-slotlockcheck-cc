import { expect, test, type Locator } from '@playwright/test';

import { CHEESE_TRACKER_ID, ensureRoom, loginAs, OWNER, PLAYER } from './support';

test.describe.configure({ mode: 'serial' });

const SLOT_NAME_COLUMN = 2;

const row = (table: Locator, slotName: string): Locator =>
  table.locator('tbody tr').filter({
    has: table.page().locator(`td:nth-child(${SLOT_NAME_COLUMN})`).getByText(slotName, { exact: true }),
  });

test('the owner creates a room with the setup form', async ({ page }) => {
  await loginAs(page, OWNER);
  await page.goto('/rooms/new');
  await page.getByTestId('tracker-input').fill(`https://cheese.example/tracker/${CHEESE_TRACKER_ID}`);
  await page.getByTestId('preview-button').click();
  await expect(page.getByText('confirmed through your claimed slot')).toBeVisible();
  await page.getByTestId('room-title').fill('Big Chill');
  await page.getByTestId('room-slug').fill('big-chill');
  await page.getByTestId('create-room-button').click();
  await expect(page).toHaveURL(/\/room\/big-chill$/);
  await expect(page.getByTestId('room-title')).toHaveText('Big Chill');
});

test('the room list shows only the own rooms', async ({ page }) => {
  await ensureRoom(page);
  await loginAs(page, OWNER);
  await page.goto('/');
  await expect(page.getByRole('link', { name: 'Big Chill' })).toBeVisible();
  await expect(page.getByTestId('room-role')).toHaveText('Owner');
  await expect(page.getByTestId('room-unlocks')).toContainText('1/4 (25 %)');
  await expect(page.getByTestId('room-checks')).toContainText('201/752 (26.7 %)');
  await expect(page).toHaveTitle('SlotLockCheck');
  await page.getByRole('link', { name: 'Big Chill' }).click();
  await expect(page).toHaveTitle('Big Chill - SlotLockCheck');
  await page.getByRole('link', { name: 'Rooms', exact: true }).click();
  await expect(page).toHaveTitle('SlotLockCheck');
  await page.context().clearCookies();
  await page.goto('/');
  await expect(page.getByTestId('rooms-hint')).toContainText('Log in with Discord');
  await expect(page.getByRole('link', { name: 'Big Chill' })).toHaveCount(0);
});

test('a visitor opens a room with its link and sees the roster', async ({ page }) => {
  await ensureRoom(page);
  await page.context().clearCookies();
  await page.goto('/room/big-chill');
  await expect(page).toHaveTitle('Big Chill - SlotLockCheck');
  const roster = page.getByTestId('roster-table');
  await expect(row(roster, 'Alice')).toContainText('Unlocked');
  await expect(row(roster, 'Bob')).toContainText('Locked');
  await expect(row(roster, 'Carol')).toContainText('Partially unlocked');
  await expect(page.getByTestId('roster-checks')).toContainText('Checks: 201 of 752');
  await expect(row(roster, 'Locker2')).toHaveCount(0);
  await expect(page.getByTestId('sync-now')).toHaveCount(0);
  await expect(page.getByRole('link', { name: 'Setup' })).toHaveCount(0);
  await expect(page.getByRole('link', { name: 'Game control' })).toHaveCount(0);
});

test('the roster filter reduces the rows', async ({ page }) => {
  await ensureRoom(page);
  await page.goto('/room/big-chill');
  await page.getByTestId('roster-search').fill('factorio');
  const roster = page.getByTestId('roster-table');
  await expect(row(roster, 'Davey (Dave)')).toBeVisible();
  await expect(row(roster, 'Alice')).toHaveCount(0);
  await page.getByTestId('roster-search').fill('');
});

test('players and statistics show the summaries', async ({ page }) => {
  await ensureRoom(page);
  await page.goto('/room/big-chill/players');
  await expect(page.getByTestId('players-table').getByRole('row', { name: /carol/ })).toBeVisible();
  await page.goto('/room/big-chill/statistics');
  await expect(page.getByTestId('statistics')).toContainText('1 / 4');
  await expect(page.getByTestId('statistics-checks')).toContainText('201 / 752');
  await expect(page.getByTestId('statistics-checks').getByTestId('donut-chart')).toBeVisible();
  await expect(page.getByTestId('bar-chart')).toHaveCount(2);
});

test('an admin sees the slots without Discord user and the extra statistics', async ({ page }) => {
  await ensureRoom(page);
  await loginAs(page, OWNER);
  await page.goto('/room/big-chill/statistics');
  await expect(page.getByTestId('slots-without-discord')).toContainText('Davey (Dave)');
  await expect(page.getByTestId('players-by-unlocked')).toBeVisible();
  await page.goto('/room/big-chill/players');
  await expect(page.getByTestId('players-table')).toContainText('Carol');
});

test('the unlock tree shows who unlocked which slot', async ({ page }) => {
  await ensureRoom(page);
  await page.goto('/room/big-chill');
  await page.getByRole('link', { name: 'Unlock tree' }).click();
  const tree = page.getByTestId('unlock-tree');
  await expect(tree.locator('[data-slot-name="Locker"]')).toBeVisible();
  await expect(tree.locator('[data-slot-name="Alice"]')).toBeVisible();
  await expect(tree.locator('[data-slot-name="Bob"]')).toHaveCount(0);
  await expect(page.getByText('slots are still locked')).toBeVisible();
});

test('a player sees the own slots', async ({ page }) => {
  await ensureRoom(page);
  await loginAs(page, PLAYER);
  await page.goto('/room/big-chill/my-slots');
  const table = page.getByTestId('my-slots-table');
  await expect(row(table, 'Carol')).toBeVisible();
  await expect(row(table, 'Alice')).toHaveCount(0);
});

test('an admin gives a warning that only admins see', async ({ page, browser }) => {
  await ensureRoom(page);
  const admin = await browser.newPage();
  await loginAs(admin, OWNER);
  await admin.goto('/room/big-chill');
  await expect(admin.getByTestId('live-indicator')).toHaveText('Live');

  await loginAs(page, OWNER);
  await page.goto('/room/big-chill/control/warnings');
  await page.getByTestId('add-warning').click();
  await page.getByTestId('warning-slot').click();
  await page.getByRole('option', { name: /Dave/ }).click();
  await page.getByTestId('warning-text').fill('No activity');
  await page.getByTestId('save-warning').click();
  await expect(page.getByTestId('warnings-table')).toContainText('No activity');

  const adminRoster = admin.getByTestId('roster-table');
  await expect(row(adminRoster, 'Davey (Dave)').getByTestId('warning-badge')).toHaveText('1');
  await admin.close();

  const visitor = await browser.newPage();
  await visitor.goto('/room/big-chill');
  await expect(visitor.getByTestId('roster-table').getByTestId('warning-badge')).toHaveCount(0);
  await visitor.goto('/room/big-chill/players');
  await expect(visitor.getByTestId('players-table').getByRole('columnheader', { name: 'Warnings' })).toHaveCount(0);
  await visitor.close();
});

test('an admin opens the slot menu from the inactivity in the roster', async ({ page }) => {
  await ensureRoom(page);
  await loginAs(page, OWNER);
  await page.goto('/room/big-chill');
  await row(page.getByTestId('roster-table'), 'Alice').getByTestId('inactivity-action').click();
  const menu = page.getByTestId('slot-menu');
  await expect(menu).toContainText('Copy inactivity reminder');
  await menu.getByText('Give warning').click();
  await expect(page.getByTestId('warning-slot')).toContainText('Alice');
});

test('an invitation link makes a guest admin', async ({ page, browser }) => {
  await ensureRoom(page);
  await loginAs(page, OWNER);
  await page.goto('/room/big-chill/admin');
  await page.getByRole('tab', { name: 'Admins' }).click();
  await page.getByRole('button', { name: 'Make invitation link' }).click();
  const url = await page.getByTestId('invitation-url').inputValue();

  const guest = await browser.newPage();
  await loginAs(guest, { discordId: '100000000000000077', name: 'Guest', username: 'guest' });
  await guest.goto(new URL(url).pathname);
  await expect(guest).toHaveURL(/\/room\/big-chill\/admin$/);
  await expect(guest.getByRole('tab', { name: 'Lock assignment' })).toBeVisible();
  await guest.close();
});

test('the language switch changes the texts', async ({ page }) => {
  await ensureRoom(page);
  await page.goto('/');
  await page.getByTestId('locale-select').click();
  await page.getByRole('option', { name: 'Deutsch' }).click();
  await expect(page.getByRole('heading', { name: 'Räume' })).toBeVisible();
  await page.getByTestId('locale-select').click();
  await page.getByRole('option', { name: 'English' }).click();
});
