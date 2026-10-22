import { expect, test } from '@playwright/test';
import { createTask, mod, signUpWithWorkspace } from './helpers';

test.beforeEach(async ({ page }) => {
  await signUpWithWorkspace(page);
});

test('create, edit with shortcuts, comment, delete and undo', async ({ page }) => {
  const row = await createTask(page, 'Write the launch checklist');

  // Keyboard: focus the row, change status with S.
  await row.focus();
  await page.keyboard.press('s');
  await page.getByPlaceholder('Change status to…').fill('In Progress');
  await page.keyboard.press('Enter');
  await expect(page.getByRole('row', { name: /In Progress/ })).toBeVisible();
  await expect(
    page
      .getByRole('row')
      .filter({ hasText: 'Write the launch checklist' })
      .getByLabel('Status: In Progress'),
  ).toBeVisible();

  // Peek and comment.
  await page.getByRole('row').filter({ hasText: 'Write the launch checklist' }).click();
  const preview = page.getByRole('complementary', { name: 'Task preview' });
  await expect(preview.getByLabel('Title')).toHaveValue('Write the launch checklist');
  const comment = preview.getByRole('textbox', { name: 'Comment' });
  await comment.click();
  await comment.pressSequentially('Draft is ready for review');
  await comment.press(`${mod}+Enter`);
  await expect(preview.getByText('Draft is ready for review')).toBeVisible();

  // Survives a reload (server truth, not just the optimistic cache).
  await page.reload();
  await expect(
    page.getByRole('row').filter({ hasText: 'Write the launch checklist' }),
  ).toBeVisible();

  // Delete and undo.
  const reloaded = page.getByRole('row').filter({ hasText: 'Write the launch checklist' });
  await reloaded.focus();
  await page.keyboard.press(`${mod}+Backspace`);
  await expect(reloaded).toHaveCount(0);
  await page.getByRole('button', { name: 'Undo' }).click();
  await expect(
    page.getByRole('row').filter({ hasText: 'Write the launch checklist' }),
  ).toBeVisible();
});

test('pasting several lines creates one task per line', async ({ page }) => {
  await page.keyboard.press('c');
  await page.getByRole('dialog').getByLabel('Title').fill('First line\nSecond line\nThird line');
  await expect(page.getByText('3 lines: one task will be created per line.')).toBeVisible();
  await page.getByRole('button', { name: 'Create 3 tasks' }).click();
  await Promise.all(
    ['First line', 'Second line', 'Third line'].map((title) =>
      expect(page.getByRole('row').filter({ hasText: title })).toBeVisible(),
    ),
  );
});

test('filters and grouping live in the URL', async ({ page }) => {
  await createTask(page, 'Urgent production bug');
  await page.getByRole('button', { name: 'Display' }).click();
  await page.getByRole('menuitemradio', { name: 'Priority' }).first().click();
  await page.keyboard.press('Escape');
  await expect(page).toHaveURL(/group=priority/);
  await page.reload();
  await expect(page.getByRole('row', { name: /No priority/ })).toBeVisible();
});
