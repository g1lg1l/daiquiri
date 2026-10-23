import { expect, test } from './fixtures';
import { createTask, mod, signUpWithWorkspace } from './helpers';

test('command palette opens a task by identifier and searches', async ({ page }) => {
  const { slug } = await signUpWithWorkspace(page);
  await createTask(page, 'Rotate the signing keys');

  await page.keyboard.press(`${mod}+k`);
  const palette = page.getByRole('dialog', { name: 'Command palette' });
  await palette.getByRole('combobox').fill('rotate');
  await expect(palette.getByRole('option', { name: /Rotate the signing keys/ })).toBeVisible();

  await palette.getByRole('combobox').fill('ENG-1');
  await page.keyboard.press('Enter');
  await expect(page).toHaveURL(new RegExp(`/${slug}/task/ENG-1`));
  await expect(page.getByLabel('Title')).toHaveValue('Rotate the signing keys');
});

test('board drag and drop changes the status', async ({ page }) => {
  await signUpWithWorkspace(page);
  await createTask(page, 'Move me across the board');
  await page.keyboard.press(`${mod}+b`);
  await expect(page.getByRole('region', { name: 'Board' })).toBeVisible();

  const card = page.getByRole('button', { name: /Move me across the board/ });
  const target = page.getByRole('region', { name: /^In Progress/ });
  await card.dragTo(target);
  await expect(target.getByRole('button', { name: /Move me across the board/ })).toBeVisible();
});

test('a member of one workspace cannot open another workspace', async ({ browser }) => {
  const owner = await browser.newPage();
  const { slug } = await signUpWithWorkspace(owner, 'Owner');
  const outsider = await browser.newPage();
  await signUpWithWorkspace(outsider, 'Outsider');
  await outsider.goto(`/${slug}/team/ENG/tasks`);
  await expect(outsider.getByRole('heading', { name: 'Workspace not found' })).toBeVisible();
});

test('the demo creates a private sandbox with sample data', async ({ page }) => {
  await page.goto('/demo');
  await expect(page).toHaveURL(/\/demo-[a-z0-9]+\/team\/ENG\/tasks/, { timeout: 20_000 });
  await expect(
    page.getByRole('row').filter({ hasText: 'Crash when opening a task from a widget' }),
  ).toBeVisible();
  await expect(page.getByText('You’re in a demo')).toBeVisible();

  // The anonymous session survives a reload (it used to fall back to /login).
  const sandbox = page.url();
  await page.reload();
  await expect(page.getByText('You’re in a demo')).toBeVisible();
  expect(page.url()).toBe(sandbox);
});
