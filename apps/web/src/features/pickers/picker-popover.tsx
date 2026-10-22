import { Popover, PopoverContent, PopoverTrigger } from '@daiq/ui';
import { useState, type ReactElement } from 'react';
import { PickerList, type PickerListProps } from './picker-list';

/** A property picker anchored to its trigger (mouse path; keyboard uses the picker dialog). */
export function PickerPopover({
  trigger,
  ...list
}: Omit<PickerListProps, 'onDone'> & { trigger: ReactElement<Record<string, unknown>> }) {
  const [open, setOpen] = useState(false);
  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger render={trigger} />
      <PopoverContent className="w-64 p-0">
        {open && <PickerList {...list} onDone={() => setOpen(false)} />}
      </PopoverContent>
    </Popover>
  );
}
