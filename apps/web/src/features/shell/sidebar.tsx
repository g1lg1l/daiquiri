import {
  useAuthActions,
  useFavorites,
  useNotifications,
  useSavedViews,
  useWorkspaces,
  type SavedView,
} from '@daiq/data';
import type { Notification, Team } from '@daiq/domain';
import {
  Avatar,
  Button,
  cn,
  Menu,
  MenuContent,
  MenuItem,
  MenuLabel,
  MenuRadioGroup,
  MenuRadioItem,
  MenuSeparator,
  MenuSub,
  MenuSubTrigger,
  MenuTrigger,
  Shortcut,
  Tooltip,
  useTheme,
} from '@daiq/ui';
import { Link, useNavigate, useSearch } from '@tanstack/react-router';
import {
  ChevronDownIcon,
  ChevronRightIcon,
  CircleUserIcon,
  FolderIcon,
  InboxIcon,
  KeyboardIcon,
  LayersIcon,
  ListTodoIcon,
  LogOutIcon,
  PanelLeftIcon,
  PlusIcon,
  RefreshCcwIcon,
  SearchIcon,
  SettingsIcon,
  SparklesIcon,
  UserPlusIcon,
  UsersIcon,
  UploadIcon,
} from 'lucide-react';
import { useEffect, useState, type ReactNode } from 'react';
import { Wordmark } from '../../components/wordmark';
import { nowIso } from '../../lib/use-today';
import { usePalette } from '../command-palette/palette';
import { SHORTCUTS } from '../shortcuts/registry';
import { useComposer } from '../tasks/composer';
import { RunningTimer } from '../time/running-timer';
import { useWorkspace, useWorkspaceData } from '../workspace/workspace-context';
import { useShell } from './shell-context';

const navItem =
  'flex h-7 items-center gap-2 rounded-md px-2 text-[13px] text-fg-muted transition-colors hover:bg-surface-muted hover:text-fg [&_svg]:size-4 [&_svg]:shrink-0';
const activeNavItem = 'bg-surface-emphasis text-fg font-medium hover:bg-surface-emphasis';

function NavLink({
  to,
  params,
  icon,
  children,
  trailing,
  depth = 0,
  excludeSavedViews = false,
}: {
  to: string;
  params: Record<string, string>;
  icon: ReactNode;
  children: ReactNode;
  trailing?: ReactNode;
  depth?: number;
  /** Not current while a saved view of the same list is open. */
  excludeSavedViews?: boolean;
}) {
  const { closeSidebarOnMobile } = useShell();
  return (
    <Link
      to={to}
      params={params}
      className={cn(navItem, depth > 0 && 'pl-7')}
      // An explicit `view: undefined` only matches URLs without a saved view.
      {...(excludeSavedViews && {
        search: { view: undefined },
        activeOptions: { includeSearch: true, explicitUndefined: true },
      })}
      activeProps={{ className: activeNavItem }}
      onClick={closeSidebarOnMobile}
    >
      {icon}
      <span className="min-w-0 flex-1 truncate">{children}</span>
      {trailing}
    </Link>
  );
}

/** Unread, unarchived, not currently snoozed. Snoozes expire on the next minute tick. */
function useUnreadCount(notifications: readonly Notification[] | undefined): number {
  const [now, setNow] = useState(nowIso);
  useEffect(() => {
    const timer = setInterval(() => setNow(nowIso()), 60_000);
    return () => clearInterval(timer);
  }, []);
  return (
    notifications?.filter(
      (n) => !n.readAt && !n.archivedAt && (!n.snoozedUntil || n.snoozedUntil <= now),
    ).length ?? 0
  );
}

function readExpanded(teamId: string, fallback: boolean): boolean {
  try {
    const value = localStorage.getItem(`daiq-team-expanded:${teamId}`);
    return value === null ? fallback : value === '1';
  } catch {
    return fallback;
  }
}

function TeamSection({
  team,
  ws,
  defaultExpanded,
}: {
  team: Team;
  ws: string;
  defaultExpanded: boolean;
}) {
  const [expanded, setExpanded] = useState(() => readExpanded(team.id, defaultExpanded));
  const toggle = () =>
    setExpanded((value) => {
      try {
        localStorage.setItem(`daiq-team-expanded:${team.id}`, value ? '0' : '1');
      } catch {
        // Expansion is only remembered when storage is available.
      }
      return !value;
    });
  return (
    <li>
      <button
        type="button"
        className={cn(navItem, 'w-full')}
        aria-expanded={expanded}
        onClick={toggle}
      >
        <span
          aria-hidden
          className="flex size-4 items-center justify-center rounded-[4px] bg-surface-emphasis text-[9px] font-semibold text-fg-muted"
        >
          {team.key.slice(0, 2)}
        </span>
        <span className="min-w-0 flex-1 truncate text-left">{team.name}</span>
        {expanded ? (
          <ChevronDownIcon className="!size-3.5" />
        ) : (
          <ChevronRightIcon className="!size-3.5" />
        )}
      </button>
      {expanded && (
        <ul className="mt-0.5 flex flex-col gap-px">
          <li>
            <NavLink
              to="/$workspace/team/$teamKey/tasks"
              params={{ workspace: ws, teamKey: team.key }}
              icon={<ListTodoIcon />}
              depth={1}
              excludeSavedViews
            >
              Tasks
            </NavLink>
          </li>
          <li>
            <NavLink
              to="/$workspace/team/$teamKey/projects"
              params={{ workspace: ws, teamKey: team.key }}
              icon={<FolderIcon />}
              depth={1}
            >
              Projects
            </NavLink>
          </li>
          {team.cyclesEnabled && (
            <li>
              <NavLink
                to="/$workspace/team/$teamKey/cycles"
                params={{ workspace: ws, teamKey: team.key }}
                icon={<RefreshCcwIcon />}
                depth={1}
              >
                Cycles
              </NavLink>
            </li>
          )}
        </ul>
      )}
    </li>
  );
}

/** Opens a team task list with the saved view's params; current while that view is open. */
function SavedViewLink({ view, ws, icon }: { view: SavedView; ws: string; icon: ReactNode }) {
  const data = useWorkspaceData();
  const { closeSidebarOnMobile } = useShell();
  const viewId = useSearch({ strict: false, select: (search) => search.view });
  const team = view.teamId ? data.teamsById.get(view.teamId) : undefined;
  if (!team) return null;
  const current = viewId === view.id;
  return (
    <Link
      to="/$workspace/team/$teamKey/tasks"
      params={{ workspace: ws, teamKey: team.key }}
      search={{ ...view.config, view: view.id }}
      className={cn(navItem, current && activeNavItem)}
      aria-current={current ? 'page' : undefined}
      activeProps={{}}
      onClick={closeSidebarOnMobile}
    >
      {icon}
      <span className="min-w-0 flex-1 truncate">{view.name}</span>
    </Link>
  );
}

function WorkspaceMenu() {
  const { workspace, userId } = useWorkspace();
  const workspaces = useWorkspaces(userId);
  const navigate = useNavigate();
  const { preference, setPreference } = useTheme();
  const { signOut } = useAuthActions();
  const palette = usePalette();
  return (
    <Menu>
      <MenuTrigger
        render={
          <button
            type="button"
            aria-label={`Workspace menu: ${workspace.name}`}
            className="flex h-8 min-w-0 flex-1 items-center gap-2 rounded-md px-1.5 text-left hover:bg-surface-muted aria-expanded:bg-surface-muted"
          />
        }
      >
        <Avatar name={workspace.name} size="sm" square />
        <span className="min-w-0 flex-1 truncate text-[13px] font-semibold">{workspace.name}</span>
        <ChevronDownIcon className="size-3.5 text-fg-subtle" />
      </MenuTrigger>
      <MenuContent className="w-60">
        <MenuRadioGroup
          value={workspace.slug}
          onValueChange={(slug: string) =>
            void navigate({ to: '/$workspace', params: { workspace: slug } })
          }
        >
          <MenuLabel>Workspaces</MenuLabel>
          {workspaces.data?.map((w) => (
            <MenuRadioItem key={w.id} value={w.slug}>
              <Avatar name={w.name} size="xs" square />
              {w.name}
            </MenuRadioItem>
          ))}
        </MenuRadioGroup>
        <MenuItem onClick={() => void navigate({ to: '/onboarding' })}>
          <PlusIcon /> Create workspace
        </MenuItem>
        <MenuSeparator />
        <MenuItem
          onClick={() =>
            void navigate({
              to: '/$workspace/settings/members',
              params: { workspace: workspace.slug },
            })
          }
        >
          <UserPlusIcon /> Invite people
        </MenuItem>
        <MenuItem
          onClick={() =>
            void navigate({
              to: '/$workspace/settings/import',
              params: { workspace: workspace.slug },
            })
          }
        >
          <UploadIcon /> Import tasks
        </MenuItem>
        <MenuItem
          shortcut={SHORTCUTS.goSettings.keys}
          onClick={() =>
            void navigate({ to: '/$workspace/settings', params: { workspace: workspace.slug } })
          }
        >
          <SettingsIcon /> Settings
        </MenuItem>
        <MenuSub>
          <MenuSubTrigger>Theme</MenuSubTrigger>
          <MenuContent side="right" align="start" sideOffset={4} className="min-w-36">
            <MenuRadioGroup
              value={preference}
              onValueChange={(value: 'light' | 'dark' | 'system') => setPreference(value)}
            >
              <MenuRadioItem value="system">System</MenuRadioItem>
              <MenuRadioItem value="light">Light</MenuRadioItem>
              <MenuRadioItem value="dark">Dark</MenuRadioItem>
            </MenuRadioGroup>
          </MenuContent>
        </MenuSub>
        <MenuItem shortcut={SHORTCUTS.help.keys} onClick={palette.showShortcuts}>
          <KeyboardIcon /> Keyboard shortcuts
        </MenuItem>
        <MenuSeparator />
        <MenuItem onClick={() => void signOut()}>
          <LogOutIcon /> Sign out
        </MenuItem>
      </MenuContent>
    </Menu>
  );
}

export function Sidebar() {
  const { workspace, userId } = useWorkspace();
  const data = useWorkspaceData();
  const notifications = useNotifications(workspace.id);
  const composer = useComposer();
  const palette = usePalette();
  const { toggleSidebar, isMobile } = useShell();
  const ws = workspace.slug;
  const unread = useUnreadCount(notifications.data);
  const otherTeams = data.teams.filter((team) => !team.memberIds.includes(userId));
  const views = useSavedViews(workspace.id).data ?? [];
  const favorites = useFavorites(workspace.id).data ?? [];
  const viewsById = new Map(views.map((view) => [view.id, view]));
  const favoriteItems = favorites.flatMap((favorite) => {
    if (favorite.entityKind === 'project') {
      const project = data.projectsById.get(favorite.entityId);
      return project
        ? [
            <li key={project.id}>
              <NavLink
                to="/$workspace/project/$projectId"
                params={{ workspace: ws, projectId: project.id }}
                icon={<FolderIcon />}
              >
                {project.name}
              </NavLink>
            </li>,
          ]
        : [];
    }
    const view = favorite.entityKind === 'view' ? viewsById.get(favorite.entityId) : undefined;
    return view
      ? [
          <li key={view.id}>
            <SavedViewLink view={view} ws={ws} icon={<LayersIcon />} />
          </li>,
        ]
      : [];
  });

  return (
    <nav
      aria-label="Workspace"
      className="flex h-full w-60 flex-col gap-3 border-r border-border bg-surface-subtle px-2 py-2"
    >
      <div className="flex items-center gap-1">
        <WorkspaceMenu />
        {!isMobile && (
          <Tooltip label="Hide sidebar" shortcut={SHORTCUTS.toggleSidebar.keys}>
            <Button
              variant="ghost"
              size="icon-sm"
              aria-label="Hide sidebar"
              onClick={toggleSidebar}
            >
              <PanelLeftIcon />
            </Button>
          </Tooltip>
        )}
      </div>

      <div className="flex gap-1">
        <Button
          variant="secondary"
          size="sm"
          className="flex-1 justify-start"
          onClick={() => composer()}
        >
          <PlusIcon /> New task
          <Shortcut keys={SHORTCUTS.create.keys} className="ml-auto" />
        </Button>
        <Tooltip label="Search" shortcut={SHORTCUTS.palette.keys}>
          <Button
            variant="secondary"
            size="icon-sm"
            aria-label="Search"
            onClick={() => palette.open()}
          >
            <SearchIcon />
          </Button>
        </Tooltip>
      </div>

      <RunningTimer />

      <ul className="flex flex-col gap-px">
        <li>
          <NavLink
            to="/$workspace/inbox"
            params={{ workspace: ws }}
            icon={<InboxIcon />}
            trailing={
              unread > 0 ? (
                <span className="rounded-full bg-accent px-1.5 text-[11px] leading-[18px] font-semibold text-accent-fg tabular">
                  {unread}
                  <span className="sr-only"> unread</span>
                </span>
              ) : null
            }
          >
            Inbox
          </NavLink>
        </li>
        <li>
          <NavLink to="/$workspace/my-tasks" params={{ workspace: ws }} icon={<CircleUserIcon />}>
            My tasks
          </NavLink>
        </li>
      </ul>

      <div className="flex min-h-0 flex-1 flex-col gap-1 overflow-y-auto scrollbar-thin">
        {favoriteItems.length > 0 && (
          <>
            <h2 className="px-2 pt-2 text-[11px] font-medium text-fg-subtle">Favorites</h2>
            <ul className="flex flex-col gap-px">{favoriteItems}</ul>
          </>
        )}
        {views.length > 0 && (
          <>
            <h2 className="px-2 pt-2 text-[11px] font-medium text-fg-subtle">Views</h2>
            <ul className="flex flex-col gap-px">
              {views.map((view) => (
                <li key={view.id}>
                  <SavedViewLink
                    view={view}
                    ws={ws}
                    icon={view.isShared ? <UsersIcon /> : <LayersIcon />}
                  />
                </li>
              ))}
            </ul>
          </>
        )}
        <h2 className="px-2 pt-2 text-[11px] font-medium text-fg-subtle">Your teams</h2>
        <ul className="flex flex-col gap-0.5">
          {data.myTeams.map((team, index) => (
            <TeamSection key={team.id} team={team} ws={ws} defaultExpanded={index < 3} />
          ))}
        </ul>
        {otherTeams.length > 0 && (
          <Link
            to="/$workspace/settings/teams"
            params={{ workspace: ws }}
            className="px-2 py-1 text-xs text-fg-subtle hover:text-fg"
          >
            Browse {otherTeams.length} more {otherTeams.length === 1 ? 'team' : 'teams'}
          </Link>
        )}
      </div>

      {workspace.isDemo && (
        <div className="rounded-lg border border-border bg-surface p-3 text-xs text-fg-muted">
          <p className="mb-2 flex items-center gap-1.5 font-medium text-fg">
            <SparklesIcon className="size-3.5 text-accent-text" /> You’re in a demo
          </p>
          This sandbox resets after 24 hours.{' '}
          <Link to="/signup" className="text-accent-text hover:underline">
            Create an account
          </Link>{' '}
          to keep your work.
        </div>
      )}

      <a
        href="https://github.com/g1lg1l/daiquiri"
        target="_blank"
        rel="noreferrer"
        aria-label="Daiquiri source code on GitHub"
        className="self-start rounded-md px-2 py-1 text-fg-muted transition-colors hover:text-fg"
      >
        <Wordmark className="text-[15px] text-inherit" />
      </a>
    </nav>
  );
}
