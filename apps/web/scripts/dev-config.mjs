// Writes public/config.json for local development from `supabase status`.
// Runs before `pnpm dev`; never overwrites a hand-edited file.
import { execFileSync } from 'node:child_process';
import { existsSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const target = fileURLToPath(new URL('../public/config.json', import.meta.url));
if (existsSync(target)) process.exit(0);

try {
  const status = JSON.parse(
    execFileSync('supabase', ['status', '-o', 'json'], {
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'ignore'],
    }),
  );
  const config = {
    supabaseUrl: status.API_URL,
    supabaseKey: status.PUBLISHABLE_KEY ?? status.ANON_KEY,
    demo: false,
  };
  writeFileSync(target, `${JSON.stringify(config, null, 2)}\n`);
  console.log('Wrote apps/web/public/config.json from the local Supabase stack.');
} catch {
  console.warn(
    'Local Supabase is not running. Start it with `pnpm db:start`, then rerun `pnpm dev`.',
  );
}
