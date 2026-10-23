import { expect, test } from '@playwright/test';
import { createTask, PASSWORD, signUpWithWorkspace } from './helpers';

test('changes in one session reach another without reloading', async ({ browser, page }) => {
  const { email, slug } = await signUpWithWorkspace(page);

  const otherContext = await browser.newContext();
  const other = await otherContext.newPage();
  await other.goto('/login');
  await other.getByLabel('Email').fill(email);
  await other.getByLabel('Password').fill(PASSWORD);
  await other.getByRole('button', { name: 'Sign in' }).click();
  await other.waitForURL(new RegExp(`/${slug}/`));
  await other.goto(`/${slug}/team/ENG/tasks`);
  await expect(other.getByRole('heading', { name: 'Engineering' })).toBeVisible();

  const row = await createTask(page, 'Arrives by realtime');
  const otherRow = other.getByRole('row').filter({ hasText: 'Arrives by realtime' });
  await expect(otherRow).toBeVisible({ timeout: 15_000 });

  await row.focus();
  await page.keyboard.press('s');
  await page.getByPlaceholder('Change status to…').fill('In Progress');
  await page.keyboard.press('Enter');
  await expect(otherRow.getByLabel('Status: In Progress')).toBeVisible({ timeout: 15_000 });

  await otherContext.close();
});
