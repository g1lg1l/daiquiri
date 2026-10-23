import { AxeBuilder } from '@axe-core/playwright';
import type { Page } from '@playwright/test';
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

/** Contrast is judged on the settled page, not halfway through an entrance (infinite spinners excepted). */
const settled = (page: Page) =>
  page.waitForFunction(() =>
    document
      .getAnimations()
      .every((a) => a.playState !== 'running' || a.effect?.getTiming().iterations === Infinity),
  );

test('sign-in page has no serious accessibility violations', async ({ page }) => {
  await page.goto('/login');
  await expect(page.getByRole('heading', { name: 'Sign in' })).toBeVisible();
  await settled(page);
  const results = await new AxeBuilder({ page })
    .withTags(['wcag2a', 'wcag2aa', 'wcag22aa'])
    .analyze();
  expect(serious(results.violations)).toEqual([]);
});

test('task list and task page have no serious accessibility violations', async ({ page }) => {
  await signUpWithWorkspace(page);
  await createTask(page, 'Accessible task');
  await settled(page);
  let results = await new AxeBuilder({ page })
    .withTags(['wcag2a', 'wcag2aa', 'wcag22aa'])
    .analyze();
  expect(serious(results.violations)).toEqual([]);

  await page.getByRole('row').filter({ hasText: 'Accessible task' }).focus();
  await page.keyboard.press('Enter');
  await expect(page.getByLabel('Title')).toHaveValue('Accessible task');
  await settled(page);
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
    await settled(page);
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
