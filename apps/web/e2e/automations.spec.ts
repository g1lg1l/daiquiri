import { expect, test } from './fixtures';
import { createTask, signUpWithWorkspace } from './helpers';

test('an automation changes new tasks and logs its runs', async ({ page }) => {
  test.slow(); // The runner is a pg_cron job that drains its queue every ten seconds.
  const { slug } = await signUpWithWorkspace(page);

  await page.goto(`/${slug}/team/ENG/automations`);
  await page.getByRole('button', { name: 'New automation' }).click();
  await page.getByLabel('Name').fill('Prioritize new work');
  await page.getByRole('button', { name: 'Action 1: Assign' }).click();
  await page.getByRole('option', { name: 'Set priority' }).click();
  await expect(page.getByRole('button', { name: 'Priority: High' })).toBeVisible();
  await page.getByRole('button', { name: 'Create automation' }).click();
  const automation = page.getByRole('listitem', { name: 'Prioritize new work' });
  await expect(automation).toContainText('When a task is created, set priority to High.');

  await page.goto(`/${slug}/team/ENG/tasks`);
  await expect(page.getByRole('heading', { name: 'Engineering' })).toBeVisible();
  const row = await createTask(page, 'Ship the beta');
  await row.focus();
  await page.keyboard.press('Enter');
  // The change arrives over realtime, credited to the automation.
  await expect(page.getByText('Automation “Prioritize new work”')).toBeVisible({ timeout: 30_000 });
  await expect(page.getByRole('button', { name: /High/ }).first()).toBeVisible();

  await page.goto(`/${slug}/team/ENG/automations`);
  await automation.getByRole('button', { name: 'Runs' }).click();
  const runs = page.getByRole('region', { name: 'Runs of Prioritize new work' });
  await expect(runs.getByRole('link', { name: /Ship the beta/ })).toBeVisible();
  await expect(runs.getByLabel('Succeeded')).toBeVisible();

  // Turned off, it stops running.
  await automation.getByRole('switch', { name: 'Run Prioritize new work' }).click();
  await expect(automation.getByRole('switch')).not.toBeChecked();
});
