import { Avatar as AvatarPrimitive } from '@base-ui/react/avatar';
import { Blobatar } from '@blobatar/react';
import { cn } from '../cn';

const sizes = {
  xs: { className: 'size-4 text-[8px]', px: 16 },
  sm: { className: 'size-5 text-[9px]', px: 20 },
  md: { className: 'size-6 text-[10px]', px: 24 },
  lg: { className: 'size-8 text-xs', px: 32 },
};

/** First letters of the first and last words, skipping words like "(demo)". */
export function initials(name: string): string {
  const parts = name
    .trim()
    .split(/\s+/)
    .filter((part) => /^[\p{L}\p{N}]/u.test(part));
  const first = parts[0]?.[0] ?? '?';
  const last = parts.length > 1 ? (parts.at(-1)?.[0] ?? '') : '';
  return (first + last).toUpperCase();
}

/** Stable hue per name so workspace marks are recognisable without extra data. */
function hue(name: string): number {
  let hash = 0;
  for (const char of name) hash = (hash * 31 + char.charCodeAt(0)) >>> 0;
  return hash % 360;
}

/**
 * A person's photo, or a blob drawn from their name (Blobatar) when there is
 * none. `square` is for workspaces: initials on a rounded square. Decorative:
 * the name is always shown or announced next to it.
 */
export function Avatar({
  name,
  src,
  size = 'md',
  square = false,
  className,
}: {
  name: string;
  src?: string | null;
  size?: keyof typeof sizes;
  square?: boolean;
  className?: string;
}) {
  const { className: sizeClass, px } = sizes[size];
  return (
    <AvatarPrimitive.Root
      className={cn(
        'inline-flex shrink-0 overflow-hidden align-middle select-none',
        square ? 'rounded-[25%]' : 'rounded-full',
        sizeClass,
        className,
      )}
    >
      {src && <AvatarPrimitive.Image src={src} alt="" className="size-full object-cover" />}
      <AvatarPrimitive.Fallback aria-hidden className="flex size-full">
        {square ? (
          <span
            className="flex size-full items-center justify-center font-semibold text-white"
            style={{ background: `oklch(0.47 0.11 ${hue(name)})` }}
          >
            {initials(name)}
          </span>
        ) : (
          <Blobatar name={name} size={px} background="circle" alt="" className="size-full" />
        )}
      </AvatarPrimitive.Fallback>
    </AvatarPrimitive.Root>
  );
}
