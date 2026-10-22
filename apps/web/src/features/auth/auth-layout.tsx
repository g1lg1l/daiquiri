import type { ReactNode } from 'react';
import { Wordmark } from '../../components/wordmark';

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
    <div className="min-h-dvh bg-surface">
      <div className="mx-auto grid min-h-dvh max-w-6xl grid-cols-1 gap-12 px-6 py-8 lg:grid-cols-[1fr_380px] lg:gap-24 lg:px-12">
        <header className="flex flex-col justify-between gap-10 lg:py-6">
          <Wordmark />
          <p className="hidden max-w-[16ch] text-[clamp(2.4rem,5vw,4.2rem)] leading-[1.02] font-[620] font-display text-balance text-fg lg:block">
            Everything your team needs.
            <span className="block text-fg-subtle">Nothing it doesn’t.</span>
          </p>
          <p className="hidden text-sm text-fg-subtle lg:block">Open source and self-hostable</p>
        </header>
        <main className="flex flex-col justify-center pb-16 lg:pb-0">
          <h1 className="mb-6 text-2xl font-semibold font-display">{title}</h1>
          {children}
          {footer && <div className="mt-8 text-sm text-fg-muted">{footer}</div>}
        </main>
      </div>
    </div>
  );
}
