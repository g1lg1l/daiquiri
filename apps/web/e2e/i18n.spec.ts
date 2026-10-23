import { expect, test } from './fixtures';
import { signUpWithWorkspace } from './helpers';

test('switch the app to Italian and back', async ({ page }) => {
  const { slug } = await signUpWithWorkspace(page);
  await page.goto(`/${slug}/settings/preferences`);
  await page.getByLabel('Language').click();
  await page.getByRole('option', { name: 'Italiano' }).click();

  // The page reloads in Italian, including texts that come from the shared packages.
  await expect(page.locator('html')).toHaveAttribute('lang', 'it');
  await expect(page.getByRole('link', { name: 'Posta in arrivo' })).toBeVisible();
  await expect(page.getByRole('link', { name: 'Le mie attività' })).toBeVisible();
  await expect(page.getByLabel('Lingua')).toHaveText('Italiano');

  await page.goto(`/${slug}/team/ENG/tasks`);
  await page.getByRole('button', { name: 'Nuova attività' }).click();
  await page
    .getByRole('dialog')
    .getByRole('button', { name: /Scadenza/ })
    .click();
  await expect(page.getByRole('button', { name: 'Domani' })).toBeVisible();
  await page.keyboard.press('Escape');
  await page.keyboard.press('Escape');

  await page.goto(`/${slug}/settings/preferences`);
  await page.getByLabel('Lingua').click();
  await page.getByRole('option', { name: 'English' }).click();
  await expect(page.locator('html')).toHaveAttribute('lang', 'en');
  await expect(page.getByRole('link', { name: 'Inbox' })).toBeVisible();
});
