import { useRealtimeSync, useWorkspaces } from '@daiq/data';
import { cn } from '@daiq/ui';
import { createFileRoute, Link, Outlet, useNavigate, useParams } from '@tanstack/react-router';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { Splash } from '../../components/splash';
import { PaletteProvider, usePalette } from '../../features/command-palette/palette';
import { ShellProvider, useShell } from '../../features/shell/shell-context';
import { Sidebar } from '../../features/shell/sidebar';
import { ShortcutSheet } from '../../features/shortcuts/shortcut-sheet';
import { useShortcuts } from '../../features/shortcuts/use-shortcuts';
import { ComposerProvider, useComposer } from '../../features/tasks/composer';
import { TaskActionsProvider } from '../../features/tasks/task-actions';
import { undoLast } from '../../features/undo/undo';
import {
  useWorkspace,
  useWorkspaceData,
  WorkspaceProvider,
} from '../../features/workspace/workspace-context';
import { rememberWorkspace } from '../../lib/last-workspace';
import { logger } from '../../lib/logger';
import { requireAuth } from '../../app/router-context';

export const Route = createFileRoute('/$workspace')({
  beforeLoad: requireAuth,
  component: WorkspaceLayout,
});

function WorkspaceLayout() {
  const { workspace: slug } = Route.useParams();
  const { auth } = Route.useRouteContext();
  const workspaces = useWorkspaces(auth.userId);
  const workspace = workspaces.data?.find((w) => w.slug === slug);

  useEffect(() => {
    if (workspace) rememberWorkspace(workspace.slug);
  }, [workspace]);

  if (!workspaces.data) return <Splash />;
  if (!workspace) {
    return (
      <main className="mx-auto flex max-w-md flex-col items-start gap-3 px-6 py-24">
        <h1 className="text-xl font-semibold font-display">Workspace not found</h1>
        <p className="text-fg-muted">It doesn’t exist, or you are not a member of it.</p>
        <Link to="/" className="text-accent-text hover:underline">
          Go to your workspaces
        </Link>
      </main>
    );
  }

  return (
    <WorkspaceProvider workspace={workspace} userId={auth.userId}>
      <ShellProvider>
        <WorkspaceShell />
      </ShellProvider>
    </WorkspaceProvider>
  );
}

function WorkspaceShell() {
  const [shortcutsOpen, setShortcutsOpen] = useState(false);
  const showShortcuts = useCallback(() => setShortcutsOpen(true), []);
  return (
    <ComposerProvider>
      <TaskActionsProvider>
        <PaletteProvider onShowShortcuts={showShortcuts}>
          <Shell />
          <ShortcutSheet open={shortcutsOpen} onOpenChange={setShortcutsOpen} />
        </PaletteProvider>
      </TaskActionsProvider>
    </ComposerProvider>
  );
}

function Shell() {
  const { workspace, userId } = useWorkspace();
  const data = useWorkspaceData();
  const { sidebarOpen, isMobile, toggleSidebar, closeSidebarOnMobile } = useShell();
  const composer = useComposer();
  const palette = usePalette();
  const navigate = useNavigate();
  const params = useParams({ strict: false });
  const ws = workspace.slug;
  const currentTeam = (params.teamKey && data.teamsByKey.get(params.teamKey)) || data.myTeams[0];

  // Realtime: workspace + user topics, plus every team the user belongs to (bounded).
  const teamIds = useMemo(() => data.myTeams.map((team) => team.id), [data.myTeams]);
  useRealtimeSync({
    workspaceId: workspace.id,
    userId,
    teamIds,
    onError: (error) => logger.error('realtime.apply_failed', error),
  });

  useShortcuts({
    create: () => composer(currentTeam ? { teamId: currentTeam.id } : {}),
    toggleSidebar,
    undo: undoLast,
    help: palette.showShortcuts,
    goInbox: () => void navigate({ to: '/$workspace/inbox', params: { workspace: ws } }),
    goMyTasks: () => void navigate({ to: '/$workspace/my-tasks', params: { workspace: ws } }),
    goTeam: () =>
      currentTeam &&
      void navigate({
        to: '/$workspace/team/$teamKey/tasks',
        params: { workspace: ws, teamKey: currentTeam.key },
      }),
    goProjects: () =>
      currentTeam &&
      void navigate({
        to: '/$workspace/team/$teamKey/projects',
        params: { workspace: ws, teamKey: currentTeam.key },
      }),
    goSettings: () => void navigate({ to: '/$workspace/settings', params: { workspace: ws } }),
  });

  if (!data.ready) return <Splash />;

  return (
    <div className="flex h-dvh overflow-hidden">
      <a
        href="#main"
        className="sr-only z-50 rounded-md bg-surface px-3 py-2 focus:not-sr-only focus:fixed focus:top-2 focus:left-2"
      >
        Skip to content
      </a>
      {isMobile && sidebarOpen && (
        <button
          type="button"
          aria-label="Close navigation"
          className="fixed inset-0 z-30 bg-scrim"
          onClick={closeSidebarOnMobile}
        />
      )}
      <div
        className={cn(
          'shrink-0 transition-[margin,transform] duration-200 ease-standard motion-reduce:transition-none',
          isMobile ? 'fixed inset-y-0 left-0 z-40' : 'relative',
          sidebarOpen ? 'translate-x-0' : isMobile ? '-translate-x-full' : '-ml-60',
        )}
        inert={!sidebarOpen || undefined}
      >
        <Sidebar />
      </div>
      <main id="main" className="flex min-w-0 flex-1 flex-col overflow-hidden">
        <Outlet />
      </main>
    </div>
  );
}
