import { expect, type Page } from '@playwright/test';

export const PASSWORD = 'e2e-password-123';

export function uniqueSuffix(): string {
  return `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`;
}

/** Signs up a fresh user and creates a workspace through the real UI. */
export async function signUpWithWorkspace(page: Page, name = 'E2E User') {
  const suffix = uniqueSuffix();
  const email = `e2e-${suffix}@daiq.test`;
  const slug = `e2e-${suffix}`;

  await page.goto('/signup');
  await page.getByLabel('Your name').fill(name);
  await page.getByLabel('Work email').fill(email);
  await page.getByLabel('Password').fill(PASSWORD);
  await page.getByRole('button', { name: 'Create account' }).click();

  await expect(page.getByRole('heading', { name: 'Set up your workspace' })).toBeVisible();
  await page.getByLabel('Workspace name').fill(`E2E ${suffix}`);
  await page.getByLabel('Web address').fill(slug);
  await page.getByRole('button', { name: 'Create workspace' }).click();

  await expect(page).toHaveURL(new RegExp(`/${slug}/team/ENG/tasks`));
  // The workspace shell (and its keyboard shortcuts) is ready once the view header renders.
  await expect(page.getByRole('heading', { name: 'Engineering' })).toBeVisible();
  return { email, slug };
}

export const mod = process.platform === 'darwin' ? 'Meta' : 'Control';

/** Creates a task with the composer (C) and returns its row. */
export async function createTask(page: Page, title: string) {
  await page.keyboard.press('c');
  const field = page.getByRole('dialog').getByLabel('Title');
  await field.fill(title);
  await field.press('Enter');
  const row = page.getByRole('row').filter({ hasText: title });
  await expect(row).toBeVisible();
  // Wait for the server-assigned identifier (optimistic rows show "ENG-…").
  await expect(row.getByText(/^ENG-\d+$/)).toBeVisible();
  return row;
}
