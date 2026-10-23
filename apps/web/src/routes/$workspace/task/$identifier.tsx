import { createFileRoute } from '@tanstack/react-router';
import { useShell } from '../../../features/shell/shell-context';
import { TaskDetail } from '../../../features/tasks/task-detail';
import { Button, Tooltip } from '@daiq/ui';
import { PanelLeftIcon } from 'lucide-react';
import { SHORTCUTS } from '../../../features/shortcuts/registry';
import { m } from '../../../i18n';

export const Route = createFileRoute('/$workspace/task/$identifier')({
  component: TaskPage,
});

function TaskPage() {
  const { identifier } = Route.useParams();
  const { sidebarOpen, isMobile, toggleSidebar } = useShell();
  return (
    <div className="relative flex min-h-0 flex-1 flex-col">
      {(!sidebarOpen || isMobile) && (
        <Tooltip label={m.task.showSidebar} shortcut={SHORTCUTS.toggleSidebar.keys}>
          <Button
            variant="ghost"
            size="icon-sm"
            aria-label={m.task.showSidebar}
            onClick={toggleSidebar}
            className="absolute top-2.5 left-2 z-10"
          >
            <PanelLeftIcon />
          </Button>
        </Tooltip>
      )}
      <TaskDetail key={identifier} identifier={identifier.toUpperCase()} mode="page" />
    </div>
  );
}
