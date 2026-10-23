import type { ReactNode } from 'react';
import { Wordmark } from '../../components/wordmark';
import { m } from '../../i18n/auth';

/**
 * Shell for signed-out screens. The tagline is the hero: Daiq's promise in
 * expanded type, set beside a narrow, calm form column.
 */
export function AuthLayout({
  title,
  children,
  footer,
}: {
  title: string;
  children: ReactNode;
  footer?: ReactNode;
}) {
  return (
    <div className="relative isolate min-h-dvh overflow-hidden bg-surface">
      <div aria-hidden className="absolute inset-0 -z-10 dot-grid" />
      <div className="mx-auto grid min-h-dvh max-w-6xl grid-cols-1 gap-12 px-6 py-8 lg:grid-cols-[1fr_380px] lg:gap-24 lg:px-12">
        <header className="flex flex-col justify-between gap-10 lg:py-6">
          <Wordmark />
          <p className="hidden max-w-[16ch] text-[clamp(2.4rem,5vw,4.2rem)] leading-[1.02] font-[620] font-display text-balance text-fg lg:block">
            <Words text={m.auth.layout.tagline} />
            <span className="block text-fg-subtle">
              <Words
                text={m.auth.layout.taglineRest}
                from={m.auth.layout.tagline.split(' ').length}
              />
            </span>
          </p>
          <p className="hidden text-sm text-fg-subtle lg:block">{m.auth.layout.openSource}</p>
        </header>
        <main className="flex rise-children flex-col justify-center pb-16 lg:pb-0">
          <h1 className="mb-6 text-2xl font-semibold font-display">{title}</h1>
          <div className="card p-6">{children}</div>
          {footer && <div className="mt-8 text-sm text-fg-muted">{footer}</div>}
        </main>
      </div>
    </div>
  );
}

/** Each word comes into focus after the one before it. */
function Words({ text, from = 0 }: { text: string; from?: number }) {
  return text.split(' ').map((word, index) => (
    // oxlint-disable-next-line react/no-array-index-key -- words repeat; their order is their identity
    <span key={index}>
      <span className="focus-word" style={{ '--i': from + index }}>
        {word}
      </span>{' '}
    </span>
  ));
}
