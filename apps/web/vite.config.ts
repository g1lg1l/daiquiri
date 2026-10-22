import { createHash } from 'node:crypto';
import tailwindcss from '@tailwindcss/vite';
import { tanstackRouter } from '@tanstack/router-plugin/vite';
import react from '@vitejs/plugin-react';
import type { Plugin } from 'vite';
import { defineConfig } from 'vitest/config';
import { themeBootScript } from '@daiq/ui/theme-boot';

/** Inlines the theme boot script and records its CSP hash for the nginx config. */
function themeBoot(): Plugin {
  const hash = `sha256-${createHash('sha256').update(themeBootScript).digest('base64')}`;
  return {
    name: 'daiq-theme-boot',
    transformIndexHtml: () => [
      { tag: 'script', children: themeBootScript, injectTo: 'head-prepend' },
    ],
    generateBundle() {
      this.emitFile({
        type: 'asset',
        fileName: 'csp-hashes.json',
        source: JSON.stringify({ script: [hash] }),
      });
    },
  };
}

export default defineConfig({
  // "/daiquiri/" for GitHub Pages, "/" everywhere else (ADR-0012).
  base: process.env.DAIQ_BASE ?? '/',
  plugins: [
    tanstackRouter({ target: 'react', autoCodeSplitting: true }),
    react(),
    tailwindcss(),
    themeBoot(),
  ],
  build: {
    target: 'es2023',
    sourcemap: true,
    // Read by scripts/size.mjs to enforce the bundle budgets in performance.md.
    manifest: true,
    // The editor chunk is lazy and budgeted separately; avoid noisy warnings.
    chunkSizeWarningLimit: 800,
  },
  server: { port: 5173, strictPort: true },
  preview: { port: 4173, strictPort: true },
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: ['./src/test/setup.ts'],
    include: ['src/**/*.test.{ts,tsx}'],
  },
});
