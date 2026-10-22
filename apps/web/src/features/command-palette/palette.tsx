import { useAuthActions, useSearch } from '@daiq/data';
import { parseIdentifier } from '@daiq/domain';
import {
  Command,
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  useTheme,
} from '@daiq/ui';
import { useNavigate } from '@tanstack/react-router';
import {
  ArrowRightIcon,
  CircleUserIcon,
  ClockIcon,
  FolderIcon,
  InboxIcon,
  KeyboardIcon,
  ListTodoIcon,
  LogOutIcon,
  MonitorIcon,
  MoonIcon,
  PlusIcon,
  SettingsIcon,
  SunIcon,
  TagIcon,
} from 'lucide-react';
import {
  createContext,
  useCallback,
  useContext,
  useDeferredValue,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';
import { SHORTCUTS } from '../shortcuts/registry';
import { useShortcuts } from '../shortcuts/use-shortcuts';
import { useComposer } from '../tasks/composer';
import { useWorkspace, useWorkspaceData } from '../workspace/workspace-context';
import { readRecent } from './recent';

export interface PaletteAction {
  id: string;
  label: string;
  group: string;
  icon?: ReactNode;
  shortcut?: string;
  keywords?: string[];
  run: () => void;
}

interface PaletteContextValue {
  open: (query?: string) => void;
  register: (actions: PaletteAction[]) => () => void;
  showShortcuts: () => void;
}

const PaletteContext = createContext<PaletteContextValue | null>(null);

export function usePalette(): PaletteContextValue {
  const context = useContext(PaletteContext);
  if (!context) throw new Error('usePalette must be used inside <PaletteProvider>');
  return context;
}

/** Registers contextual actions (e.g. "Change status" on a task page) while mounted. */
export function usePaletteActions(actions: PaletteAction[]): void {
  const { register } = usePalette();
  useEffect(() => register(actions), [register, actions]);
}

export function PaletteProvider({
  children,
  onShowShortcuts,
}: {
  children: ReactNode;
  onShowShortcuts: () => void;
}) {
  const [state, setState] = useState<{ key: number; query: string } | null>(null);
  const [contextual, setContextual] = useState<PaletteAction[][]>([]);

  const open = useCallback(
    (query = '') => setState((s) => ({ key: (s?.key ?? 0) + 1, query })),
    [],
  );
  const register = useCallback((actions: PaletteAction[]) => {
    setContextual((current) => [...current, actions]);
    return () => setContextual((current) => current.filter((entry) => entry !== actions));
  }, []);
  const value = useMemo(
    () => ({ open, register, showShortcuts: onShowShortcuts }),
    [open, register, onShowShortcuts],
  );

  useShortcuts({ palette: () => open(), search: () => open() });

  return (
    <PaletteContext.Provider value={value}>
      {children}
      <CommandDialog
        open={state !== null}
        onOpenChange={(next) => !next && setState(null)}
        label="Command palette"
      >
        {state && (
          <Palette
            key={state.key}
            initialQuery={state.query}
            contextual={contextual.flat()}
            onClose={() => setState(null)}
            onShowShortcuts={onShowShortcuts}
          />
        )}
      </CommandDialog>
    </PaletteContext.Provider>
  );
}

function Palette({
  initialQuery,
  contextual,
  onClose,
  onShowShortcuts,
}: {
  initialQuery: string;
  contextual: PaletteAction[];
  onClose: () => void;
  onShowShortcuts: () => void;
}) {
  const { workspace } = useWorkspace();
  const data = useWorkspaceData();
  const navigate = useNavigate();
  const composer = useComposer();
  const { setPreference } = useTheme();
  const { signOut } = useAuthActions();
  const [query, setQuery] = useState(initialQuery);
  const deferredQuery = useDeferredValue(query);
  const search = useSearch(workspace.id, deferredQuery);
  const ws = workspace.slug;
  const identifier = parseIdentifier(query);
  const recent = query ? [] : readRecent(workspace.id);

  const run = (action: () => void) => {
    onClose();
    action();
  };

  const groups = new Map<string, PaletteAction[]>();
  const add = (action: PaletteAction) =>
    groups.set(action.group, [...(groups.get(action.group) ?? []), action]);
  contextual.forEach(add);
  add({
    id: 'create',
    group: 'Create',
    label: 'Create task',
    icon: <PlusIcon />,
    shortcut: SHORTCUTS.create.keys,
    run: () => composer(),
  });
  add({
    id: 'inbox',
    group: 'Go to',
    label: 'Inbox',
    icon: <InboxIcon />,
    shortcut: SHORTCUTS.goInbox.keys,
    run: () => void navigate({ to: '/$workspace/inbox', params: { workspace: ws } }),
  });
  add({
    id: 'my-tasks',
    group: 'Go to',
    label: 'My tasks',
    icon: <CircleUserIcon />,
    shortcut: SHORTCUTS.goMyTasks.keys,
    run: () => void navigate({ to: '/$workspace/my-tasks', params: { workspace: ws } }),
  });
  for (const team of data.myTeams) {
    add({
      id: `team-${team.id}`,
      group: 'Go to',
      label: `${team.name} tasks`,
      icon: <ListTodoIcon />,
      keywords: [team.key],
      run: () =>
        void navigate({
          to: '/$workspace/team/$teamKey/tasks',
          params: { workspace: ws, teamKey: team.key },
        }),
    });
    add({
      id: `projects-${team.id}`,
      group: 'Go to',
      label: `${team.name} projects`,
      icon: <FolderIcon />,
      keywords: [team.key],
      run: () =>
        void navigate({
          to: '/$workspace/team/$teamKey/projects',
          params: { workspace: ws, teamKey: team.key },
        }),
    });
  }
  add({
    id: 'settings',
    group: 'Go to',
    label: 'Settings',
    icon: <SettingsIcon />,
    shortcut: SHORTCUTS.goSettings.keys,
    run: () => void navigate({ to: '/$workspace/settings', params: { workspace: ws } }),
  });
  add({
    id: 'theme-light',
    group: 'Preferences',
    label: 'Use light theme',
    icon: <SunIcon />,
    run: () => setPreference('light'),
  });
  add({
    id: 'theme-dark',
    group: 'Preferences',
    label: 'Use dark theme',
    icon: <MoonIcon />,
    run: () => setPreference('dark'),
  });
  add({
    id: 'theme-system',
    group: 'Preferences',
    label: 'Use system theme',
    icon: <MonitorIcon />,
    run: () => setPreference('system'),
  });
  add({
    id: 'shortcuts',
    group: 'Preferences',
    label: 'Keyboard shortcuts',
    icon: <KeyboardIcon />,
    shortcut: SHORTCUTS.help.keys,
    run: onShowShortcuts,
  });
  add({
    id: 'sign-out',
    group: 'Account',
    label: 'Sign out',
    icon: <LogOutIcon />,
    run: () => void signOut(),
  });

  const openTask = (ident: string) =>
    void navigate({
      to: '/$workspace/task/$identifier',
      params: { workspace: ws, identifier: ident },
    });
  const firstTeam = data.myTeams[0]?.key ?? data.teams[0]?.key;
  const hasServerResults = (search.data?.length ?? 0) > 0 && deferredQuery.trim().length >= 2;

  return (
    <Command loop>
      <CommandInput
        value={query}
        onValueChange={setQuery}
        placeholder="Type a command or search…"
        autoFocus
      />
      <CommandList>
        {!hasServerResults && !identifier && (
          <CommandEmpty>{search.isFetching ? 'Searching…' : 'No results'}</CommandEmpty>
        )}
        {identifier && (
          <CommandGroup heading="Open" forceMount>
            <CommandItem
              forceMount
              value={`open ${query}`}
              icon={<ArrowRightIcon />}
              onSelect={() => run(() => openTask(`${identifier.teamKey}-${identifier.number}`))}
            >
              Open {identifier.teamKey}-{identifier.number}
            </CommandItem>
          </CommandGroup>
        )}
        {recent.length > 0 && (
          <CommandGroup heading="Recently viewed">
            {recent.map((item) => (
              <CommandItem
                key={item.id}
                value={`recent ${item.title} ${item.subtitle ?? ''}`}
                icon={item.kind === 'task' ? <ClockIcon /> : <FolderIcon />}
                trailing={<span className="text-xs text-fg-subtle tabular">{item.subtitle}</span>}
                onSelect={() =>
                  run(() =>
                    item.kind === 'task' && item.subtitle
                      ? openTask(item.subtitle)
                      : void navigate({
                          to: '/$workspace/project/$projectId',
                          params: { workspace: ws, projectId: item.id },
                        }),
                  )
                }
              >
                {item.title}
              </CommandItem>
            ))}
          </CommandGroup>
        )}
        {hasServerResults && (
          <CommandGroup heading="Search results" forceMount>
            {search.data?.map((result) => (
              <CommandItem
                key={`${result.kind}-${result.id}`}
                forceMount
                value={`result ${result.kind} ${result.id}`}
                icon={
                  result.kind === 'task' ? (
                    <ListTodoIcon />
                  ) : result.kind === 'project' ? (
                    <FolderIcon />
                  ) : result.kind === 'person' ? (
                    <CircleUserIcon />
                  ) : (
                    <TagIcon />
                  )
                }
                trailing={
                  result.subtitle ? (
                    <span className="text-xs text-fg-subtle tabular">{result.subtitle}</span>
                  ) : null
                }
                onSelect={() =>
                  run(() => {
                    if (result.kind === 'task' && result.subtitle) openTask(result.subtitle);
                    else if (result.kind === 'project')
                      void navigate({
                        to: '/$workspace/project/$projectId',
                        params: { workspace: ws, projectId: result.id },
                      });
                    else if (firstTeam)
                      void navigate({
                        to: '/$workspace/team/$teamKey/tasks',
                        params: { workspace: ws, teamKey: firstTeam },
                        search:
                          result.kind === 'person'
                            ? { assignee: [result.id] }
                            : { label: [result.id] },
                      });
                  })
                }
              >
                {result.title}
              </CommandItem>
            ))}
          </CommandGroup>
        )}
        {[...groups.entries()].map(([heading, actions]) => (
          <CommandGroup key={heading} heading={heading}>
            {actions.map((action) => (
              <CommandItem
                key={action.id}
                value={`${action.label} ${action.id}`}
                keywords={action.keywords ?? []}
                icon={action.icon}
                {...(action.shortcut && { shortcut: action.shortcut })}
                onSelect={() => run(action.run)}
              >
                {action.label}
              </CommandItem>
            ))}
          </CommandGroup>
        ))}
      </CommandList>
    </Command>
  );
}
