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
  UploadIcon,
} from 'lucide-react';
import { useDeferredValue, useState } from 'react';
import { m } from '../../i18n';
import { copyText } from '../../lib/clipboard';
import { shortcutLabel, SHORTCUTS } from '../shortcuts/registry';
import { useComposer } from '../tasks/composer';
import { useWorkspace, useWorkspaceData } from '../workspace/workspace-context';
import type { PaletteAction } from './palette';
import { readRecent } from './recent';

/** The palette dialog body, loaded on first use to keep the startup bundle small. */
export function PaletteDialog({
  open,
  onOpenChange,
  initialQuery,
  contextual,
  onShowShortcuts,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  initialQuery: string;
  contextual: PaletteAction[];
  onShowShortcuts: () => void;
}) {
  return (
    <CommandDialog open={open} onOpenChange={onOpenChange} label={m.shell.palette.label}>
      {open && (
        <Palette
          initialQuery={initialQuery}
          contextual={contextual}
          onClose={() => onOpenChange(false)}
          onShowShortcuts={onShowShortcuts}
        />
      )}
    </CommandDialog>
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
  const groupName = m.shell.palette.groups;
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
    group: groupName.create,
    label: shortcutLabel('create'),
    icon: <PlusIcon />,
    shortcut: SHORTCUTS.create.keys,
    run: () => composer(),
  });
  add({
    id: 'inbox',
    group: groupName.goTo,
    label: m.shell.nav.inbox,
    icon: <InboxIcon />,
    shortcut: SHORTCUTS.goInbox.keys,
    run: () => void navigate({ to: '/$workspace/inbox', params: { workspace: ws } }),
  });
  add({
    id: 'my-tasks',
    group: groupName.goTo,
    label: m.shell.nav.myTasks,
    icon: <CircleUserIcon />,
    shortcut: SHORTCUTS.goMyTasks.keys,
    run: () => void navigate({ to: '/$workspace/my-tasks', params: { workspace: ws } }),
  });
  for (const team of data.myTeams) {
    add({
      id: `team-${team.id}`,
      group: groupName.goTo,
      label: m.shell.palette.teamTasks(team.name),
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
      group: groupName.goTo,
      label: m.shell.palette.teamProjects(team.name),
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
    group: groupName.goTo,
    label: m.shell.nav.settings,
    icon: <SettingsIcon />,
    shortcut: SHORTCUTS.goSettings.keys,
    run: () => void navigate({ to: '/$workspace/settings', params: { workspace: ws } }),
  });
  add({
    id: 'import',
    group: groupName.goTo,
    label: m.shell.nav.importTasks,
    icon: <UploadIcon />,
    keywords: ['linear', 'asana', 'clickup', 'csv'],
    run: () => void navigate({ to: '/$workspace/settings/import', params: { workspace: ws } }),
  });
  add({
    id: 'theme-light',
    group: groupName.preferences,
    label: m.shell.palette.lightTheme,
    icon: <SunIcon />,
    run: () => setPreference('light'),
  });
  add({
    id: 'theme-dark',
    group: groupName.preferences,
    label: m.shell.palette.darkTheme,
    icon: <MoonIcon />,
    run: () => setPreference('dark'),
  });
  add({
    id: 'theme-system',
    group: groupName.preferences,
    label: m.shell.palette.systemTheme,
    icon: <MonitorIcon />,
    run: () => setPreference('system'),
  });
  add({
    id: 'shortcuts',
    group: groupName.preferences,
    label: shortcutLabel('help'),
    icon: <KeyboardIcon />,
    shortcut: SHORTCUTS.help.keys,
    run: onShowShortcuts,
  });
  add({
    id: 'sign-out',
    group: groupName.account,
    label: m.shell.nav.signOut,
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
    <Command
      loop
      onKeyDown={(event) => {
        // Mod+. copies the highlighted task's identifier, as it does in lists.
        if (!(event.metaKey || event.ctrlKey) || event.key !== '.') return;
        const ident = event.currentTarget.querySelector<HTMLElement>(
          '[cmdk-item][data-selected="true"][data-ident]',
        )?.dataset.ident;
        if (!ident) return;
        event.preventDefault();
        copyText(ident, m.common.copied(ident));
      }}
    >
      <CommandInput
        value={query}
        onValueChange={setQuery}
        placeholder={m.shell.palette.placeholder}
        autoFocus
      />
      <CommandList>
        {!hasServerResults && !identifier && (
          <CommandEmpty>
            {search.isFetching ? m.shell.palette.searching : m.common.noResults}
          </CommandEmpty>
        )}
        {identifier && (
          <CommandGroup heading={m.common.open} forceMount>
            <CommandItem
              forceMount
              value={`open ${query}`}
              icon={<ArrowRightIcon />}
              onSelect={() => run(() => openTask(`${identifier.teamKey}-${identifier.number}`))}
            >
              {m.shell.palette.openTask(`${identifier.teamKey}-${identifier.number}`)}
            </CommandItem>
          </CommandGroup>
        )}
        {recent.length > 0 && (
          <CommandGroup heading={groupName.recent}>
            {recent.map((item) => (
              <CommandItem
                key={item.id}
                value={`recent ${item.title} ${item.subtitle ?? ''}`}
                data-ident={item.kind === 'task' ? item.subtitle : undefined}
                icon={item.kind === 'task' ? <ClockIcon /> : <FolderIcon />}
                trailing={
                  <span className="font-mono text-xs text-fg-subtle tabular">{item.subtitle}</span>
                }
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
          <CommandGroup heading={groupName.results} forceMount>
            {search.data?.map((result) => (
              <CommandItem
                key={`${result.kind}-${result.id}`}
                forceMount
                value={`result ${result.kind} ${result.id}`}
                data-ident={result.kind === 'task' ? result.subtitle : undefined}
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
                    <span className="font-mono text-xs text-fg-subtle tabular">
                      {result.subtitle}
                    </span>
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
