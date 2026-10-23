import { expect, test } from './fixtures';
import { createTask, signUpWithWorkspace } from './helpers';

// A 1×1 transparent PNG.
const PNG = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII=',
  'base64',
);

test('attach, preview, download and delete files', async ({ page }) => {
  await signUpWithWorkspace(page);
  const row = await createTask(page, 'Ship the brochure');
  await row.focus();
  await page.keyboard.press('Enter');
  const section = page.getByRole('region', { name: 'Attachments' });

  await section.getByLabel('Attach files').setInputFiles([
    { name: 'cover.png', mimeType: 'image/png', buffer: PNG },
    { name: 'notes.txt', mimeType: 'text/plain', buffer: Buffer.from('Print 500 copies') },
  ]);

  // Images preview through a signed URL; other files are listed for download only.
  await expect(section.getByRole('img', { name: 'cover.png' })).toHaveAttribute('src', /token=/);
  const download = section.getByRole('link', { name: 'Download notes.txt' });
  await expect(download).toHaveAttribute('href', /download=/);
  const response = await page.request.get((await download.getAttribute('href')) ?? '');
  expect(await response.text()).toBe('Print 500 copies');
  await expect(page.getByText('attached notes.txt')).toBeVisible();

  // Too large files are refused before uploading.
  await section.getByLabel('Attach files').setInputFiles({
    name: 'huge.bin',
    mimeType: 'application/octet-stream',
    buffer: Buffer.alloc(26 * 1024 * 1024),
  });
  await expect(page.getByText(/huge\.bin is 26 MB; files can be up to 25 MB/)).toBeVisible();

  await section.getByRole('button', { name: 'Delete notes.txt' }).click();
  await page.getByRole('button', { name: 'Delete file' }).click();
  // The list updates at once; the toast confirms the server deleted it.
  await expect(page.getByText('Deleted notes.txt')).toBeVisible();
  await expect(section.getByText('notes.txt')).toHaveCount(0);

  await page.reload();
  await expect(section.getByRole('img', { name: 'cover.png' })).toBeVisible();
  await expect(section.getByText('notes.txt')).toHaveCount(0);
});
