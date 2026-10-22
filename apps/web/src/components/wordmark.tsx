import { cn } from '@daiq/ui';

/** The Daiq lockup: app icon plus expanded Mona Sans with a lime "drop" over the i. */
export function Wordmark({ className }: { className?: string }) {
  return (
    <span
      className={cn(
        'relative inline-flex items-baseline text-[1.375rem] font-[680] font-display tracking-tight text-fg',
        className,
      )}
    >
      <img
        src={`${import.meta.env.BASE_URL}favicon.svg`}
        alt=""
        className="mr-[0.4em] size-[1.3em] self-center"
      />
      <span className="sr-only">Daiq</span>
      <span aria-hidden>da</span>
      <span aria-hidden className="relative">
        ı
        <span className="absolute -top-[0.06em] left-1/2 size-[0.3em] -translate-x-1/2 rounded-full bg-brand-lime ring-[0.06em] ring-surface" />
      </span>
      <span aria-hidden>q</span>
    </span>
  );
}
