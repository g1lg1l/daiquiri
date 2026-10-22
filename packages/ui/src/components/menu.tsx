import { Menu as MenuPrimitive } from '@base-ui/react/menu';
import { CheckIcon, ChevronRightIcon } from 'lucide-react';
import type { ComponentProps } from 'react';
import { cn } from '../cn';
import { Shortcut } from './kbd';

export const Menu = MenuPrimitive.Root;
export const MenuTrigger = MenuPrimitive.Trigger;
export const MenuGroup = MenuPrimitive.Group;
export const MenuSub = MenuPrimitive.SubmenuRoot;

const itemClass =
  'relative flex h-8 cursor-default items-center gap-2 rounded-md px-2 text-[13px] outline-none select-none data-highlighted:bg-surface-muted data-disabled:pointer-events-none data-disabled:opacity-50 [&_svg]:size-4 [&_svg]:shrink-0 [&_svg]:text-fg-muted';

type PositionProps = Pick<MenuPrimitive.Positioner.Props, 'align' | 'side' | 'sideOffset'>;

export function MenuContent({
  className,
  align = 'start',
  side = 'bottom',
  sideOffset = 6,
  ...props
}: MenuPrimitive.Popup.Props & PositionProps) {
  return (
    <MenuPrimitive.Portal>
      <MenuPrimitive.Positioner
        align={align}
        side={side}
        sideOffset={sideOffset}
        className="z-50 outline-none"
      >
        <MenuPrimitive.Popup
          className={cn(
            'max-h-(--available-height) min-w-48 origin-(--transform-origin) overflow-y-auto rounded-lg border border-border bg-overlay p-1 text-fg shadow-popover outline-none',
            'duration-120 data-open:animate-in data-open:fade-in-0 data-open:zoom-in-[0.97] data-closed:animate-out data-closed:fade-out-0',
            className,
          )}
          {...props}
        />
      </MenuPrimitive.Positioner>
    </MenuPrimitive.Portal>
  );
}

export function MenuItem({
  className,
  children,
  shortcut,
  destructive,
  ...props
}: MenuPrimitive.Item.Props & { shortcut?: string; destructive?: boolean }) {
  return (
    <MenuPrimitive.Item
      className={cn(itemClass, destructive && 'text-danger [&_svg]:text-danger', className)}
      {...props}
    >
      {children}
      {shortcut && <Shortcut keys={shortcut} className="ml-auto pl-4" />}
    </MenuPrimitive.Item>
  );
}

export function MenuCheckboxItem({
  className,
  children,
  ...props
}: MenuPrimitive.CheckboxItem.Props) {
  return (
    <MenuPrimitive.CheckboxItem className={cn(itemClass, 'pr-8', className)} {...props}>
      {children}
      <MenuPrimitive.CheckboxItemIndicator className="absolute right-2">
        <CheckIcon />
      </MenuPrimitive.CheckboxItemIndicator>
    </MenuPrimitive.CheckboxItem>
  );
}

export const MenuRadioGroup = MenuPrimitive.RadioGroup;

export function MenuRadioItem({ className, children, ...props }: MenuPrimitive.RadioItem.Props) {
  return (
    <MenuPrimitive.RadioItem className={cn(itemClass, 'pr-8', className)} {...props}>
      {children}
      <MenuPrimitive.RadioItemIndicator className="absolute right-2">
        <CheckIcon />
      </MenuPrimitive.RadioItemIndicator>
    </MenuPrimitive.RadioItem>
  );
}

export function MenuSubTrigger({
  className,
  children,
  ...props
}: MenuPrimitive.SubmenuTrigger.Props) {
  return (
    <MenuPrimitive.SubmenuTrigger
      className={cn(itemClass, 'data-popup-open:bg-surface-muted', className)}
      {...props}
    >
      {children}
      <ChevronRightIcon className="ml-auto" />
    </MenuPrimitive.SubmenuTrigger>
  );
}

export function MenuLabel({ className, ...props }: MenuPrimitive.GroupLabel.Props) {
  return (
    <MenuPrimitive.GroupLabel
      className={cn('px-2 pt-1.5 pb-1 text-[11px] font-medium text-fg-subtle', className)}
      {...props}
    />
  );
}

export function MenuSeparator({
  className,
  ...props
}: ComponentProps<typeof MenuPrimitive.Separator>) {
  return (
    <MenuPrimitive.Separator className={cn('-mx-1 my-1 h-px bg-border', className)} {...props} />
  );
}
