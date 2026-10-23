import { readFile } from 'node:fs/promises';
import { expect, test } from './fixtures';
import { createTask, signUpWithWorkspace } from './helpers';

test('chart a view and export its tasks', async ({ page }) => {
  await signUpWithWorkspace(page);
  await createTask(page, 'Draft the launch post');
  await createTask(page, '=SUM(A1:A9) looks like a formula');

  const insights = page.getByRole('radio', { name: 'Insights' });
  await page.locator('label', { has: insights }).click();
  await expect(insights).toBeChecked();
  const open = page.getByRole('definition').filter({ hasText: /^\d+$/ }).first();
  await expect(open).toHaveText('2');
  await expect(page.getByRole('region', { name: 'Throughput' })).toBeVisible();
  // Two tasks created this week, in the accessible table behind the chart.
  await expect(
    page
      .getByRole('table', { name: 'Tasks created and completed per week' })
      .getByRole('row')
      .last(),
  ).toContainText('2');
  await expect(
    page.getByRole('region', { name: 'Time in status' }).getByRole('listitem'),
  ).toHaveCount(1);

  // Filters apply to the charts like to any other layout.
  await page.getByRole('button', { name: 'Filter', exact: true }).click();
  await page.getByRole('menuitem', { name: 'Priority' }).focus();
  await page.keyboard.press('ArrowRight');
  await page.getByRole('menuitemcheckbox', { name: 'Urgent' }).click();
  // Close the submenu, then the menu.
  await page.keyboard.press('Escape');
  await page.keyboard.press('Escape');
  await expect(page.getByRole('menu')).toHaveCount(0);
  await expect(page.getByText('No tasks match this view.')).toBeVisible();
  await page.getByRole('button', { name: 'Remove filter Priority: Urgent' }).click();
  await expect(open).toHaveText('2');

  await page.getByRole('button', { name: 'Display' }).click();
  const [download] = await Promise.all([
    page.waitForEvent('download'),
    page.getByRole('menuitem', { name: 'CSV' }).click(),
  ]);
  expect(download.suggestedFilename()).toMatch(/engineering-\d{4}-\d{2}-\d{2}\.csv$/);
  const csv = await readFile((await download.path()) ?? '', 'utf8');
  const [header, ...lines] = csv.split('\r\n');
  expect(header).toContain('ID,Title,Status,Priority');
  expect(lines).toHaveLength(2);
  // Spreadsheet formulas are neutralised.
  expect(csv).toContain("'=SUM(A1:A9) looks like a formula");
});
