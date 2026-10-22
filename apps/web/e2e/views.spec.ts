import { expect, test } from '@playwright/test';
import { mod, signUpWithWorkspace } from './helpers';

test('save a view, favorite it, modify, reset, delete and undo', async ({ page }) => {
  const { slug } = await signUpWithWorkspace(page);
  const sidebar = page.getByRole('navigation', { name: 'Workspace' });

  await page.goto(`/${slug}/team/ENG/tasks?group=priority`);
  await page.getByRole('button', { name: 'Save view' }).click();
  await page.getByRole('dialog').getByLabel('Name').fill('By priority');
  await page.keyboard.press('Enter');

  await expect(page).toHaveURL(/view=/);
  await expect(page.getByRole('heading', { name: /By priority/ })).toBeVisible();
  await expect(sidebar.getByRole('link', { name: 'By priority' })).toHaveAttribute(
    'aria-current',
    'page',
  );

  await page.getByRole('button', { name: 'Add to favorites' }).click();
  await expect(sidebar.getByRole('heading', { name: 'Favorites' })).toBeVisible();

  // Drift from the saved view, then go back to it.
  await page.keyboard.press(`${mod}+b`);
  await expect(page.getByText('Modified')).toBeVisible();
  await page.getByRole('button', { name: 'Reset' }).click();
  await expect(page.getByText('Modified')).toBeHidden();

  // Saved on the server, not just in the cache.
  await page.reload();
  await expect(sidebar.getByRole('link', { name: 'By priority' })).toHaveCount(2);

  await page.getByRole('button', { name: 'View actions' }).click();
  await page.getByRole('menuitem', { name: 'Delete view' }).click();
  await expect(sidebar.getByRole('link', { name: 'By priority' })).toHaveCount(0);
  await page.getByRole('button', { name: 'Undo' }).click();
  await expect(sidebar.getByRole('link', { name: 'By priority' })).toHaveCount(2);
});
