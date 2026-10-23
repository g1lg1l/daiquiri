import { expect, test } from '@playwright/test';
import { createTask, signUpWithWorkspace } from './helpers';

test('time a task, log time by hand and see the total', async ({ page }) => {
  const { slug } = await signUpWithWorkspace(page);
  await page.goto(`/${slug}/settings/teams/ENG`);
  const module = page.getByRole('checkbox', { name: 'Time tracking' });
  await module.click();
  await expect(module).toBeChecked();

  await page.goto(`/${slug}/team/ENG/tasks`);
  await expect(page.getByRole('heading', { name: 'Engineering' })).toBeVisible();
  const row = await createTask(page, 'Write the quarterly report');
  await row.focus();
  await page.keyboard.press('Enter');

  // The running timer follows you around the app.
  await page.getByRole('button', { name: 'Start timer' }).click();
  const pill = page.getByRole('region', { name: /^Timer running on ENG-\d+$/ });
  await expect(pill).toContainText('Write the quarterly report');
  await expect(pill).toContainText(/00:00:0[1-9]/);
  await pill.getByRole('button', { name: 'Stop timer' }).click();
  await expect(pill).toBeHidden();

  await page.getByRole('button', { name: 'Log time' }).click();
  await page.getByLabel('Duration').fill('1h 30m');
  await page.getByLabel('Note').fill('First draft');
  await page.getByRole('button', { name: 'Log', exact: true }).click();
  await expect(page.getByLabel('Total 1h 30m')).toBeVisible();
  await expect(page.getByRole('listitem').filter({ hasText: 'First draft' })).toContainText(
    '1h 30m',
  );

  // Stored, not just optimistic.
  await page.reload();
  await expect(page.getByLabel('Total 1h 30m')).toBeVisible();
});
