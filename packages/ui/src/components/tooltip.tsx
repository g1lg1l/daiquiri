import { Tooltip as TooltipPrimitive } from '@base-ui/react/tooltip';
import type { ReactElement, ReactNode } from 'react';
import { cn } from '../cn';
import { Shortcut } from './kbd';

export const TooltipProvider = TooltipPrimitive.Provider;

interface TooltipProps {
  /** The element that triggers the tooltip; rendered via Base UI's `render` prop. */
  children: ReactElement<Record<string, unknown>>;
  label: ReactNode;
  shortcut?: string;
  side?: TooltipPrimitive.Positioner.Props['side'];
}

/** Tooltip with an optional shortcut hint — the main way shortcuts are taught in place. */
export function Tooltip({ children, label, shortcut, side = 'bottom' }: TooltipProps) {
  return (
    <TooltipPrimitive.Root>
      <TooltipPrimitive.Trigger render={children} />
      <TooltipPrimitive.Portal>
        <TooltipPrimitive.Positioner side={side} sideOffset={6} className="z-50">
          <TooltipPrimitive.Popup
            className={cn(
              'flex origin-(--transform-origin) items-center gap-2 rounded-md bg-fg px-2 py-1 text-xs text-fg-inverted shadow-popover',
              'data-open:animate-in data-open:fade-in-0 data-open:zoom-in-95 data-closed:animate-out data-closed:fade-out-0 data-closed:zoom-out-95',
              '[&_kbd]:border-transparent [&_kbd]:bg-fg-inverted/15 [&_kbd]:text-fg-inverted',
            )}
          >
            {label}
            {shortcut && <Shortcut keys={shortcut} />}
          </TooltipPrimitive.Popup>
        </TooltipPrimitive.Positioner>
      </TooltipPrimitive.Portal>
    </TooltipPrimitive.Root>
  );
}
