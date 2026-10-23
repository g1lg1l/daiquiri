import { expect, test } from '@playwright/test';
import { signUpWithWorkspace } from './helpers';

const CSV = [
  'Title,Status,Priority,Labels,Due Date,Assignee,Notes',
  '"Migrate the ""billing"" page",In Progress,Urgent,"Bug, Billing",2026-11-30,E2E User,"Step 1\nStep 2"',
  'Write release notes,Todo,Low,Docs,,,',
  'Mystery,Somewhere else,P2,,,Nobody,',
].join('\r\n');

test('import tasks from a CSV export', async ({ page }) => {
  const { slug } = await signUpWithWorkspace(page);
  await page.goto(`/${slug}/team/ENG/import`);
  await page.getByLabel('CSV file').setInputFiles({
    name: 'linear-export.csv',
    mimeType: 'text/csv',
    buffer: Buffer.from(CSV),
  });

  const preview = page.getByRole('region', { name: 'Preview' });
  await expect(preview).toContainText('3 tasks from linear-export.csv');
  await expect(preview).toContainText('Migrate the "billing" page');
  await expect(preview).toContainText('1 row names a status Engineering doesn’t have');
  await expect(preview).toContainText('1 row names people who aren’t members');
  await expect(page.getByLabel(/Create 3 missing labels/)).toBeChecked();
  await page.getByRole('button', { name: 'Import 3 tasks' }).click();
  await expect(page.getByRole('heading', { name: 'Imported 3 tasks' })).toBeVisible();

  await page.getByRole('link', { name: 'Open Engineering’s tasks' }).click();
  const billing = page.getByRole('row').filter({ hasText: 'Migrate the "billing" page' });
  await expect(billing).toBeVisible();
  await expect(billing.getByLabel('Status: In Progress')).toBeVisible();
  await expect(billing).toContainText('Billing');
  await expect(page.getByRole('row').filter({ hasText: 'Mystery' })).toBeVisible();
});
