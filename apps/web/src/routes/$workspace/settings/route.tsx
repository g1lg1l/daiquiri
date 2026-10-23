import { can } from '@daiq/domain';
import { cn } from '@daiq/ui';
import { createFileRoute, Link, Outlet } from '@tanstack/react-router';
import { SettingsIcon } from 'lucide-react';
import { ViewHeader } from '../../../features/shell/view-header';
import { useWorkspace } from '../../../features/workspace/workspace-context';

export const Route = createFileRoute('/$workspace/settings')({ component: SettingsLayout });

const SECTIONS = [
  { to: '/$workspace/settings', label: 'General', exact: true },
  { to: '/$workspace/settings/members', label: 'Members', exact: false },
  { to: '/$workspace/settings/teams', label: 'Teams', exact: false },
  { to: '/$workspace/settings/labels', label: 'Labels', exact: false },
  { to: '/$workspace/settings/fields', label: 'Fields', exact: false },
  { to: '/$workspace/settings/templates', label: 'Templates', exact: false },
  { to: '/$workspace/settings/preferences', label: 'Preferences', exact: false },
] as const;

function SettingsLayout() {
  const { workspace } = useWorkspace();
  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <ViewHeader title="Settings" icon={<SettingsIcon className="size-4 text-fg-muted" />} />
      <div className="flex min-h-0 flex-1 flex-col md:flex-row">
        <nav
          aria-label="Settings"
          className="flex shrink-0 gap-1 overflow-x-auto border-b border-border px-3 py-2 md:w-48 md:flex-col md:border-r md:border-b-0"
        >
          {SECTIONS.map((section) => (
            <Link
              key={section.to}
              to={section.to}
              params={{ workspace: workspace.slug }}
              activeOptions={{ exact: section.exact }}
              className={cn(
                'rounded-md px-2 py-1.5 text-[13px] whitespace-nowrap text-fg-muted hover:bg-surface-muted hover:text-fg',
              )}
              activeProps={{ className: 'bg-surface-emphasis font-medium text-fg' }}
            >
              {section.label}
            </Link>
          ))}
          {!can(workspace.role, 'settings.advanced') && (
            <p className="hidden px-2 pt-3 text-xs text-fg-subtle md:block">
              Some settings are only available to admins.
            </p>
          )}
        </nav>
        <div className="min-h-0 flex-1 overflow-y-auto px-6 py-6 scrollbar-thin">
          <div className="mx-auto flex max-w-2xl flex-col gap-8">
            <Outlet />
          </div>
        </div>
      </div>
    </div>
  );
}
