import { cn } from '@daiq/ui';

/** The Daiq wordmark: expanded Mona Sans with a lime "drop" over the i. */
export function Wordmark({ className }: { className?: string }) {
  return (
    <span
      className={cn(
        'relative inline-flex items-baseline text-[1.375rem] font-[680] font-display tracking-tight text-fg',
        className,
      )}
      aria-label="Daiq"
    >
      <span aria-hidden>da</span>
      <span aria-hidden className="relative">
        ı
        <span className="absolute -top-[0.06em] left-1/2 size-[0.3em] -translate-x-1/2 rounded-full bg-brand-lime ring-[0.06em] ring-surface" />
      </span>
      <span aria-hidden>q</span>
    </span>
  );
}
