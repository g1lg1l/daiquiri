import { expect, test } from './fixtures';
import { signUpWithWorkspace } from './helpers';

const issue = (overrides: Record<string, unknown>) => ({
  description: '',
  priority: 0,
  estimate: null,
  dueDate: null,
  assignee: null,
  labels: { nodes: [] },
  project: null,
  parent: null,
  comments: { nodes: [] },
  ...overrides,
});

test('import a Linear team, with sub-issues and comments', async ({ page }) => {
  const { slug, email } = await signUpWithWorkspace(page);
  const seen: string[] = [];
  // Linear itself is simulated; everything on Daiquiri's side is real.
  await page.route('https://api.linear.app/graphql', async (route) => {
    const request = route.request();
    seen.push(request.headers().authorization ?? '');
    const body: unknown = JSON.parse(request.postData() ?? '{}');
    const query =
      typeof body === 'object' && body !== null && 'query' in body && typeof body.query === 'string'
        ? body.query
        : '';
    if (query.includes('teams(')) {
      await route.fulfill({
        json: { data: { teams: { nodes: [{ id: 't1', key: 'APP', name: 'App' }] } } },
      });
      return;
    }
    await route.fulfill({
      json: {
        data: {
          team: {
            issues: {
              pageInfo: { hasNextPage: false, endCursor: null },
              nodes: [
                issue({
                  id: 'i2',
                  title: 'Pay button states',
                  state: { name: 'Todo', type: 'unstarted' },
                  parent: { id: 'i1' },
                }),
                issue({
                  id: 'i1',
                  title: 'Checkout redesign',
                  description: '**Goal:** a faster checkout',
                  priority: 2,
                  dueDate: '2026-12-01',
                  state: { name: 'In Progress', type: 'started' },
                  assignee: { name: 'E2E User', email },
                  labels: { nodes: [{ name: 'Design' }] },
                  project: { name: 'Payments' },
                  comments: {
                    nodes: [
                      {
                        body: 'Looks *great*',
                        createdAt: '2026-10-20T10:00:00Z',
                        user: { name: 'Ana Ruiz' },
                      },
                    ],
                  },
                }),
                issue({
                  id: 'i3',
                  title: 'Waiting for QA',
                  state: { name: 'QA', type: 'started' },
                  assignee: { name: 'Ghost', email: 'ghost@example.com' },
                }),
              ],
            },
          },
        },
      },
    });
  });

  // Found from the workspace menu, explained in settings, and opened on the chosen source.
  await page.goto(`/${slug}`);
  await page.getByRole('button', { name: /^Workspace menu/ }).click();
  await page.getByRole('menuitem', { name: 'Import tasks' }).click();
  await expect(page.getByRole('heading', { name: 'Import', exact: true })).toBeVisible();
  await page.getByRole('link', { name: 'Import from Linear' }).click();
  await expect(page.getByRole('radio', { name: 'Linear' })).toBeChecked();
  await page.getByLabel('Linear personal api key').fill('lin_api_e2e');
  await page.getByRole('button', { name: 'Connect' }).click();
  await expect(page.getByLabel('Team to import')).toHaveText('App (APP)');
  await page.getByRole('button', { name: 'Read tasks' }).click();

  const review = page.getByRole('region', { name: 'Review' });
  await expect(review).toContainText(
    '3 tasks from App (APP), 1 of them a sub-task, with 1 comment',
  );
  // "QA" has no namesake here: it maps to the first in-progress status.
  await expect(review.getByLabel('Status for QA')).toHaveText(
    (await review.getByLabel('Status for In Progress').textContent()) ?? '',
  );
  await expect(review).toContainText('Not members here, left unassigned: Ghost');
  await expect(review.getByLabel(/Create 1 project \(Payments\)/)).toBeChecked();
  await review.getByRole('button', { name: 'Import 3 tasks' }).click();
  await expect(page.getByRole('heading', { name: 'Imported 3 tasks and 1 comment' })).toBeVisible();
  // The key went to Linear as typed, and nowhere else.
  expect(new Set(seen)).toEqual(new Set(['lin_api_e2e']));

  await page.getByRole('link', { name: 'Open Engineering’s tasks' }).click();
  const parent = page.getByRole('row').filter({ hasText: 'Checkout redesign' });
  await expect(parent).toContainText('Design');
  await expect(parent.getByLabel('Status: In Progress')).toBeVisible();
  await expect(page.getByRole('row').filter({ hasText: 'Pay button states' })).toBeVisible();
  await parent.focus();
  await page.keyboard.press('Enter');
  await expect(page.getByText('Ana Ruiz, Oct 20, 2026 (from Linear)')).toBeVisible();
  await expect(page.getByRole('link', { name: /Pay button states/ })).toBeVisible();
});
