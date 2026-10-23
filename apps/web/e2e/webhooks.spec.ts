import { expect, test } from './fixtures';
import { signUpWithWorkspace } from './helpers';

test('add a webhook, keep its secret and send a test', async ({ page }) => {
  const { slug } = await signUpWithWorkspace(page);
  await page.goto(`/${slug}/settings/webhooks`);

  await page.getByLabel('Name').fill('Deploy bot');
  // Addresses that could reach inside are refused before saving.
  await page.getByLabel('Endpoint URL').fill('http://localhost:8000/hook');
  await expect(page.getByText('Use an https address with a public host name')).toBeVisible();
  await expect(page.getByRole('button', { name: 'Add webhook' })).toBeDisabled();

  await page.getByLabel('Endpoint URL').fill('https://hooks.daiquiri-e2e.dev/in');
  await page.getByRole('button', { name: 'Add webhook' }).click();
  const secret = page.getByRole('dialog', { name: 'Signing secret' });
  await expect(secret.locator('code')).toHaveText(/^whsec_[0-9a-f]{64}$/);
  await secret.getByRole('button', { name: 'Done' }).click();

  const hook = page.getByRole('listitem', { name: 'Deploy bot' });
  await expect(hook).toContainText('https://hooks.daiquiri-e2e.dev/in');
  await hook.getByRole('button', { name: 'Send test' }).click();
  await expect(
    page.getByRole('region', { name: 'Deliveries to Deploy bot' }).getByText('ping'),
  ).toBeVisible();
});
