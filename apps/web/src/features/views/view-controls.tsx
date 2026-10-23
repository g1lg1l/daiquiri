import {
  DUE_FILTERS,
  hasActiveFilters,
  isGroupableField,
  isPriority,
  LAYOUTS,
  ME,
  ORDER_BY,
  NONE,
  parseFieldFilter,
  PRIORITY_LABEL,
  STATUS_CATEGORY_LABEL,
  type CustomField,
  type DueFilter,
  type GroupBy,
  type Layout,
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
  MenuGroup,
  MenuItem,
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
  CalendarDaysIcon,
  ChartColumnIcon,
  DownloadIcon,
  GanttChartIcon,
  KanbanSquareIcon,
  ListFilterIcon,
  ListIcon,
  SlidersHorizontalIcon,
  XIcon,
} from 'lucide-react';
import { useRef, type ReactNode } from 'react';
import { m } from '../../i18n';
import { SHORTCUTS } from '../shortcuts/registry';
import { useShortcuts } from '../shortcuts/use-shortcuts';
import { PriorityIcon, StatusIcon } from '../tasks/icons';
import { LABEL_COLOR } from '../tasks/label-colors';
import { useWorkspace, useWorkspaceData } from '../workspace/workspace-context';

export type SetSearch = (patch: Partial<ViewSearch>) => void;

/** Groupable custom fields used by any of the given teams. */
function viewFields(
  data: ReturnType<typeof useWorkspaceData>,
  teamIds: readonly string[] | undefined,
): CustomField[] {
  const ids = new Set(
    (teamIds ?? data.teams.map((t) => t.id)).flatMap(
      (id) => data.teamsById.get(id)?.fieldIds ?? [],
    ),
  );
  return data.fields.filter((field) => ids.has(field.id) && isGroupableField(field));
}

/** Options a field filter offers: its values, plus "none". */
function fieldFilterOptions(
  field: CustomField,
  data: ReturnType<typeof useWorkspaceData>,
  userId: string,
): { value: string; label: string }[] {
  const values =
    field.kind === 'checkbox'
      ? [
          { value: 'true', label: m.shell.view.yes },
          { value: 'false', label: m.shell.view.no },
        ]
      : field.kind === 'person'
        ? [
            { value: ME, label: m.shell.view.me },
            ...data.members
              .filter((member) => member.id !== userId)
              .map((member) => ({ value: member.id, label: member.displayName })),
          ]
        : field.options.map((o) => ({ value: o.id, label: o.name }));
  return [...values, { value: NONE, label: m.shell.view.noValue(field.name) }];
}

const CATEGORIES: StatusCategory[] = ['backlog', 'unstarted', 'started', 'completed', 'canceled'];
const PRIORITIES: Priority[] = [1, 2, 3, 4, 0];

function toggle<T>(list: readonly T[] | undefined, value: T): T[] | undefined {
  const next = list?.includes(value) ? list.filter((v) => v !== value) : [...(list ?? []), value];
  return next.length ? next : undefined;
}

const LAYOUT_ICON: Record<Layout, ReactNode> = {
  list: <ListIcon aria-hidden />,
  board: <KanbanSquareIcon aria-hidden />,
  calendar: <CalendarDaysIcon aria-hidden />,
  timeline: <GanttChartIcon aria-hidden />,
  insights: <ChartColumnIcon aria-hidden />,
};

export function LayoutToggle({ layout, setSearch }: { layout: Layout; setSearch: SetSearch }) {
  const next = layout === 'board' ? 'list' : 'board';
  useShortcuts({ toggleLayout: () => setSearch({ layout: next }) });
  return (
    <fieldset className="flex rounded-md border border-border p-0.5">
      <legend className="sr-only">{m.shell.view.layout}</legend>
      {LAYOUTS.map((value) => (
        <Tooltip
          key={value}
          label={m.shell.view.layouts[value]}
          shortcut={value === 'list' || value === 'board' ? SHORTCUTS.toggleLayout.keys : undefined}
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
              aria-label={m.shell.view.layouts[value]}
            />
            {LAYOUT_ICON[value]}
          </label>
        </Tooltip>
      ))}
    </fieldset>
  );
}

export function DisplayMenu({
  layout,
  search,
  defaults,
  setSearch,
  allowedGroups,
  teamIds,
  onExport,
}: {
  layout: Layout;
  search: ViewSearch;
  defaults: ViewDefaults;
  setSearch: SetSearch;
  allowedGroups: readonly GroupBy[];
  teamIds?: readonly string[];
  /** Downloads the tasks this view shows. */
  onExport: (format: 'csv' | 'json') => void;
}) {
  const data = useWorkspaceData();
  const fields = allowedGroups.includes('field') ? viewFields(data, teamIds) : [];
  const trigger = useRef<HTMLButtonElement>(null);
  useShortcuts({ display: () => trigger.current?.click() });
  const group = search.group ?? defaults.group;
  const order = search.order ?? defaults.order;
  const completed = search.completed ?? defaults.completed;
  return (
    <Menu>
      <MenuTrigger render={<Button ref={trigger} variant="ghost" size="sm" />}>
        <SlidersHorizontalIcon /> <span className="max-md:sr-only">{m.shell.view.display}</span>
      </MenuTrigger>
      <MenuContent align="end" className="w-56">
        {/* The calendar groups by day itself; insights chart every task in the view. */}
        {layout !== 'calendar' && layout !== 'insights' && (
          <>
            <MenuRadioGroup
              value={group === 'field' ? `field:${search.groupField ?? ''}` : group}
              onValueChange={(value: string) => {
                if (value.startsWith('field:'))
                  setSearch({ group: 'field', groupField: value.slice('field:'.length) });
                else {
                  const next = allowedGroups.find((g) => g === value);
                  if (next) setSearch({ group: next, groupField: undefined });
                }
              }}
            >
              <MenuLabel>{m.shell.view.groupBy}</MenuLabel>
              {allowedGroups
                .filter((g) => g !== 'field')
                .map((g) => (
                  <MenuRadioItem key={g} value={g}>
                    {m.shell.view.groups[g]}
                  </MenuRadioItem>
                ))}
              {fields.map((field) => (
                <MenuRadioItem key={field.id} value={`field:${field.id}`}>
                  {field.name}
                </MenuRadioItem>
              ))}
            </MenuRadioGroup>
            <MenuSeparator />
          </>
        )}
        {(layout === 'list' || layout === 'board') && group !== 'none' && (
          <>
            <MenuRadioGroup
              value={search.subgroup ?? 'none'}
              onValueChange={(value: string) => {
                const next = allowedGroups.find((g) => g === value);
                setSearch({ subgroup: next && next !== 'none' ? next : undefined });
              }}
            >
              <MenuLabel>
                {layout === 'board' ? m.shell.view.swimlanes : m.shell.view.subgroupBy}
              </MenuLabel>
              {allowedGroups
                .filter((g) => g !== 'field' && g !== group)
                .map((g) => (
                  <MenuRadioItem key={g} value={g}>
                    {m.shell.view.groups[g]}
                  </MenuRadioItem>
                ))}
            </MenuRadioGroup>
            <MenuSeparator />
          </>
        )}
        {layout !== 'insights' && (
          <>
            <MenuRadioGroup
              value={order}
              onValueChange={(value: OrderBy) => setSearch({ order: value })}
            >
              <MenuLabel>{m.shell.view.orderBy}</MenuLabel>
              {ORDER_BY.map((o) => (
                <MenuRadioItem key={o} value={o}>
                  {m.shell.view.orders[o]}
                </MenuRadioItem>
              ))}
            </MenuRadioGroup>
            <MenuSeparator />
            <MenuRadioGroup
              value={completed}
              onValueChange={(value: 'all' | 'week' | 'none') => setSearch({ completed: value })}
            >
              <MenuLabel>{m.shell.view.completed}</MenuLabel>
              <MenuRadioItem value="week">{m.shell.view.completedRange.week}</MenuRadioItem>
              <MenuRadioItem value="all">{m.shell.view.completedRange.all}</MenuRadioItem>
              <MenuRadioItem value="none">{m.shell.view.completedRange.none}</MenuRadioItem>
            </MenuRadioGroup>
            <MenuSeparator />
          </>
        )}
        <MenuGroup>
          <MenuLabel>{m.shell.view.export}</MenuLabel>
          <MenuItem onClick={() => onExport('csv')}>
            <DownloadIcon /> CSV
          </MenuItem>
          <MenuItem onClick={() => onExport('json')}>
            <DownloadIcon /> JSON
          </MenuItem>
        </MenuGroup>
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
        <ListFilterIcon /> <span className="max-md:sr-only">{m.shell.view.filter}</span>
      </MenuTrigger>
      <MenuContent align="end" className="w-52">
        <MenuSub>
          <MenuSubTrigger>{m.shell.view.filters.status}</MenuSubTrigger>
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
          <MenuSubTrigger>{m.shell.view.filters.priority}</MenuSubTrigger>
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
          <MenuSubTrigger>{m.shell.view.filters.assignee}</MenuSubTrigger>
          <MenuContent side="right" align="start" sideOffset={4} className="max-h-80 w-56">
            {[
              { id: ME, name: m.shell.view.me },
              { id: NONE, name: m.shell.view.noAssignee },
              ...data.members
                .filter((member) => member.id !== userId)
                .map((member) => ({ id: member.id, name: member.displayName })),
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
          <MenuSubTrigger>{m.shell.view.filters.label}</MenuSubTrigger>
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
            <MenuSubTrigger>{m.shell.view.filters.project}</MenuSubTrigger>
            <MenuContent side="right" align="start" sideOffset={4} className="max-h-80 w-56">
              {[
                ...projects.map((p) => ({ id: p.id, name: p.name })),
                { id: NONE, name: m.shell.view.noProject },
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
        {viewFields(data, teamIds).map((field) => (
          <MenuSub key={field.id}>
            <MenuSubTrigger>{field.name}</MenuSubTrigger>
            <MenuContent side="right" align="start" sideOffset={4} className="max-h-80 w-52">
              {fieldFilterOptions(field, data, userId).map((option) => {
                const entry = `${field.id}:${option.value}`;
                return (
                  <MenuCheckboxItem
                    key={entry}
                    checked={search.cf?.includes(entry) ?? false}
                    onCheckedChange={() => setSearch({ cf: toggle(search.cf, entry) })}
                    closeOnClick={false}
                  >
                    {option.label}
                  </MenuCheckboxItem>
                );
              })}
            </MenuContent>
          </MenuSub>
        ))}
        <MenuSub>
          <MenuSubTrigger>{m.shell.view.filters.due}</MenuSubTrigger>
          <MenuContent side="right" align="start" sideOffset={4} className="w-52">
            <MenuRadioGroup
              value={search.due ?? ''}
              onValueChange={(value: DueFilter | '') => setSearch({ due: value || undefined })}
            >
              {DUE_FILTERS.map((due) => (
                <MenuRadioItem key={due} value={due}>
                  {m.shell.view.due[due]}
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
        aria-label={m.shell.view.removeFilter(label)}
        className="flex size-5 items-center justify-center rounded-[4px] text-fg-subtle hover:bg-surface-muted hover:text-fg"
      >
        <XIcon className="size-3" />
      </button>
    </span>
  );
}

function names(ids: readonly string[], lookup: (id: string) => string | undefined): string {
  return ids
    .map((id) => (id === ME ? m.shell.view.me : id === NONE ? m.common.none : (lookup(id) ?? '…')))
    .join(', ');
}

/** Active filters as removable chips. Renders nothing when no filter is set. */
export function FilterChips({ search, setSearch }: { search: ViewSearch; setSearch: SetSearch }) {
  const data = useWorkspaceData();
  const { userId } = useWorkspace();
  if (!hasActiveFilters(search)) return null;
  const active =
    [
      search.category,
      search.status,
      search.priority,
      search.assignee,
      search.label,
      search.project,
    ].filter((value) => value?.length).length +
    (search.due ? 1 : 0) +
    parseFieldFilter(search.cf ?? []).size;
  return (
    <div className="flex flex-wrap items-center gap-1.5 border-b border-border px-4 py-2">
      {active > 1 && (
        <Button
          size="sm"
          variant="ghost"
          className="h-6 px-1.5 text-xs text-fg-muted"
          title={m.shell.view.matchHint}
          onClick={() => setSearch({ match: search.match === 'any' ? undefined : 'any' })}
        >
          {search.match === 'any' ? m.shell.view.matchAny : m.shell.view.matchAll}
        </Button>
      )}
      {search.category?.length ? (
        <Chip
          label={`${m.shell.view.filters.status}: ${search.category.map((c) => STATUS_CATEGORY_LABEL[c]).join(', ')}`}
          onRemove={() => setSearch({ category: undefined })}
        />
      ) : null}
      {search.status?.length ? (
        <Chip
          label={`${m.shell.view.filters.status}: ${names(search.status, (id) => data.statuses.get(id)?.name)}`}
          onRemove={() => setSearch({ status: undefined })}
        />
      ) : null}
      {search.priority?.length ? (
        <Chip
          label={`${m.shell.view.filters.priority}: ${search.priority.map((p) => (isPriority(p) ? PRIORITY_LABEL[p] : p)).join(', ')}`}
          onRemove={() => setSearch({ priority: undefined })}
        />
      ) : null}
      {search.assignee?.length ? (
        <Chip
          label={`${m.shell.view.filters.assignee}: ${names(search.assignee, (id) => data.membersById.get(id)?.displayName)}`}
          onRemove={() => setSearch({ assignee: undefined })}
        />
      ) : null}
      {search.label?.length ? (
        <Chip
          label={`${m.shell.view.filters.label}: ${names(search.label, (id) => data.labelsById.get(id)?.name)}`}
          onRemove={() => setSearch({ label: undefined })}
        />
      ) : null}
      {search.project?.length ? (
        <Chip
          label={`${m.shell.view.filters.project}: ${names(search.project, (id) => data.projectsById.get(id)?.name)}`}
          onRemove={() => setSearch({ project: undefined })}
        />
      ) : null}
      {[...parseFieldFilter(search.cf ?? [])].map(([fieldId, values]) => {
        const field = data.fieldsById.get(fieldId);
        if (!field) return null;
        const options = fieldFilterOptions(field, data, userId);
        return (
          <Chip
            key={fieldId}
            label={`${field.name}: ${values.map((v) => options.find((o) => o.value === v)?.label ?? '…').join(', ')}`}
            onRemove={() =>
              setSearch({
                cf: search.cf?.filter((entry) => !entry.startsWith(`${fieldId}:`)),
              })
            }
          />
        );
      })}
      {search.due && (
        <Chip label={m.shell.view.due[search.due]} onRemove={() => setSearch({ due: undefined })} />
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
        {m.shell.view.clear}
      </Button>
    </div>
  );
}
