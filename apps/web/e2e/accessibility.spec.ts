import { AxeBuilder } from '@axe-core/playwright';
import { expect, test } from './fixtures';
import { createTask, signUpWithWorkspace } from './helpers';

const serious = (
  violations: {
    impact?: string | null;
    id: string;
    nodes: { target: unknown; failureSummary?: string }[];
  }[],
) =>
  violations
    .filter((v) => v.impact === 'serious' || v.impact === 'critical')
    .map(
      (v) =>
        `${v.id}: ${v.nodes.map((n) => `${JSON.stringify(n.target)} ${n.failureSummary ?? ''}`).join(' | ')}`,
    );

test('sign-in page has no serious accessibility violations', async ({ page }) => {
  await page.goto('/login');
  const results = await new AxeBuilder({ page })
    .withTags(['wcag2a', 'wcag2aa', 'wcag22aa'])
    .analyze();
  expect(serious(results.violations)).toEqual([]);
});

test('task list and task page have no serious accessibility violations', async ({ page }) => {
  await signUpWithWorkspace(page);
  await createTask(page, 'Accessible task');
  let results = await new AxeBuilder({ page })
    .withTags(['wcag2a', 'wcag2aa', 'wcag22aa'])
    .analyze();
  expect(serious(results.violations)).toEqual([]);

  await page.getByRole('row').filter({ hasText: 'Accessible task' }).focus();
  await page.keyboard.press('Enter');
  await expect(page.getByLabel('Title')).toHaveValue('Accessible task');
  results = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag22aa']).analyze();
  expect(serious(results.violations)).toEqual([]);
});

test('board, calendar, timeline and insights have no serious accessibility violations', async ({
  page,
}) => {
  const { slug } = await signUpWithWorkspace(page);
  await createTask(page, 'Seen on every layout');
  const check = async (layout: string) => {
    await page.goto(`/${slug}/team/ENG/tasks?layout=${layout}`);
    await expect(page.getByRole('radio', { name: new RegExp(layout, 'i') })).toBeChecked();
    await expect(
      page
        .getByText(/Seen on every layout|without dates|Tasks created and completed per week/)
        .first(),
    ).toBeVisible();
    const results = await new AxeBuilder({ page })
      .withTags(['wcag2a', 'wcag2aa', 'wcag22aa'])
      .analyze();
    expect(serious(results.violations), layout).toEqual([]);
  };
  await check('board');
  await check('calendar');
  await check('timeline');
  await check('insights');
});
