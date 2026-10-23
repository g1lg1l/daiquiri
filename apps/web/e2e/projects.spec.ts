import { expect, test } from '@playwright/test';
import { createTask, signUpWithWorkspace } from './helpers';

test('milestones and project updates', async ({ page }) => {
  const { slug } = await signUpWithWorkspace(page);
  await page.goto(`/${slug}/team/ENG/projects`);
  await page.getByRole('button', { name: 'New project' }).click();
  await page.getByRole('dialog').getByLabel('Name').fill('Website relaunch');
  await page.getByRole('button', { name: 'Create project' }).click();
  await page.getByRole('link', { name: /Website relaunch/ }).click();

  // A milestone, and a task planned into it from the task panel.
  await page.getByRole('button', { name: 'Add a milestone' }).click();
  await page.getByRole('textbox', { name: 'Name' }).fill('Beta');
  await page.getByRole('button', { name: 'Add milestone' }).click();
  await expect(page.getByRole('button', { name: 'Add milestone' })).toBeHidden();
  const milestones = page.getByRole('region', { name: 'Milestones' });
  await expect(milestones.getByRole('article', { name: 'Beta, 0 of 0 done' })).toBeVisible();

  const row = await createTask(page, 'Write the landing page');
  await row.click();
  const preview = page.getByRole('complementary', { name: 'Task preview' });
  await preview.getByRole('button', { name: 'No milestone' }).click();
  await page.getByPlaceholder('Move to milestone…').fill('Beta');
  await page.keyboard.press('Enter');
  await expect(milestones.getByRole('article', { name: 'Beta, 0 of 1 done' })).toBeVisible();

  // A status update sets the project's health.
  await page
    .getByRole('navigation', { name: 'Project' })
    .getByRole('link', { name: 'Updates' })
    .click();
  await page.getByText('At risk', { exact: true }).click();
  await page.getByRole('textbox', { name: 'Update' }).fill('Copy is late; design is done.');
  await page.getByRole('button', { name: 'Post update' }).click();
  const update = page.getByRole('listitem').filter({ hasText: 'Copy is late; design is done.' });
  await expect(update.getByText('At risk')).toBeVisible();

  await page.goto(`/${slug}/team/ENG/projects`);
  await expect(
    page.getByRole('row', { name: /Website relaunch/ }).getByText('At risk'),
  ).toBeVisible();
});
