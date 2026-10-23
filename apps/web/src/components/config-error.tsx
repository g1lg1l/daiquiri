import { m } from '../i18n';
import { Wordmark } from './wordmark';

/** Shown when /config.json is missing or invalid: explains how to fix it. */
export function ConfigErrorScreen({ error }: { error: unknown }) {
  const detail = error instanceof Error ? error.message : String(error);
  const { intro, local } = m.shell.config;
  return (
    <main className="mx-auto flex min-h-dvh max-w-xl flex-col justify-center gap-5 px-6">
      <Wordmark />
      <h1 className="text-2xl font-semibold font-display">{m.shell.config.title}</h1>
      <p className="text-fg-muted">
        {intro.before} <code>config.json</code> {intro.between} <code>index.html</code>{' '}
        {intro.after}
      </p>
      <pre className="overflow-x-auto rounded-lg bg-surface-subtle p-4 text-xs text-fg-muted">
        {`{ "supabaseUrl": "https://<project>.supabase.co", "supabaseKey": "<publishable key>" }`}
      </pre>
      <p className="text-sm text-fg-subtle">
        {local.before} <code>pnpm db:start</code> {local.between} <code>pnpm dev</code>
        {local.after}
      </p>
      <details className="text-xs text-fg-subtle">
        <summary className="cursor-pointer">{m.shell.config.details}</summary>
        <pre className="mt-2 whitespace-pre-wrap">{detail}</pre>
      </details>
    </main>
  );
}
