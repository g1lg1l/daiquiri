import { expect, test } from './fixtures';
import { signUpWithWorkspace } from './helpers';

test('turn on weekly update reminders for a project', async ({ page }) => {
  const { slug } = await signUpWithWorkspace(page);
  await page.goto(`/${slug}/team/ENG/projects`);
  await page.getByRole('button', { name: 'New project' }).click();
  await page.getByRole('dialog').getByLabel('Name').fill('Launch');
  await page.getByRole('button', { name: 'Create project' }).click();
  await page.getByRole('link', { name: /Launch/ }).click();

  const reminder = page.getByLabel('Remind the lead to post an update');
  await expect(reminder).toHaveValue('');
  await reminder.selectOption({ label: 'Fridays' });
  // Stored, not just optimistic.
  await page.reload();
  await expect(page.getByLabel('Remind the lead to post an update')).toHaveValue('5');
});
