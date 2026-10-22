// Post-build steps for static hosting (ADR-0012):
//  - 404.html = index.html so deep links work on GitHub Pages;
//  - config.json from DAIQ_SUPABASE_URL / DAIQ_SUPABASE_KEY when provided (Pages build).
//    Docker images write config.json at container start instead.
import { copyFileSync, rmSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const dist = (file) => fileURLToPath(new URL(`../dist/${file}`, import.meta.url));

copyFileSync(dist('index.html'), dist('404.html'));
rmSync(dist('config.json'), { force: true });

const { DAIQ_SUPABASE_URL: url, DAIQ_SUPABASE_KEY: key, DAIQ_DEMO: demo } = process.env;
if (url && key) {
  writeFileSync(
    dist('config.json'),
    JSON.stringify({ supabaseUrl: url, supabaseKey: key, demo: demo === 'true' }),
  );
  console.log('postbuild: wrote config.json');
}
