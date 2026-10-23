import { expect, test, type Page } from './fixtures';
import { mod, signUpWithWorkspace } from './helpers';

const dayName = new Intl.DateTimeFormat('en-US', {
  weekday: 'long',
  day: 'numeric',
  month: 'long',
});

/** A calendar day cell, found by its screen-reader label ("Friday, October 23, …"). */
const day = (page: Page, date: Date) =>
  page.getByRole('listitem').filter({ hasText: `${dayName.format(date)},` });

test('create, drag, nudge and unschedule tasks on the calendar', async ({ page }) => {
  const { slug } = await signUpWithWorkspace(page);
  await page.goto(`/${slug}/team/ENG/tasks?layout=calendar`);

  // Pick two days in the month on screen, away from its end so +1 day stays inside.
  const today = new Date();
  const first = new Date(today.getFullYear(), today.getMonth(), 3);
  const second = new Date(today.getFullYear(), today.getMonth(), 10);
  const nudged = new Date(today.getFullYear(), today.getMonth(), 11);

  await day(page, first)
    .getByRole('button', { name: /^Create task due/ })
    .click();
  await page.getByRole('dialog').getByLabel('Title').fill('Plan the offsite');
  await page.keyboard.press('Enter');
  const chip = day(page, first).getByRole('button', { name: /Plan the offsite/ });
  await expect(chip).toBeVisible();
  await expect(chip).toHaveAccessibleName(/^ENG-\d+ Plan the offsite/);

  await chip.dragTo(day(page, second));
  await expect(day(page, second).getByRole('button', { name: /Plan the offsite/ })).toBeVisible();

  await day(page, second)
    .getByRole('button', { name: /Plan the offsite/ })
    .focus();
  await page.keyboard.press(`${mod}+ArrowRight`);
  await expect(day(page, nudged).getByRole('button', { name: /Plan the offsite/ })).toBeFocused();

  const tray = page.getByRole('region', { name: /^No due date/ });
  await day(page, nudged)
    .getByRole('button', { name: /Plan the offsite/ })
    .dragTo(tray);
  await expect(tray.getByRole('button', { name: /Plan the offsite/ })).toBeVisible();

  // The change is stored, not just optimistic.
  await page.reload();
  await expect(tray.getByRole('button', { name: /Plan the offsite/ })).toBeVisible();
});
