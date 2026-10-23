import { expect, test, type Page } from './fixtures';
import { createTask, signUpWithWorkspace } from './helpers';

async function setPriority(page: Page, title: string, priority: string) {
  await page.getByRole('row').filter({ hasText: title }).focus();
  await page.keyboard.press('p');
  await page.getByPlaceholder('Set priority to…').fill(priority);
  await page.keyboard.press('Enter');
}

test('match any filter and sub-group the list', async ({ page }) => {
  const { slug } = await signUpWithWorkspace(page);
  await createTask(page, 'Urgent production bug');
  await createTask(page, 'Low priority polish');
  await createTask(page, 'Untriaged idea');
  await setPriority(page, 'Urgent production bug', 'Urgent');
  await setPriority(page, 'Low priority polish', 'Low');

  // Urgent and overdue: nothing matches both, the urgent task matches either.
  await page.goto(`/${slug}/team/ENG/tasks?priority=%5B1%5D&due=overdue`);
  await expect(page.getByRole('row').filter({ hasText: 'Urgent production bug' })).toBeHidden();
  await page.getByRole('button', { name: /Match all filters/ }).click();
  await expect(page).toHaveURL(/match=any/);
  await expect(page.getByRole('row').filter({ hasText: 'Urgent production bug' })).toBeVisible();
  await expect(page.getByRole('row').filter({ hasText: 'Untriaged idea' })).toBeHidden();

  // Group by status, then by priority.
  await page.goto(`/${slug}/team/ENG/tasks`);
  await page.getByRole('button', { name: 'Display' }).click();
  await page
    .getByRole('group', { name: 'Sub-group by' })
    .getByRole('menuitemradio', { name: 'Priority' })
    .click();
  await page.keyboard.press('Escape');
  await expect(page).toHaveURL(/subgroup=priority/);
  const subgroup = page.locator('[role="row"][aria-level="2"]');
  await expect(subgroup.filter({ hasText: 'Urgent' })).toBeVisible();
  await expect(subgroup.filter({ hasText: 'No priority' })).toBeVisible();
});

test('mute a team in notification preferences', async ({ page }) => {
  const { slug } = await signUpWithWorkspace(page);
  await page.goto(`/${slug}/settings/preferences`);
  const engineering = page.getByLabel('Engineering');
  await expect(engineering).toHaveValue('all');
  await engineering.selectOption('mute');
  await page.reload();
  await expect(page.getByLabel('Engineering')).toHaveValue('mute');
});
