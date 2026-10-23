import { expect, test } from './fixtures';
import { createTask, signUpWithWorkspace } from './helpers';

test('save a task and a project as templates and use them', async ({ page }) => {
  const { slug } = await signUpWithWorkspace(page);

  // A task with a sub-task becomes a template.
  const row = await createTask(page, 'Onboard a customer');
  await row.focus();
  await page.keyboard.press('Enter');
  await page.getByRole('button', { name: 'More actions' }).click();
  await page.getByRole('menuitem', { name: 'Add sub-task' }).click();
  await page.getByRole('dialog').getByLabel('Title').fill('Kickoff call');
  await page.keyboard.press('Enter');
  await expect(page.getByRole('link', { name: /Kickoff call/ })).toBeVisible();
  await page.getByRole('button', { name: 'More actions' }).click();
  await page.getByRole('menuitem', { name: 'Save as template' }).click();
  await page.getByLabel('Template name').fill('Onboarding');
  await page.getByRole('button', { name: 'Save template' }).click();
  await expect(page.getByText('Saved template Onboarding')).toBeVisible();

  // The new task dialog creates from it and opens the copy.
  const url = page.url();
  await page.keyboard.press('c');
  await page.getByRole('button', { name: 'From template' }).click();
  await page.getByRole('option', { name: /Onboarding/ }).click();
  await expect(page).not.toHaveURL(url);
  await expect(page.getByRole('textbox', { name: 'Title' })).toHaveValue('Onboard a customer');
  await expect(page.getByRole('link', { name: /Kickoff call/ })).toBeVisible();

  // A project with a milestone becomes a template, and a new project starts from it.
  await page.goto(`/${slug}/team/ENG/projects`);
  await page.getByRole('button', { name: 'New project' }).click();
  await page.getByRole('dialog').getByLabel('Name').fill('Launch');
  await page.getByRole('button', { name: 'Create project' }).click();
  await page.getByRole('link', { name: /Launch/ }).click();
  await page.getByRole('button', { name: 'Add a milestone' }).click();
  await page.getByRole('textbox', { name: 'Name' }).fill('Beta');
  await page.getByRole('button', { name: 'Add milestone' }).click();
  await expect(page.getByRole('button', { name: 'Add milestone' })).toBeHidden();
  await page.getByRole('button', { name: 'Save as template' }).click();
  await page.getByLabel('Template name').fill('Launch plan');
  await page.getByRole('button', { name: 'Save template' }).click();
  await expect(page.getByText('Saved template Launch plan')).toBeVisible();

  await page.goto(`/${slug}/team/ENG/projects`);
  await page.getByRole('button', { name: 'New project' }).click();
  await page.getByLabel('Template').selectOption({ label: 'Launch plan (1 milestone, 0 tasks)' });
  await page.getByRole('dialog').getByLabel('Name').fill('Launch 2');
  await page.getByRole('button', { name: 'Create project' }).click();
  await page.getByRole('link', { name: /Launch 2/ }).click();
  await expect(
    page.getByRole('region', { name: 'Milestones' }).getByRole('article', { name: /Beta/ }),
  ).toBeVisible();

  await page.goto(`/${slug}/settings/templates`);
  await expect(page.getByText('Task with 1 sub-task')).toBeVisible();
  await expect(page.getByText(/Project with 1 milestone and 0 tasks/)).toBeVisible();
});
