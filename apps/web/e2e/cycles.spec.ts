import { expect, test } from './fixtures';
import { createTask, signUpWithWorkspace } from './helpers';

test('estimate tasks and plan them into cycles', async ({ page }) => {
  const { slug } = await signUpWithWorkspace(page);

  // Engineering starts from the software template with both modules on; keep them on.
  await page.goto(`/${slug}/settings/teams/ENG`);
  await page.getByLabel('Estimates').check();
  await page.getByLabel('Cycles').check();
  await expect(page.getByLabel('Length')).toHaveText('2 weeks');

  // The database schedules the current cycle and three upcoming ones.
  const sidebar = page.getByRole('navigation', { name: 'Workspace' });
  await sidebar.getByRole('link', { name: 'Cycles' }).click();
  await expect(page.getByRole('heading', { name: 'Current' })).toBeVisible();
  const upcoming = page.getByRole('region', { name: 'Upcoming' });
  await expect(upcoming.getByRole('link')).toHaveCount(3);

  // Estimate and plan a task from the list with the keyboard.
  await sidebar.getByRole('link', { name: 'Tasks', exact: true }).click();
  const row = await createTask(page, 'Ship the cycle page');
  await row.focus();
  await page.keyboard.press('Shift+E');
  await page.getByPlaceholder('Set estimate to…').fill('3 points');
  await page.keyboard.press('Enter');
  await expect(row.getByRole('gridcell', { name: '3' })).toBeVisible();
  await row.focus();
  await page.keyboard.press('Shift+C');
  await page.getByPlaceholder('Move to cycle…').fill('current');
  await page.keyboard.press('Enter');

  // The cycle page lists it, with progress in points.
  await sidebar.getByRole('link', { name: 'Cycles' }).click();
  await page.getByRole('region', { name: 'Current' }).getByRole('link').click();
  await expect(page.getByRole('row').filter({ hasText: 'Ship the cycle page' })).toBeVisible();
  await expect(page.getByText('0 of 3 points completed')).toBeVisible();

  await page.getByRole('button', { name: 'Rename' }).click();
  await page.getByRole('textbox', { name: 'Name' }).fill('Launch');
  await page.keyboard.press('Enter');
  await expect(page.getByRole('heading', { name: /Cycle 1 · Launch/ })).toBeVisible();
});
