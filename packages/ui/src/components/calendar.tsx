import { ChevronLeftIcon, ChevronRightIcon } from 'lucide-react';
import { DayPicker } from 'react-day-picker';
import { enUS, it } from 'react-day-picker/locale';

/*
 * The month grid of the date picker (react-day-picker, as in shadcn/ui).
 * Loaded on demand by date-picker.tsx. Dates cross this boundary as
 * "YYYY-MM-DD" calendar days, never as instants.
 */

const LOCALES = { en: enUS, it };

const toDate = (iso: string) => {
  const [year = 0, month = 1, day = 1] = iso.split('-').map(Number);
  return new Date(year, month - 1, day);
};
const toIso = (date: Date) =>
  `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;

function Chevron({ orientation }: { orientation?: 'up' | 'down' | 'left' | 'right' }) {
  return orientation === 'left' ? (
    <ChevronLeftIcon className="size-4" />
  ) : (
    <ChevronRightIcon className="size-4" />
  );
}

export default function Calendar({
  value,
  onChange,
  locale,
  autoFocus = true,
}: {
  value: string | null;
  onChange: (value: string) => void;
  locale: string;
  autoFocus?: boolean;
}) {
  const selected = value ? toDate(value) : undefined;
  return (
    <DayPicker
      mode="single"
      required
      selected={selected}
      defaultMonth={selected}
      onSelect={(date) => onChange(toIso(date))}
      locale={locale === 'it' ? LOCALES.it : LOCALES.en}
      weekStartsOn={1}
      showOutsideDays
      fixedWeeks
      autoFocus={autoFocus}
      animate
      classNames={{
        root: 'relative w-fit text-[13px]',
        months: 'relative flex flex-col',
        month: 'flex flex-col gap-1.5',
        nav: 'absolute inset-x-0 top-0 z-10 flex items-center justify-between',
        button_previous:
          'inline-flex size-7 items-center justify-center rounded-md text-fg-muted transition-[background-color,scale] hover:bg-surface-muted hover:text-fg active:scale-90',
        button_next:
          'inline-flex size-7 items-center justify-center rounded-md text-fg-muted transition-[background-color,scale] hover:bg-surface-muted hover:text-fg active:scale-90',
        month_caption: 'flex h-7 items-center justify-center',
        caption_label: 'font-semibold capitalize',
        month_grid: 'border-collapse',
        weekdays: 'flex',
        weekday: 'w-8 pb-1 text-[11px] font-medium text-fg-subtle capitalize',
        week: 'flex',
        day: 'group/day size-8 p-0 text-center',
        day_button: [
          'size-8 rounded-md tabular transition-[background-color,color,scale] duration-150 outline-none hover:bg-surface-muted active:scale-90 focus-visible:outline-2 focus-visible:outline-focus',
          'group-data-today/day:font-semibold group-data-today/day:text-accent-text group-data-outside/day:text-fg-subtle',
          'group-data-selected/day:animate-pop group-data-selected/day:bg-accent group-data-selected/day:text-accent-fg! group-data-selected/day:hover:bg-accent',
        ].join(' '),
        hidden: 'invisible',
        // Month changes slide; react-day-picker wants one class per state.
        weeks_before_enter: 'month-in-from-left',
        weeks_before_exit: 'month-out-to-right',
        weeks_after_enter: 'month-in-from-right',
        weeks_after_exit: 'month-out-to-left',
        caption_after_enter: 'month-in-from-right',
        caption_before_enter: 'month-in-from-left',
      }}
      components={{ Chevron }}
    />
  );
}
