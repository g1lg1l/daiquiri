import {
  DUE_FILTERS,
  hasActiveFilters,
  isPriority,
  ME,
  ORDER_BY,
  NONE,
  PRIORITY_LABEL,
  STATUS_CATEGORY_LABEL,
  type DueFilter,
  type GroupBy,
  type OrderBy,
  type Priority,
  type StatusCategory,
  type ViewDefaults,
  type ViewSearch,
} from '@daiq/domain';
import {
  Avatar,
  Button,
  cn,
  Menu,
  MenuCheckboxItem,
  MenuContent,
  MenuLabel,
  MenuRadioGroup,
  MenuRadioItem,
  MenuSeparator,
  MenuSub,
  MenuSubTrigger,
  MenuTrigger,
  Tooltip,
} from '@daiq/ui';
import {
  KanbanSquareIcon,
  ListFilterIcon,
  ListIcon,
  SlidersHorizontalIcon,
  XIcon,
} from 'lucide-react';
import { useRef } from 'react';
import { SHORTCUTS } from '../shortcuts/registry';
import { useShortcuts } from '../shortcuts/use-shortcuts';
import { PriorityIcon, StatusIcon } from '../tasks/icons';
import { LABEL_COLOR } from '../tasks/label-colors';
import { useWorkspace, useWorkspaceData } from '../workspace/workspace-context';

export type SetSearch = (patch: Partial<ViewSearch>) => void;

const GROUP_LABEL: Record<GroupBy, string> = {
  status: 'Status',
  priority: 'Priority',
  assignee: 'Assignee',
  project: 'Project',
  label: 'Label',
  due: 'Due date',
  none: 'No grouping',
};

const ORDER_LABEL: Record<OrderBy, string> = {
  manual: 'Manual',
  priority: 'Priority',
  due: 'Due date',
  created: 'Created',
  updated: 'Updated',
  title: 'Title',
};

const DUE_LABEL: Record<DueFilter, string> = {
  overdue: 'Overdue',
  today: 'Due today or earlier',
  week: 'Due this week',
  any: 'Has a due date',
  none: 'No due date',
};

const CATEGORIES: StatusCategory[] = ['backlog', 'unstarted', 'started', 'completed', 'canceled'];
const PRIORITIES: Priority[] = [1, 2, 3, 4, 0];

function toggle<T>(list: readonly T[] | undefined, value: T): T[] | undefined {
  const next = list?.includes(value) ? list.filter((v) => v !== value) : [...(list ?? []), value];
  return next.length ? next : undefined;
}

export function LayoutToggle({
  layout,
  setSearch,
}: {
  layout: 'list' | 'board';
  setSearch: SetSearch;
}) {
  const next = layout === 'list' ? 'board' : 'list';
  useShortcuts({ toggleLayout: () => setSearch({ layout: next }) });
  return (
    <fieldset className="flex rounded-md border border-border p-0.5">
      <legend className="sr-only">Layout</legend>
      {(['list', 'board'] as const).map((value) => (
        <Tooltip
          key={value}
          label={value === 'list' ? 'List' : 'Board'}
          shortcut={SHORTCUTS.toggleLayout.keys}
        >
          <label
            className={cn(
              'flex size-6 cursor-pointer items-center justify-center rounded-[5px] text-fg-subtle hover:text-fg has-focus-visible:outline-2 has-focus-visible:outline-focus [&_svg]:size-3.5',
              layout === value && 'bg-surface-emphasis text-fg',
            )}
          >
            <input
              type="radio"
              name="layout"
              value={value}
              checked={layout === value}
              onChange={() => setSearch({ layout: value })}
              className="sr-only"
              aria-label={value === 'list' ? 'List' : 'Board'}
            />
            {value === 'list' ? <ListIcon aria-hidden /> : <KanbanSquareIcon aria-hidden />}
          </label>
        </Tooltip>
      ))}
    </fieldset>
  );
}

export function DisplayMenu({
  search,
  defaults,
  setSearch,
  allowedGroups,
}: {
  search: ViewSearch;
  defaults: ViewDefaults;
  setSearch: SetSearch;
  allowedGroups: readonly GroupBy[];
}) {
  const trigger = useRef<HTMLButtonElement>(null);
  useShortcuts({ display: () => trigger.current?.click() });
  const group = search.group ?? defaults.group;
  const order = search.order ?? defaults.order;
  const completed = search.completed ?? defaults.completed;
  return (
    <Menu>
      <MenuTrigger render={<Button ref={trigger} variant="ghost" size="sm" />}>
        <SlidersHorizontalIcon /> Display
      </MenuTrigger>
      <MenuContent align="end" className="w-56">
        <MenuLabel>Group by</MenuLabel>
        <MenuRadioGroup
          value={group}
          onValueChange={(value: GroupBy) => setSearch({ group: value })}
        >
          {allowedGroups.map((g) => (
            <MenuRadioItem key={g} value={g}>
              {GROUP_LABEL[g]}
            </MenuRadioItem>
          ))}
        </MenuRadioGroup>
        <MenuSeparator />
        <MenuLabel>Order by</MenuLabel>
        <MenuRadioGroup
          value={order}
          onValueChange={(value: OrderBy) => setSearch({ order: value })}
        >
          {ORDER_BY.map((o) => (
            <MenuRadioItem key={o} value={o}>
              {ORDER_LABEL[o]}
            </MenuRadioItem>
          ))}
        </MenuRadioGroup>
        <MenuSeparator />
        <MenuLabel>Completed tasks</MenuLabel>
        <MenuRadioGroup
          value={completed}
          onValueChange={(value: 'all' | 'week' | 'none') => setSearch({ completed: value })}
        >
          <MenuRadioItem value="week">Past week</MenuRadioItem>
          <MenuRadioItem value="all">All</MenuRadioItem>
          <MenuRadioItem value="none">None</MenuRadioItem>
        </MenuRadioGroup>
      </MenuContent>
    </Menu>
  );
}

export function FilterMenu({
  search,
  setSearch,
  teamIds,
}: {
  search: ViewSearch;
  setSearch: SetSearch;
  teamIds?: readonly string[];
}) {
  const { userId } = useWorkspace();
  const data = useWorkspaceData();
  const trigger = useRef<HTMLButtonElement>(null);
  useShortcuts({ filter: () => trigger.current?.click() });
  const projects = data.projects.filter(
    (p) => !p.archivedAt && (!teamIds || teamIds.includes(p.teamId)),
  );
  return (
    <Menu>
      <MenuTrigger render={<Button ref={trigger} variant="ghost" size="sm" />}>
        <ListFilterIcon /> Filter
      </MenuTrigger>
      <MenuContent align="end" className="w-52">
        <MenuSub>
          <MenuSubTrigger>Status</MenuSubTrigger>
          <MenuContent side="right" align="start" sideOffset={4} className="w-48">
            {CATEGORIES.map((category) => (
              <MenuCheckboxItem
                key={category}
                checked={search.category?.includes(category) ?? false}
                onCheckedChange={() => setSearch({ category: toggle(search.category, category) })}
                closeOnClick={false}
              >
                <StatusIcon category={category} /> {STATUS_CATEGORY_LABEL[category]}
              </MenuCheckboxItem>
            ))}
          </MenuContent>
        </MenuSub>
        <MenuSub>
          <MenuSubTrigger>Priority</MenuSubTrigger>
          <MenuContent side="right" align="start" sideOffset={4} className="w-48">
            {PRIORITIES.map((priority) => (
              <MenuCheckboxItem
                key={priority}
                checked={search.priority?.includes(priority) ?? false}
                onCheckedChange={() => setSearch({ priority: toggle(search.priority, priority) })}
                closeOnClick={false}
              >
                <PriorityIcon priority={priority} /> {PRIORITY_LABEL[priority]}
              </MenuCheckboxItem>
            ))}
          </MenuContent>
        </MenuSub>
        <MenuSub>
          <MenuSubTrigger>Assignee</MenuSubTrigger>
          <MenuContent side="right" align="start" sideOffset={4} className="max-h-80 w-56">
            {[
              { id: ME, name: 'Me' },
              { id: NONE, name: 'No assignee' },
              ...data.members
                .filter((m) => m.id !== userId)
                .map((m) => ({ id: m.id, name: m.displayName })),
            ].map((person) => (
              <MenuCheckboxItem
                key={person.id}
                checked={search.assignee?.includes(person.id) ?? false}
                onCheckedChange={() => setSearch({ assignee: toggle(search.assignee, person.id) })}
                closeOnClick={false}
              >
                {person.id !== NONE && (
                  <Avatar
                    name={
                      person.id === ME
                        ? (data.membersById.get(userId)?.displayName ?? 'Me')
                        : person.name
                    }
                    size="xs"
                  />
                )}
                {person.name}
              </MenuCheckboxItem>
            ))}
          </MenuContent>
        </MenuSub>
        <MenuSub>
          <MenuSubTrigger>Label</MenuSubTrigger>
          <MenuContent side="right" align="start" sideOffset={4} className="max-h-80 w-48">
            {data.labels.map((label) => (
              <MenuCheckboxItem
                key={label.id}
                checked={search.label?.includes(label.id) ?? false}
                onCheckedChange={() => setSearch({ label: toggle(search.label, label.id) })}
                closeOnClick={false}
              >
                <span
                  className="size-2.5 rounded-full"
                  style={{ background: LABEL_COLOR[label.color] }}
                />
                {label.name}
              </MenuCheckboxItem>
            ))}
          </MenuContent>
        </MenuSub>
        {projects.length > 0 && (
          <MenuSub>
            <MenuSubTrigger>Project</MenuSubTrigger>
            <MenuContent side="right" align="start" sideOffset={4} className="max-h-80 w-56">
              {[
                ...projects.map((p) => ({ id: p.id, name: p.name })),
                { id: NONE, name: 'No project' },
              ].map((project) => (
                <MenuCheckboxItem
                  key={project.id}
                  checked={search.project?.includes(project.id) ?? false}
                  onCheckedChange={() => setSearch({ project: toggle(search.project, project.id) })}
                  closeOnClick={false}
                >
                  {project.name}
                </MenuCheckboxItem>
              ))}
            </MenuContent>
          </MenuSub>
        )}
        <MenuSub>
          <MenuSubTrigger>Due date</MenuSubTrigger>
          <MenuContent side="right" align="start" sideOffset={4} className="w-52">
            <MenuRadioGroup
              value={search.due ?? ''}
              onValueChange={(value: DueFilter | '') => setSearch({ due: value || undefined })}
            >
              {DUE_FILTERS.map((due) => (
                <MenuRadioItem key={due} value={due}>
                  {DUE_LABEL[due]}
                </MenuRadioItem>
              ))}
            </MenuRadioGroup>
          </MenuContent>
        </MenuSub>
      </MenuContent>
    </Menu>
  );
}

function Chip({ label, onRemove }: { label: string; onRemove: () => void }) {
  return (
    <span className="inline-flex h-6 items-center gap-1 rounded-md border border-border bg-surface pr-0.5 pl-2 text-xs">
      {label}
      <button
        type="button"
        onClick={onRemove}
        aria-label={`Remove filter ${label}`}
        className="flex size-5 items-center justify-center rounded-[4px] text-fg-subtle hover:bg-surface-muted hover:text-fg"
      >
        <XIcon className="size-3" />
      </button>
    </span>
  );
}

function names(ids: readonly string[], lookup: (id: string) => string | undefined): string {
  return ids
    .map((id) => (id === ME ? 'Me' : id === NONE ? 'None' : (lookup(id) ?? '…')))
    .join(', ');
}

/** Active filters as removable chips. Renders nothing when no filter is set. */
export function FilterChips({ search, setSearch }: { search: ViewSearch; setSearch: SetSearch }) {
  const data = useWorkspaceData();
  if (!hasActiveFilters(search)) return null;
  return (
    <div className="flex flex-wrap items-center gap-1.5 border-b border-border px-4 py-2">
      {search.category?.length ? (
        <Chip
          label={`Status: ${search.category.map((c) => STATUS_CATEGORY_LABEL[c]).join(', ')}`}
          onRemove={() => setSearch({ category: undefined })}
        />
      ) : null}
      {search.status?.length ? (
        <Chip
          label={`Status: ${names(search.status, (id) => data.statuses.get(id)?.name)}`}
          onRemove={() => setSearch({ status: undefined })}
        />
      ) : null}
      {search.priority?.length ? (
        <Chip
          label={`Priority: ${search.priority.map((p) => (isPriority(p) ? PRIORITY_LABEL[p] : p)).join(', ')}`}
          onRemove={() => setSearch({ priority: undefined })}
        />
      ) : null}
      {search.assignee?.length ? (
        <Chip
          label={`Assignee: ${names(search.assignee, (id) => data.membersById.get(id)?.displayName)}`}
          onRemove={() => setSearch({ assignee: undefined })}
        />
      ) : null}
      {search.label?.length ? (
        <Chip
          label={`Label: ${names(search.label, (id) => data.labelsById.get(id)?.name)}`}
          onRemove={() => setSearch({ label: undefined })}
        />
      ) : null}
      {search.project?.length ? (
        <Chip
          label={`Project: ${names(search.project, (id) => data.projectsById.get(id)?.name)}`}
          onRemove={() => setSearch({ project: undefined })}
        />
      ) : null}
      {search.due && (
        <Chip label={DUE_LABEL[search.due]} onRemove={() => setSearch({ due: undefined })} />
      )}
      {search.q && <Chip label={`“${search.q}”`} onRemove={() => setSearch({ q: undefined })} />}
      <Button
        variant="ghost"
        size="sm"
        className="h-6 text-xs"
        onClick={() =>
          setSearch({
            category: undefined,
            status: undefined,
            priority: undefined,
            assignee: undefined,
            label: undefined,
            project: undefined,
            due: undefined,
            q: undefined,
          })
        }
      >
        Clear
      </Button>
    </div>
  );
}
