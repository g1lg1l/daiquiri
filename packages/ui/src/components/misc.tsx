import type { ComponentProps } from 'react';
import { cn } from '../cn';
import { uiTexts } from '../texts';

export function Skeleton({ className, ...props }: ComponentProps<'div'>) {
  return (
    <div
      aria-hidden
      className={cn('animate-pulse rounded-md bg-surface-muted', className)}
      {...props}
    />
  );
}

export function Separator({ className, ...props }: ComponentProps<'hr'>) {
  return <hr className={cn('h-px w-full border-0 bg-border', className)} {...props} />;
}

export function Spinner({ className }: { className?: string }) {
  return (
    <output
      aria-label={uiTexts.loading}
      className={cn(
        'inline-block size-4 animate-spin rounded-full border-2 border-border border-t-fg-muted',
        className,
      )}
    />
  );
}

/** Text only screen readers announce. */
export function VisuallyHidden(props: ComponentProps<'span'>) {
  return <span className="sr-only" {...props} />;
}
