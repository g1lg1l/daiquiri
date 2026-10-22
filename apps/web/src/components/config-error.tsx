import { Wordmark } from './wordmark';

/** Shown when /config.json is missing or invalid: explains how to fix it. */
export function ConfigErrorScreen({ error }: { error: unknown }) {
  const detail = error instanceof Error ? error.message : String(error);
  return (
    <main className="mx-auto flex min-h-dvh max-w-xl flex-col justify-center gap-5 px-6">
      <Wordmark />
      <h1 className="text-2xl font-semibold font-display">Daiq needs a backend to talk to</h1>
      <p className="text-fg-muted">
        The app could not read its runtime configuration. Provide a <code>config.json</code> next to{' '}
        <code>index.html</code> with your Supabase URL and publishable key.
      </p>
      <pre className="overflow-x-auto rounded-lg bg-surface-subtle p-4 text-xs text-fg-muted">
        {`{ "supabaseUrl": "https://<project>.supabase.co", "supabaseKey": "<publishable key>" }`}
      </pre>
      <p className="text-sm text-fg-subtle">
        Local development: run <code>pnpm db:start</code> and then <code>pnpm dev</code>.
      </p>
      <details className="text-xs text-fg-subtle">
        <summary className="cursor-pointer">Technical details</summary>
        <pre className="mt-2 whitespace-pre-wrap">{detail}</pre>
      </details>
    </main>
  );
}
