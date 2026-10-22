import type { ComponentProps } from 'react';
import { cn } from '../cn';
import { formatShortcut } from '../shortcut-format';

export function Kbd({ className, ...props }: ComponentProps<'kbd'>) {
  return (
    <kbd
      className={cn(
        'inline-flex h-[18px] min-w-[18px] items-center justify-center rounded-sm border border-border bg-surface-subtle px-1 font-sans text-[11px] font-medium text-fg-muted',
        className,
      )}
      {...props}
    />
  );
}

/** Renders a shortcut definition such as "Mod+K" or "G I" as a row of keys. */
export function Shortcut({ keys, className }: { keys: string; className?: string }) {
  return (
    <span className={cn('inline-flex items-center gap-0.5', className)} aria-hidden>
      {formatShortcut(keys).map((key, index) =>
        key === 'then' ? (
          // oxlint-disable-next-line react/no-array-index-key
          <span key={index} className="px-0.5 text-[10px] text-fg-subtle">
            then
          </span>
        ) : (
          // Static, never reordered list where keys can repeat ("G G"): the index is the identity.
          // oxlint-disable-next-line react/no-array-index-key
          <Kbd key={index}>{key}</Kbd>
        ),
      )}
    </span>
  );
}
