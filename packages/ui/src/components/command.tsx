import { Command as CommandPrimitive } from 'cmdk';
import { SearchIcon } from 'lucide-react';
import type { ComponentProps, ReactNode } from 'react';
import { cn } from '../cn';
import { Dialog, DialogContent, DialogTitle } from './dialog';
import { Shortcut } from './kbd';

/*
 * Thin styling layer over cmdk. The app composes these into its CommandPalette;
 * keeping cmdk confined to this file makes it replaceable (see ADR-0008).
 */

export function Command({ className, ...props }: ComponentProps<typeof CommandPrimitive>) {
  return (
    <CommandPrimitive
      className={cn('flex flex-col overflow-hidden text-fg', className)}
      {...props}
    />
  );
}

export function CommandInput({
  className,
  ...props
}: ComponentProps<typeof CommandPrimitive.Input>) {
  return (
    <div className="flex items-center gap-2 border-b border-border px-3.5">
      <SearchIcon className="size-4 shrink-0 text-fg-subtle" aria-hidden />
      <CommandPrimitive.Input
        className={cn(
          'h-12 w-full bg-transparent text-[15px] outline-none placeholder:text-fg-subtle focus-visible:outline-none',
          className,
        )}
        {...props}
      />
    </div>
  );
}

export function CommandList({ className, ...props }: ComponentProps<typeof CommandPrimitive.List>) {
  return (
    <CommandPrimitive.List
      className={cn(
        'max-h-[min(60vh,420px)] scroll-py-2 scrollbar-thin overflow-y-auto overscroll-contain p-1.5',
        'h-(--cmdk-list-height) transition-[height] duration-120 ease-standard',
        className,
      )}
      {...props}
    />
  );
}

export function CommandEmpty(props: ComponentProps<typeof CommandPrimitive.Empty>) {
  return (
    <CommandPrimitive.Empty className="py-10 text-center text-[13px] text-fg-muted" {...props} />
  );
}

export function CommandGroup({
  className,
  ...props
}: ComponentProps<typeof CommandPrimitive.Group>) {
  return (
    <CommandPrimitive.Group
      className={cn(
        '[&_[cmdk-group-heading]]:px-2 [&_[cmdk-group-heading]]:pt-2 [&_[cmdk-group-heading]]:pb-1 [&_[cmdk-group-heading]]:text-[11px] [&_[cmdk-group-heading]]:font-medium [&_[cmdk-group-heading]]:text-fg-subtle',
        className,
      )}
      {...props}
    />
  );
}

export function CommandItem({
  className,
  children,
  icon,
  shortcut,
  ...props
}: ComponentProps<typeof CommandPrimitive.Item> & { icon?: ReactNode; shortcut?: string }) {
  return (
    <CommandPrimitive.Item
      className={cn(
        'flex h-9 cursor-default items-center gap-2.5 rounded-md px-2 text-[13px] select-none data-[disabled=true]:opacity-50 data-[selected=true]:bg-surface-muted [&_svg]:size-4 [&_svg]:shrink-0 [&_svg]:text-fg-muted',
        className,
      )}
      {...props}
    >
      {icon}
      <span className="min-w-0 flex-1 truncate">{children}</span>
      {shortcut && <Shortcut keys={shortcut} />}
    </CommandPrimitive.Item>
  );
}

export function CommandDialog({
  open,
  onOpenChange,
  label,
  children,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  label: string;
  children: ReactNode;
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="top-[14vh] w-[min(100%-2rem,40rem)] gap-0 overflow-hidden p-0">
        <DialogTitle className="sr-only">{label}</DialogTitle>
        {children}
      </DialogContent>
    </Dialog>
  );
}
