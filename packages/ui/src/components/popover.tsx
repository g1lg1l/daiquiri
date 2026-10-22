import { Popover as PopoverPrimitive } from '@base-ui/react/popover';
import { cn } from '../cn';

export const Popover = PopoverPrimitive.Root;
export const PopoverTrigger = PopoverPrimitive.Trigger;
export const PopoverClose = PopoverPrimitive.Close;

type PositionProps = Pick<PopoverPrimitive.Positioner.Props, 'align' | 'side' | 'sideOffset'>;

export function PopoverContent({
  className,
  align = 'start',
  side = 'bottom',
  sideOffset = 6,
  ...props
}: PopoverPrimitive.Popup.Props & PositionProps) {
  return (
    <PopoverPrimitive.Portal>
      <PopoverPrimitive.Positioner
        align={align}
        side={side}
        sideOffset={sideOffset}
        className="z-50"
      >
        <PopoverPrimitive.Popup
          className={cn(
            'origin-(--transform-origin) rounded-lg border border-border bg-overlay text-fg shadow-popover outline-none',
            'duration-120 data-open:animate-in data-open:fade-in-0 data-open:zoom-in-[0.97] data-closed:animate-out data-closed:fade-out-0 data-closed:zoom-out-[0.97]',
            className,
          )}
          {...props}
        />
      </PopoverPrimitive.Positioner>
    </PopoverPrimitive.Portal>
  );
}
