import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  cn,
} from '@daiq/ui';
import { CheckIcon, PlusIcon } from 'lucide-react';
import { useState, type ReactNode } from 'react';
import { m } from '../../i18n';

export interface PickerOption {
  value: string;
  label: string;
  icon?: ReactNode;
  /** Extra words that match when filtering (e.g. "urgent" for priority 1). */
  keywords?: string[];
  hint?: string;
}

export interface PickerListProps {
  options: readonly PickerOption[];
  selected: readonly string[];
  multiple?: boolean;
  placeholder: string;
  onSelect: (values: string[]) => void;
  /** Called after a single-select choice or when a multi-select list should close. */
  onDone?: () => void;
  /** Offer "Create …" for the typed text (e.g. new labels). */
  onCreate?: (text: string) => void;
  autoFocus?: boolean;
}

/**
 * Type-to-filter option list used by every property picker (ux-principles.md).
 * Selected values are listed first; Enter applies; multi-select stays open.
 */
export function PickerList({
  options,
  selected,
  multiple = false,
  placeholder,
  onSelect,
  onDone,
  onCreate,
  autoFocus = true,
}: PickerListProps) {
  const [query, setQuery] = useState('');
  // Keep the opening order stable while toggling so items don't jump under the cursor.
  const [initialSelection] = useState(() => new Set(selected));
  const ordered = [...options].sort(
    (a, b) => Number(initialSelection.has(b.value)) - Number(initialSelection.has(a.value)),
  );
  const trimmed = query.trim();
  const exactMatch = options.some((o) => o.label.toLowerCase() === trimmed.toLowerCase());

  const choose = (value: string) => {
    if (multiple) {
      onSelect(
        selected.includes(value) ? selected.filter((v) => v !== value) : [...selected, value],
      );
    } else {
      onSelect([value]);
      onDone?.();
    }
  };

  return (
    <Command loop className="w-full">
      <CommandInput
        value={query}
        onValueChange={setQuery}
        placeholder={placeholder}
        autoFocus={autoFocus}
      />
      <CommandList className="max-h-72">
        <CommandEmpty>
          {onCreate ? m.tasks.picker.typeToCreate : m.tasks.picker.noMatches}
        </CommandEmpty>
        <CommandGroup>
          {ordered.map((option) => {
            const isSelected = selected.includes(option.value);
            return (
              <CommandItem
                key={option.value}
                value={`${option.label} ${option.value}`}
                keywords={option.keywords ?? []}
                onSelect={() => choose(option.value)}
                icon={option.icon}
                className={cn(isSelected && 'font-medium')}
                trailing={
                  isSelected ? (
                    <CheckIcon
                      className="!text-accent-text"
                      aria-label={m.tasks.picker.selectedMark}
                    />
                  ) : null
                }
              >
                {option.label}
                {option.hint && <span className="ml-2 text-xs text-fg-subtle">{option.hint}</span>}
              </CommandItem>
            );
          })}
          {onCreate && trimmed && !exactMatch && (
            <CommandItem
              value={`create ${trimmed}`}
              onSelect={() => onCreate(trimmed)}
              icon={<PlusIcon />}
            >
              {m.tasks.picker.create(trimmed)}
            </CommandItem>
          )}
        </CommandGroup>
      </CommandList>
      {multiple && (
        <p className="border-t border-border px-3 py-2 text-[11px] text-fg-subtle">
          {m.tasks.picker.multipleHint}
        </p>
      )}
    </Command>
  );
}
