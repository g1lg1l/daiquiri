import { expect, test } from './fixtures';
import { createTask, mod, signUpWithWorkspace } from './helpers';

test('restore a deleted task from the trash, or delete it for good', async ({ page }) => {
  const { slug } = await signUpWithWorkspace(page);
  const remove = async (title: string) => {
    const row = await createTask(page, title);
    await row.focus();
    await page.keyboard.press(`${mod}+Backspace`);
    await expect(row).toHaveCount(0);
  };
  await remove('Keep this one');
  await remove('Throw this away');

  await page.goto(`/${slug}/settings/trash`);
  const kept = page.getByRole('listitem').filter({ hasText: 'Keep this one' });
  await expect(kept).toContainText('30 days left');
  await kept.getByRole('button', { name: 'Restore' }).click();
  await expect(kept).toHaveCount(0);

  const thrown = page.getByRole('listitem').filter({ hasText: 'Throw this away' });
  await thrown.getByRole('button', { name: 'Delete forever' }).click();
  await page.getByRole('dialog').getByRole('button', { name: 'Delete forever' }).click();
  await expect(page.getByText('The trash is empty.')).toBeVisible();

  await page.goto(`/${slug}/team/ENG/tasks`);
  await expect(page.getByRole('row').filter({ hasText: 'Keep this one' })).toBeVisible();
  await expect(page.getByRole('row').filter({ hasText: 'Throw this away' })).toHaveCount(0);
});
