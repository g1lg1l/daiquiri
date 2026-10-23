import { can } from '@daiq/domain';
import { cn, GlideThumb } from '@daiq/ui';
import { createFileRoute, Link, Outlet, useLocation } from '@tanstack/react-router';
import { SettingsIcon } from 'lucide-react';
import { ViewHeader } from '../../../features/shell/view-header';
import { useWorkspace } from '../../../features/workspace/workspace-context';
import { m } from '../../../i18n/settings';

export const Route = createFileRoute('/$workspace/settings')({ component: SettingsLayout });

const SECTIONS = [
  { to: '/$workspace/settings', key: 'general', exact: true },
  { to: '/$workspace/settings/members', key: 'members', exact: false },
  { to: '/$workspace/settings/teams', key: 'teams', exact: false },
  { to: '/$workspace/settings/labels', key: 'labels', exact: false },
  { to: '/$workspace/settings/fields', key: 'fields', exact: false },
  { to: '/$workspace/settings/templates', key: 'templates', exact: false },
  { to: '/$workspace/settings/import', key: 'import', exact: false },
  { to: '/$workspace/settings/webhooks', key: 'webhooks', exact: false },
  { to: '/$workspace/settings/trash', key: 'trash', exact: false },
  { to: '/$workspace/settings/preferences', key: 'preferences', exact: false },
] as const;

function SettingsLayout() {
  const { workspace } = useWorkspace();
  const pathname = useLocation({ select: (location) => location.pathname });
  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <ViewHeader
        title={m.settings.title}
        icon={<SettingsIcon className="size-4 text-fg-muted" />}
      />
      <div className="flex min-h-0 flex-1 flex-col md:flex-row">
        <nav
          aria-label={m.settings.title}
          className="relative isolate flex shrink-0 gap-1 overflow-x-auto border-b border-border px-3 py-2 md:w-48 md:flex-col md:border-r md:border-b-0"
        >
          <GlideThumb activeKey={pathname} className="bg-surface-raised shadow-card" />
          {SECTIONS.map((section) => (
            <Link
              key={section.to}
              to={section.to}
              params={{ workspace: workspace.slug }}
              activeOptions={{ exact: section.exact }}
              className={cn(
                'rounded-md px-2 py-1.5 text-[13px] whitespace-nowrap text-fg-muted transition-colors hover:text-fg',
              )}
              activeProps={{ className: 'font-medium text-fg' }}
            >
              {m.settings.sections[section.key]}
            </Link>
          ))}
          {!can(workspace.role, 'settings.advanced') && (
            <p className="hidden px-2 pt-3 text-xs text-fg-subtle md:block">
              {m.settings.adminsOnly}
            </p>
          )}
        </nav>
        <div className="min-h-0 flex-1 overflow-y-auto px-6 py-6 scrollbar-thin">
          <div className="mx-auto flex max-w-2xl flex-col gap-8">
            <div key={pathname} className="flex swap-in flex-col gap-8">
              <Outlet />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
