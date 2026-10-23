import { Select as SelectPrimitive } from '@base-ui/react/select';
import { CheckIcon, ChevronsUpDownIcon } from 'lucide-react';
import type { ReactNode } from 'react';
import { cn } from '../cn';

export interface SelectOption {
  value: string;
  label: string;
  icon?: ReactNode;
}

export interface SelectProps {
  options: readonly SelectOption[];
  value?: string | null;
  defaultValue?: string | null;
  onValueChange?: (value: string) => void;
  /** Submits the value with a form, like a native select. */
  name?: string;
  /** Put on the trigger, so `<Label htmlFor>` names it. */
  id?: string;
  'aria-label'?: string;
  placeholder?: string;
  disabled?: boolean;
  required?: boolean;
  size?: 'sm' | 'md';
  className?: string;
}

/** A themed select (Base UI): typeahead, arrow keys and form submission like a native one. */
export function Select({
  options,
  value,
  defaultValue,
  onValueChange,
  name,
  id,
  'aria-label': ariaLabel,
  placeholder,
  disabled,
  required,
  size = 'md',
  className,
}: SelectProps) {
  return (
    <SelectPrimitive.Root
      items={options}
      value={value}
      defaultValue={defaultValue}
      onValueChange={(next) => {
        if (typeof next === 'string') onValueChange?.(next);
      }}
      name={name}
      disabled={disabled}
      required={required}
    >
      <SelectPrimitive.Trigger
        id={id}
        aria-label={ariaLabel}
        className={cn(
          'inline-flex min-w-0 items-center justify-between gap-2 rounded-md border border-border bg-surface pr-1.5 pl-2.5 text-left text-[13px] shadow-xs transition-[background-color,border-color] duration-(--animate-duration-fast) outline-none select-none hover:bg-surface-muted focus-visible:border-focus data-popup-open:bg-surface-muted data-disabled:opacity-50',
          size === 'sm' ? 'h-7' : 'h-8',
          className,
        )}
      >
        <SelectPrimitive.Value placeholder={placeholder}>
          {(current: string | null) => {
            const option = options.find((o) => o.value === current);
            if (!option) return <span className="truncate text-fg-subtle">{placeholder}</span>;
            return (
              <span className="flex min-w-0 items-center gap-2 [&_svg]:size-4 [&_svg]:shrink-0">
                {option.icon}
                <span className="truncate">{option.label}</span>
              </span>
            );
          }}
        </SelectPrimitive.Value>
        <SelectPrimitive.Icon className="text-fg-subtle">
          <ChevronsUpDownIcon className="size-3.5" />
        </SelectPrimitive.Icon>
      </SelectPrimitive.Trigger>
      <SelectPrimitive.Portal>
        <SelectPrimitive.Positioner
          sideOffset={4}
          alignItemWithTrigger={false}
          className="z-50 outline-none select-none"
        >
          <SelectPrimitive.Popup className="max-h-(--available-height) min-w-(--anchor-width) popup-motion overflow-y-auto rounded-lg border border-border bg-overlay p-1 text-fg shadow-popover outline-none">
            <SelectPrimitive.List className="stagger-items">
              {options.map((option) => (
                <SelectPrimitive.Item
                  key={option.value}
                  value={option.value}
                  className="relative flex h-8 cursor-default items-center gap-2 rounded-md pr-8 pl-2 text-[13px] outline-none select-none data-highlighted:bg-surface-muted data-disabled:opacity-50 [&_svg]:size-4 [&_svg]:shrink-0 [&_svg]:text-fg-muted"
                >
                  {option.icon}
                  <SelectPrimitive.ItemText className="truncate">
                    {option.label}
                  </SelectPrimitive.ItemText>
                  <SelectPrimitive.ItemIndicator className="absolute right-2 animate-pop">
                    <CheckIcon />
                  </SelectPrimitive.ItemIndicator>
                </SelectPrimitive.Item>
              ))}
            </SelectPrimitive.List>
          </SelectPrimitive.Popup>
        </SelectPrimitive.Positioner>
      </SelectPrimitive.Portal>
    </SelectPrimitive.Root>
  );
}
