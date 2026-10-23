import { expect, test } from './fixtures';
import { signUpWithWorkspace } from './helpers';

test('a stranger sends a public form and the team finds it in Triage', async ({
  browser,
  page,
}) => {
  const { slug } = await signUpWithWorkspace(page);
  await page.goto(`/${slug}/settings/teams/ENG`);
  const triage = page.getByRole('checkbox', { name: 'Triage' });
  await triage.click();
  await expect(triage).toBeChecked();

  await page.goto(`/${slug}/team/ENG/forms`);
  await page.getByRole('button', { name: 'New form' }).click();
  await page.getByLabel('Name').fill('Report a bug');
  await page.getByLabel('Anyone with the link').check();
  await page.getByRole('button', { name: 'Create form' }).click();
  const form = page.getByRole('listitem', { name: 'Report a bug' });
  await expect(form).toContainText('Anyone with the link, 0 submissions');
  const link = (await form.locator('code').textContent()) ?? '';
  expect(link).toMatch(/\/f\/[0-9a-f]{16}$/);

  // Someone without an account.
  const stranger = await (await browser.newContext()).newPage();
  await stranger.goto(link);
  await expect(stranger.getByRole('heading', { name: 'Report a bug' })).toBeVisible();
  await stranger.getByLabel('Subject').fill('Checkout button does nothing');
  await stranger.getByLabel('Details').fill('Clicked pay twice.\nNothing happened.');
  await stranger.getByLabel('How urgent is it?').click();
  await stranger.getByRole('option', { name: 'Urgent' }).click();
  await stranger.getByLabel('Your email').fill('customer@example.com');
  await stranger.getByRole('button', { name: 'Send' }).click();
  await expect(stranger.getByRole('heading', { name: 'Thanks, we have it' })).toBeVisible();
  await expect(stranger.getByText(/Your reference is ENG-\d+\./)).toBeVisible();
  await stranger.context().close();

  await page.goto(`/${slug}/team/ENG/tasks`);
  await expect(page.getByRole('button', { name: 'Collapse Triage' })).toBeVisible();
  const row = page.getByRole('row').filter({ hasText: 'Checkout button does nothing' });
  await row.focus();
  await page.keyboard.press('Enter');
  await expect(
    page.getByText('customer@example.com sent it through the form Report a bug'),
  ).toBeVisible();
});
