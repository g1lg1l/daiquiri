import { expect, test } from './fixtures';
import { createTask, signUpWithWorkspace } from './helpers';

test('make a task repeat, change the rule and stop it', async ({ page }) => {
  await signUpWithWorkspace(page);
  const row = await createTask(page, 'Send the weekly report');
  await row.focus();
  await page.keyboard.press('Enter');

  await page.getByRole('button', { name: 'Doesn’t repeat' }).click();
  await page.locator('label', { has: page.getByLabel('Monday') }).click();
  await page.locator('label', { has: page.getByLabel('Thursday') }).click();
  await page.getByRole('button', { name: 'Repeat', exact: true }).click();
  const rule = page.getByRole('button', { name: 'Every week on Mon, Thu' });
  await expect(rule).toBeVisible();

  // Saved on the server, which scheduled the next task.
  await page.reload();
  await rule.click();
  await expect(page.getByText(/^Next task on /)).toBeVisible();
  await page.getByText('After completion').click();
  await page.getByRole('spinbutton', { name: 'After' }).fill('3');
  await page.getByLabel('Unit').selectOption('day');
  await page.getByRole('button', { name: 'Save' }).click();
  await expect(page.getByRole('button', { name: '3 days after completion' })).toBeVisible();

  await page.goBack();
  await expect(
    page
      .getByRole('row')
      .filter({ hasText: 'Send the weekly report' })
      .getByRole('img', { name: 'Repeats' }),
  ).toBeVisible();
  await page.goForward();
  await page.getByRole('button', { name: '3 days after completion' }).click();
  await page.getByRole('button', { name: 'Stop repeating' }).click();
  await expect(page.getByRole('button', { name: 'Doesn’t repeat' })).toBeVisible();
});
