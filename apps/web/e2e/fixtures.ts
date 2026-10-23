import { expect, test as base } from '@playwright/test';

/**
 * Every spec's `page`: before a full navigation (goto, reload) it waits for
 * writes still on their way to the server, as a person would before closing
 * the tab. The app marks them on <html data-saving> and otherwise asks the
 * browser to confirm leaving, which would stall the navigation. If they never
 * finish, the error lists the requests still open.
 */
export const test = base.extend({
  page: async ({ page }, provide) => {
    const open = new Map<object, string>();
    page.on('request', (request) => open.set(request, `${request.method()} ${request.url()}`));
    page.on('requestfinished', (request) => open.delete(request));
    page.on('requestfailed', (request) => open.delete(request));
    const settle = async () => {
      if (!page.url().startsWith('http')) return;
      try {
        await expect(page.locator('html')).not.toHaveAttribute('data-saving', 'true', {
          timeout: 20_000,
        });
      } catch (error) {
        throw new Error(
          `Writes still pending before navigating. Open requests:\n${[...open.values()].join('\n')}`,
          { cause: error },
        );
      }
    };
    const goto = page.goto.bind(page);
    const reload = page.reload.bind(page);
    page.goto = async (...args) => {
      await settle();
      return goto(...args);
    };
    page.reload = async (...args) => {
      await settle();
      return reload(...args);
    };
    await provide(page);
  },
});

export { expect };
export type { Page } from '@playwright/test';
