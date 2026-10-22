import { defineConfig, devices } from '@playwright/test';

/**
 * E2E against the production build (vite preview) and the local Supabase stack
 * (`pnpm db:start`). See docs/architecture/testing.md for the covered flows.
 */
export default defineConfig({
  testDir: './e2e',
  fullyParallel: true,
  forbidOnly: Boolean(process.env.CI),
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? [['github'], ['html', { open: 'never' }]] : 'list',
  timeout: 45_000,
  expect: { timeout: 10_000 },
  use: {
    baseURL: 'http://localhost:4173',
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
  },
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'], viewport: { width: 1440, height: 900 } },
    },
  ],
  webServer: {
    command:
      "node scripts/dev-config.mjs && pnpm build && node -e \"require('node:fs').copyFileSync('public/config.json','dist/config.json')\" && pnpm preview",
    url: 'http://localhost:4173',
    reuseExistingServer: !process.env.CI,
    timeout: 180_000,
  },
});
