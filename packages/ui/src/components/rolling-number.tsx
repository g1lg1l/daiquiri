import { cn } from '../cn';

// Custom properties in `style` (here `--digit`), typed once for the whole app.
declare module 'react' {
  interface CSSProperties {
    [key: `--${string}`]: string | number | undefined;
  }
}

const DIGITS = '0123456789';

/**
 * A number (or a short text such as "6.8 d") whose digits roll like an
 * odometer: up from zero when it appears, to the new value when it changes.
 * Pure CSS (`@starting-style` + a spring transition); screen readers get the
 * plain text.
 */
export function RollingNumber({
  value,
  className,
}: {
  value: number | string;
  className?: string;
}) {
  const text =
    typeof value === 'number' ? value.toLocaleString(document.documentElement.lang || 'en') : value;
  const chars = text.split('');
  return (
    <span className={cn('inline-flex tabular', className)}>
      <span className="sr-only">{text}</span>
      <span aria-hidden className="inline-flex">
        {chars.map((char, index) => {
          // Keyed from the right, so 9 → 10 adds a column instead of shifting them all.
          const key = chars.length - index;
          const digit = DIGITS.indexOf(char);
          if (digit < 0)
            return (
              <span key={`c${key}`} className="whitespace-pre">
                {char}
              </span>
            );
          return (
            <span key={`d${key}`} className="roll-window">
              {/* The 0–9 column is CSS content, so copying the page copies only the number. */}
              <span
                className="roll-column"
                style={{ '--digit': digit, '--delay': `${(chars.length - index) * 30}ms` }}
              />
            </span>
          );
        })}
      </span>
    </span>
  );
}
