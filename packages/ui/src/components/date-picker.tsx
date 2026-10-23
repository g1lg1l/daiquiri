import { Popover as PopoverPrimitive } from '@base-ui/react/popover';
import { lazy, Suspense, useState, type ReactElement } from 'react';
import { cn } from '../cn';
import { PopoverContent } from './popover';

const Calendar = lazy(() => import('./calendar'));
const calendarFallback = <div className="h-[262px] w-56" />;

/** The month grid on its own, for pickers that are not a popover. */
export function InlineCalendar(props: {
  value: string | null;
  onChange: (value: string) => void;
  locale?: string;
}) {
  return (
    <Suspense fallback={calendarFallback}>
      <Calendar locale="en" {...props} autoFocus={false} />
    </Suspense>
  );
}

export interface DatePickerProps {
  value: string | null;
  onChange: (value: string | null) => void;
  /** The trigger, usually a button showing the date (Base UI `render`). */
  children: ReactElement<Record<string, unknown>>;
  /** Names the popup for screen readers, e.g. "Due date". */
  label: string;
  /** One-click dates shown above the calendar ("Today", "Next week"…). */
  quickPicks?: readonly { label: string; value: string }[];
  /** Shown, when there is a date, to remove it. */
  clearLabel?: string;
  /** Language of month and weekday names. */
  locale?: string;
  align?: 'start' | 'center' | 'end';
}

/** A calendar in a popover; picking a date closes it. Dates are "YYYY-MM-DD". */
export function DatePicker({
  value,
  onChange,
  children,
  label,
  quickPicks,
  clearLabel,
  locale = 'en',
  align = 'start',
}: DatePickerProps) {
  const [open, setOpen] = useState(false);
  const pick = (next: string | null) => {
    onChange(next);
    setOpen(false);
  };
  return (
    <PopoverPrimitive.Root open={open} onOpenChange={setOpen}>
      <PopoverPrimitive.Trigger render={children} />
      <PopoverContent align={align} aria-label={label} className="flex flex-col gap-2 p-2">
        {quickPicks && quickPicks.length > 0 && (
          <div className="flex flex-wrap gap-1">
            {quickPicks.map((quick) => (
              <button
                key={quick.label}
                type="button"
                onClick={() => pick(quick.value)}
                className={cn(
                  'h-6 rounded-full border border-border px-2 text-xs transition-[background-color,scale] hover:bg-surface-muted active:scale-95',
                  quick.value === value && 'border-accent bg-accent-subtle text-accent-text',
                )}
              >
                {quick.label}
              </button>
            ))}
          </div>
        )}
        <Suspense fallback={calendarFallback}>
          <Calendar value={value} onChange={pick} locale={locale} />
        </Suspense>
        {clearLabel && value && (
          <button
            type="button"
            onClick={() => pick(null)}
            className="h-7 rounded-md text-xs text-fg-muted hover:bg-surface-muted hover:text-fg"
          >
            {clearLabel}
          </button>
        )}
      </PopoverContent>
    </PopoverPrimitive.Root>
  );
}
