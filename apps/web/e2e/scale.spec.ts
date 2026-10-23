import { expect, test } from '@playwright/test';
import { z } from 'zod';
import { signUpWithWorkspace } from './helpers';

const COUNT = 5000;

const configSchema = z.object({ supabaseUrl: z.string(), supabaseKey: z.string() });
const teamsSchema = z.array(z.object({ id: z.string(), workspace_id: z.string() }));

test(`a team list with ${COUNT} tasks stays virtualised and reaches the end`, async ({ page }) => {
  test.slow();
  const { slug } = await signUpWithWorkspace(page);

  // Bulk insert through the API as the signed-in user, the way an import would.
  const config = configSchema.parse(await (await page.request.get('/config.json')).json());
  const token = await page.evaluate(() => {
    const key = Object.keys(localStorage).find((name) => name.endsWith('-auth-token'));
    const session: unknown = JSON.parse(localStorage.getItem(key ?? '') ?? 'null');
    return typeof session === 'object' &&
      session !== null &&
      'access_token' in session &&
      typeof session.access_token === 'string'
      ? session.access_token
      : '';
  });
  const headers = { apikey: config.supabaseKey, authorization: `Bearer ${token}` };
  const teams = teamsSchema.parse(
    await (
      await page.request.get(
        `${config.supabaseUrl}/rest/v1/teams?key=eq.ENG&select=id,workspace_id`,
        {
          headers,
        },
      )
    ).json(),
  );
  const team = teams[0];
  expect(team).toBeDefined();
  const insert = await page.request.post(`${config.supabaseUrl}/rest/v1/tasks`, {
    headers: { ...headers, prefer: 'return=minimal' },
    data: Array.from({ length: COUNT }, (_, i) => ({
      team_id: team?.id,
      workspace_id: team?.workspace_id,
      title: `Imported task ${String(i + 1).padStart(4, '0')}`,
    })),
  });
  expect(insert.status()).toBe(201);

  const started = Date.now();
  await page.goto(`/${slug}/team/ENG/tasks?group=none&order=title`);
  const first = page.getByRole('row').filter({ hasText: 'Imported task 0001' });
  await expect(first).toBeVisible({ timeout: 15_000 });
  expect(Date.now() - started).toBeLessThan(10_000);

  // Only the visible slice is in the DOM.
  expect(await page.locator('[role=row][data-task-id]').count()).toBeLessThan(150);

  // Keyboard navigation reaches the last task.
  await first.focus();
  await page.keyboard.press('End');
  await expect(page.getByRole('row').filter({ hasText: `Imported task ${COUNT}` })).toBeFocused();
});
