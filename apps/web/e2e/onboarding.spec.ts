import { expect, test } from './fixtures';
import { PASSWORD, signUpWithWorkspace } from './helpers';

test('sign up, create a workspace, sign out and sign back in', async ({ page }) => {
  const { email, slug } = await signUpWithWorkspace(page);

  await expect(page.getByRole('heading', { name: 'Engineering' })).toBeVisible();
  await expect(page.getByText('No tasks here')).toBeVisible();

  await page.getByRole('button', { name: /Workspace menu/ }).click();
  await page.getByRole('menuitem', { name: 'Sign out' }).click();
  await expect(page).toHaveURL(/\/login/);

  await page.getByLabel('Email').fill(email);
  await page.getByLabel('Password').fill(PASSWORD);
  await page.getByRole('button', { name: 'Sign in' }).click();
  await expect(page).toHaveURL(new RegExp(`/${slug}/`));
});

test('rejects wrong credentials with a clear message', async ({ page }) => {
  await page.goto('/login');
  await page.getByLabel('Email').fill('nobody@daiq.test');
  await page.getByLabel('Password').fill('wrong-password');
  await page.getByRole('button', { name: 'Sign in' }).click();
  await expect(page.getByRole('alert')).toContainText(/invalid/i);
});
