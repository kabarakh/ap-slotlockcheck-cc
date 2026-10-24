import { expect, test, type Locator } from '@playwright/test';
import { CHEESE_TRACKER_ID, ensureRoom, loginAs, OWNER, PLAYER } from './support';

test.describe.configure({ mode: 'serial' });

const SLOT_NAME_COLUMN = 2;

const row = (table: Locator, slotName: string): Locator =>
  table.locator('tbody tr').filter({
    has: table.page().locator(`td:nth-child(${SLOT_NAME_COLUMN})`, { hasText: new RegExp(`^${slotName}$`) }),
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

test('a visitor sees the room list and the roster', async ({ page }) => {
  await ensureRoom(page);
  await page.context().clearCookies();
  await page.goto('/');
  await page.getByRole('link', { name: 'Big Chill' }).click();
  const roster = page.getByTestId('roster-table');
  await expect(row(roster, 'Alice')).toContainText('Unlocked');
  await expect(row(roster, 'Bob')).toContainText('Locked');
  await expect(row(roster, 'Carol')).toContainText('Partially unlocked');
  await expect(row(roster, 'Locker2')).toHaveCount(0);
  await expect(page.getByTestId('sync-now')).toHaveCount(0);
  await expect(page.getByRole('link', { name: 'Admin' })).toHaveCount(0);
});

test('the roster filter reduces the rows', async ({ page }) => {
  await ensureRoom(page);
  await page.goto('/room/big-chill');
  await page.getByTestId('roster-search').fill('factorio');
  const roster = page.getByTestId('roster-table');
  await expect(row(roster, 'Dave')).toBeVisible();
  await expect(row(roster, 'Alice')).toHaveCount(0);
  await page.getByTestId('roster-search').fill('');
});

test('players and statistics show the summaries', async ({ page }) => {
  await ensureRoom(page);
  await page.goto('/room/big-chill/players');
  await expect(page.getByTestId('players-table').getByRole('row', { name: /carol/ })).toBeVisible();
  await page.goto('/room/big-chill/statistics');
  await expect(page.getByTestId('statistics')).toContainText('1 / 4');
});

test('a player sees the own slots', async ({ page }) => {
  await ensureRoom(page);
  await loginAs(page, PLAYER);
  await page.goto('/room/big-chill/my-slots');
  const table = page.getByTestId('my-slots-table');
  await expect(row(table, 'Carol')).toBeVisible();
  await expect(row(table, 'Alice')).toHaveCount(0);
});

test('an admin gives a warning and the roster shows it live', async ({ page, browser }) => {
  await ensureRoom(page);
  const visitor = await browser.newPage();
  await visitor.goto('/room/big-chill');
  await expect(visitor.getByTestId('live-indicator')).toHaveText('Live');

  await loginAs(page, OWNER);
  await page.goto('/room/big-chill/admin');
  await page.getByTestId('tab-warnings').click();
  await page.getByTestId('add-warning').click();
  await page.getByTestId('warning-slot').click();
  await page.getByRole('option', { name: /Dave/ }).click();
  await page.getByTestId('warning-text').fill('No activity');
  await page.getByTestId('save-warning').click();
  await expect(page.getByTestId('warnings-table')).toContainText('No activity');

  await expect(row(visitor.getByTestId('roster-table'), 'Dave')).toContainText('1');
  await visitor.close();
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
