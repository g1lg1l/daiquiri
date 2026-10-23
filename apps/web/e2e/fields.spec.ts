import { expect, test } from './fixtures';
import { createTask, signUpWithWorkspace } from './helpers';

test('define a custom field, turn it on for a team, set, group and filter by it', async ({
  page,
}) => {
  const { slug } = await signUpWithWorkspace(page);

  await page.goto(`/${slug}/settings/fields`);
  await page.getByLabel('New field').fill('Severity');
  await page.getByLabel('Type').click();
  await page.getByRole('option', { name: 'Select', exact: true }).click();
  await page.getByLabel('Options, one per line').fill('Minor\nMajor\nCritical');
  await page.getByRole('button', { name: 'Add field' }).click();
  await expect(page.getByText('Not used by any team')).toBeVisible();

  await page.goto(`/${slug}/settings/teams/ENG`);
  // The optimistic update lands a tick after the click, so assert the outcome.
  const toggle = page.getByRole('checkbox', { name: /Severity/ });
  await toggle.click();
  await expect(toggle).toBeChecked();
  await page.goto(`/${slug}/settings/fields`);
  await expect(page.getByText('Used by Engineering')).toBeVisible();

  await page.goto(`/${slug}/team/ENG/tasks`);
  await expect(page.getByRole('heading', { name: 'Engineering' })).toBeVisible();
  await createTask(page, 'Login is down');
  const quiet = await createTask(page, 'Typo in footer');
  await page.getByRole('row').filter({ hasText: 'Login is down' }).focus();
  await page.keyboard.press('Enter');
  await page.getByRole('button', { name: 'Severity: empty' }).click();
  await page.getByRole('option', { name: 'Critical' }).click();
  await expect(page.getByRole('button', { name: 'Severity: Critical' })).toBeVisible();
  // Saved on the server, not only in the cache.
  await page.reload();
  await expect(page.getByRole('button', { name: 'Severity: Critical' })).toBeVisible();
  await page.goBack();

  await page.getByRole('button', { name: 'Display' }).click();
  await page.getByRole('menuitemradio', { name: 'Severity' }).click();
  await page.keyboard.press('Escape');
  await expect(page.getByRole('button', { name: 'Collapse Critical' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Collapse No Severity' })).toBeVisible();

  await page.getByRole('button', { name: 'Filter' }).click();
  await page.getByRole('menuitem', { name: 'Severity' }).click();
  await page.getByRole('menuitemcheckbox', { name: 'Critical' }).click();
  await page.keyboard.press('Escape');
  await expect(page.getByRole('row').filter({ hasText: 'Login is down' })).toBeVisible();
  await expect(quiet).toBeHidden();
});
