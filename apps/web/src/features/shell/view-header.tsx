import { Button, cn, Tooltip } from '@daiq/ui';
import { PanelLeftIcon } from 'lucide-react';
import type { ReactNode } from 'react';
import { SHORTCUTS } from '../shortcuts/registry';
import { useShell } from './shell-context';

/** Header of every main view: sidebar toggle (when hidden), title, and view controls. */
export function ViewHeader({
  title,
  icon,
  children,
  className,
}: {
  title: ReactNode;
  icon?: ReactNode;
  children?: ReactNode;
  className?: string;
}) {
  const { sidebarOpen, isMobile, toggleSidebar } = useShell();
  return (
    <header
      className={cn(
        'sticky top-0 z-20 flex h-12 shrink-0 items-center gap-2 border-b border-border bg-surface/90 px-3 backdrop-blur-sm md:px-4',
        className,
      )}
    >
      {(!sidebarOpen || isMobile) && (
        <Tooltip label="Show sidebar" shortcut={SHORTCUTS.toggleSidebar.keys}>
          <Button variant="ghost" size="icon-sm" aria-label="Show sidebar" onClick={toggleSidebar}>
            <PanelLeftIcon />
          </Button>
        </Tooltip>
      )}
      <h1 className="flex min-w-0 items-center gap-2 truncate text-[13px] font-semibold">
        {icon}
        {title}
      </h1>
      <div className="ml-auto flex items-center gap-1">{children}</div>
    </header>
  );
}
