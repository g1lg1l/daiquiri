import { keys, useCreateTask, useTemplateActions, useTemplates } from '@daiq/data';
import {
  firstStatusOf,
  formatIdentifier,
  isPriority,
  PRIORITY_LABEL,
  sortKeyBetween,
  type Priority,
  type RichDocument,
  type Task,
} from '@daiq/domain';
import { Avatar, Button, Dialog, DialogContent, DialogTitle, Shortcut, toast } from '@daiq/ui';
import { useQueryClient } from '@tanstack/react-query';
import { useNavigate } from '@tanstack/react-router';
import { FolderIcon, LayoutTemplateIcon, TagIcon, UserIcon } from 'lucide-react';
import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import { newId } from '../../lib/ids';
import {
  labelOptions,
  memberOptions,
  NO_VALUE,
  priorityOptions,
  projectOptions,
  statusOptions,
} from '../pickers/options';
import { PickerPopover } from '../pickers/picker-popover';
import { useWorkspace, useWorkspaceData } from '../workspace/workspace-context';
import { PriorityIcon, StatusIcon } from './icons';
import { LABEL_COLOR } from './label-colors';
import { DateField } from './task-actions';
import { useIdentifier } from './use-identifier';

export interface ComposerDefaults {
  teamId?: string;
  statusId?: string;
  projectId?: string | null;
  parentId?: string | null;
  assigneeIds?: string[];
  labelIds?: string[];
  priority?: Priority;
  dueDate?: string | null;
  /** Only applies while the composer stays on the default team (cycles belong to a team). */
  cycleId?: string | null;
}

const ComposerContext = createContext<((defaults?: ComposerDefaults) => void) | null>(null);

export function useComposer(): (defaults?: ComposerDefaults) => void {
  const open = useContext(ComposerContext);
  if (!open) throw new Error('useComposer must be used inside <ComposerProvider>');
  return open;
}

/** Plain text → editor document; one paragraph per line. */
function textToDocument(text: string): RichDocument | null {
  const lines = text.split('\n');
  if (!text.trim()) return null;
  return {
    type: 'doc',
    content: lines.map((line) =>
      line ? { type: 'paragraph', content: [{ type: 'text', text: line }] } : { type: 'paragraph' },
    ),
  };
}

export function ComposerProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<{ key: number; defaults: ComposerDefaults } | null>(null);
  const open = useCallback(
    (defaults: ComposerDefaults = {}) =>
      setState((current) => ({ key: (current?.key ?? 0) + 1, defaults })),
    [],
  );
  return (
    <ComposerContext.Provider value={open}>
      {children}
      <Dialog open={state !== null} onOpenChange={(next) => !next && setState(null)}>
        <DialogContent
          className="top-[12vh] w-[min(100%-2rem,40rem)] gap-0 p-0"
          initialFocus={() => document.getElementById('composer-title')}
        >
          {state && (
            <Composer key={state.key} defaults={state.defaults} onClose={() => setState(null)} />
          )}
        </DialogContent>
      </Dialog>
    </ComposerContext.Provider>
  );
}

function Composer({ defaults, onClose }: { defaults: ComposerDefaults; onClose: () => void }) {
  const { workspace, userId } = useWorkspace();
  const data = useWorkspaceData();
  const queryClient = useQueryClient();
  const createTask = useCreateTask();
  const identifier = useIdentifier();
  const navigate = useNavigate();
  const titleRef = useRef<HTMLTextAreaElement>(null);
  const templates = useTemplates(workspace.id).data ?? [];
  const templateActions = useTemplateActions(workspace.id);

  const initialTeam = data.teamsById.get(defaults.teamId ?? '') ?? data.myTeams[0] ?? data.teams[0];
  const [teamId, setTeamId] = useState(initialTeam?.id ?? '');
  const team = data.teamsById.get(teamId);
  const defaultStatus =
    defaults.statusId ??
    firstStatusOf(team?.statuses ?? [], 'unstarted')?.id ??
    team?.statuses[0]?.id ??
    '';
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [statusId, setStatusId] = useState(defaultStatus);
  const [priority, setPriority] = useState<Priority>(defaults.priority ?? 0);
  const [assigneeIds, setAssigneeIds] = useState<string[]>(defaults.assigneeIds ?? []);
  const [labelIds, setLabelIds] = useState<string[]>(defaults.labelIds ?? []);
  const [projectId, setProjectId] = useState<string | null>(defaults.projectId ?? null);
  const [dueDate, setDueDate] = useState<string | null>(defaults.dueDate ?? null);
  const [createMore, setCreateMore] = useState(false);

  const taskTemplates = defaults.parentId
    ? []
    : templates.filter((t) => t.kind === 'task' && t.teamId === teamId);
  const fromTemplate = (templateId: string) =>
    templateActions.createTask.mutate(
      { templateId, projectId },
      {
        onSuccess: (task) => {
          onClose();
          if (task.number === null || !team) return;
          void navigate({
            to: '/$workspace/task/$identifier',
            params: {
              workspace: workspace.slug,
              identifier: formatIdentifier(team.key, task.number),
            },
          });
        },
      },
    );

  const lines = title
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean);
  const status = data.statuses.get(statusId);
  const project = projectId ? data.projectsById.get(projectId) : undefined;
  const teamProjects = useMemo(
    () => data.projects.filter((p) => p.teamId === teamId),
    [data.projects, teamId],
  );

  const submit = () => {
    if (!team || lines.length === 0 || !statusId) return;
    const cached =
      queryClient.getQueryData<Task[]>(keys.tasks({ kind: 'team', id: team.id })) ?? [];
    let before: string | null = cached.reduce<string | null>(
      (min, task) => (min === null || task.sortKey < min ? task.sortKey : min),
      null,
    );
    // Multiple lines create one task each, in the order written, at the top of the list.
    const keysForLines = lines.map(() => '');
    for (let i = lines.length - 1; i >= 0; i--) {
      before = sortKeyBetween(null, before);
      keysForLines[i] = before;
    }
    lines.forEach((line, index) => {
      createTask.mutate(
        {
          id: newId(),
          workspaceId: workspace.id,
          teamId: team.id,
          title: line,
          statusId,
          priority,
          projectId,
          parentId: defaults.parentId ?? null,
          cycleId: team.id === defaults.teamId ? (defaults.cycleId ?? null) : null,
          dueDate,
          assigneeIds,
          labelIds,
          sortKey: keysForLines[index] ?? sortKeyBetween(null, null),
          creatorId: userId,
          description: lines.length === 1 ? textToDocument(description) : null,
        },
        {
          onSuccess: (task) => {
            if (lines.length === 1) {
              toast(`Created ${identifier(task)}`, {
                action: {
                  label: 'Open',
                  onClick: () =>
                    void navigate({
                      to: '/$workspace/task/$identifier',
                      params: { workspace: workspace.slug, identifier: identifier(task) },
                    }),
                },
              });
            }
          },
        },
      );
    });
    if (lines.length > 1) toast(`Created ${lines.length} tasks`);
    if (createMore) {
      setTitle('');
      setDescription('');
      titleRef.current?.focus();
    } else {
      onClose();
    }
  };

  return (
    <form
      className="flex flex-col"
      onSubmit={(event) => {
        event.preventDefault();
        submit();
      }}
    >
      <div className="flex items-center gap-2 px-5 pt-4 text-xs text-fg-muted">
        {data.myTeams.length > 1 ? (
          <PickerPopover
            trigger={
              <Button type="button" size="sm" variant="ghost" className="h-6 px-1.5 text-xs">
                {team?.name}
              </Button>
            }
            options={data.myTeams.map((t) => ({ value: t.id, label: t.name, hint: t.key }))}
            selected={[teamId]}
            placeholder="Team…"
            onSelect={([id]) => {
              if (!id) return;
              const next = data.teamsById.get(id);
              setTeamId(id);
              setStatusId(
                firstStatusOf(next?.statuses ?? [], 'unstarted')?.id ?? next?.statuses[0]?.id ?? '',
              );
              setProjectId(null);
            }}
          />
        ) : (
          <span className="px-1.5">{team?.name}</span>
        )}
        <span aria-hidden>›</span>
        <DialogTitle className="text-xs font-normal text-fg-muted">New task</DialogTitle>
      </div>

      <div className="flex flex-col gap-1 px-5 pt-3 pb-2">
        <label htmlFor="composer-title" className="sr-only">
          Title
        </label>
        <textarea
          id="composer-title"
          ref={titleRef}
          autoFocus
          rows={1}
          value={title}
          onChange={(event) => setTitle(event.target.value)}
          onKeyDown={(event) => {
            const modEnter = event.key === 'Enter' && (event.metaKey || event.ctrlKey);
            if (modEnter || (event.key === 'Enter' && !event.shiftKey && lines.length <= 1)) {
              event.preventDefault();
              submit();
            }
          }}
          placeholder="Task title"
          className="field-sizing-content max-h-48 w-full resize-none bg-transparent text-lg font-medium font-display outline-none placeholder:text-fg-subtle focus-visible:outline-none"
        />
        {lines.length > 1 ? (
          <p className="text-xs text-accent-text" aria-live="polite">
            {lines.length} lines: one task will be created per line.
          </p>
        ) : (
          <>
            <label htmlFor="composer-description" className="sr-only">
              Description
            </label>
            <textarea
              id="composer-description"
              rows={2}
              value={description}
              onChange={(event) => setDescription(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === 'Enter' && (event.metaKey || event.ctrlKey)) {
                  event.preventDefault();
                  submit();
                }
              }}
              placeholder="Add a description…"
              className="field-sizing-content max-h-60 min-h-12 w-full resize-none bg-transparent text-[13px] outline-none placeholder:text-fg-subtle focus-visible:outline-none"
            />
          </>
        )}
      </div>

      <div className="flex flex-wrap items-center gap-1.5 px-4 pb-3">
        <PickerPopover
          trigger={
            <Button type="button" size="sm">
              {status && <StatusIcon category={status.category} />}
              {status?.name ?? 'Status'}
            </Button>
          }
          options={statusOptions(team?.statuses ?? [])}
          selected={[statusId]}
          placeholder="Status…"
          onSelect={([id]) => id && setStatusId(id)}
        />
        <PickerPopover
          trigger={
            <Button type="button" size="sm">
              <PriorityIcon priority={priority} />
              {priority === 0 ? 'Priority' : PRIORITY_LABEL[priority]}
            </Button>
          }
          options={priorityOptions()}
          selected={[String(priority)]}
          placeholder="Priority…"
          onSelect={([value]) => {
            const next = Number(value);
            if (isPriority(next)) setPriority(next);
          }}
        />
        <PickerPopover
          trigger={
            <Button type="button" size="sm">
              {assigneeIds.length === 0 ? (
                <>
                  <UserIcon /> Assignee
                </>
              ) : (
                <span className="flex items-center gap-1.5">
                  <span className="flex -space-x-1">
                    {assigneeIds.slice(0, 3).map((id) => (
                      <Avatar
                        key={id}
                        name={data.membersById.get(id)?.displayName ?? '?'}
                        size="xs"
                      />
                    ))}
                  </span>
                  {assigneeIds.length === 1
                    ? data.membersById.get(assigneeIds[0] ?? '')?.displayName
                    : `${assigneeIds.length} people`}
                </span>
              )}
            </Button>
          }
          multiple
          options={memberOptions(data.members, userId)}
          selected={assigneeIds}
          placeholder="Assign to…"
          onSelect={setAssigneeIds}
        />
        <PickerPopover
          trigger={
            <Button type="button" size="sm">
              {labelIds.length === 0 ? (
                <TagIcon />
              ) : (
                labelIds.slice(0, 3).map((id) => {
                  const label = data.labelsById.get(id);
                  return label ? (
                    <span
                      key={id}
                      className="size-2 rounded-full"
                      style={{ background: LABEL_COLOR[label.color] }}
                    />
                  ) : null;
                })
              )}
              {labelIds.length === 0
                ? 'Labels'
                : labelIds.length === 1
                  ? data.labelsById.get(labelIds[0] ?? '')?.name
                  : `${labelIds.length} labels`}
            </Button>
          }
          multiple
          options={labelOptions(data.labels)}
          selected={labelIds}
          placeholder="Labels…"
          onSelect={setLabelIds}
        />
        {teamProjects.length > 0 && (
          <PickerPopover
            trigger={
              <Button type="button" size="sm">
                <FolderIcon /> {project?.name ?? 'Project'}
              </Button>
            }
            options={projectOptions(teamProjects)}
            selected={[projectId ?? NO_VALUE]}
            placeholder="Project…"
            onSelect={([id]) => setProjectId(id && id !== NO_VALUE ? id : null)}
          />
        )}
        <DateField label="Due date" value={dueDate} onChange={setDueDate} variant="secondary" />
      </div>

      <div className="flex items-center justify-between gap-3 border-t border-border px-4 py-3">
        <div className="flex items-center gap-3">
          <label className="flex items-center gap-2 text-xs text-fg-muted">
            <input
              type="checkbox"
              checked={createMore}
              onChange={(event) => setCreateMore(event.target.checked)}
              className="accent-(--accent)"
            />
            Create more
          </label>
          {taskTemplates.length > 0 && (
            <PickerPopover
              trigger={
                <Button
                  type="button"
                  size="sm"
                  variant="ghost"
                  className="h-6 px-1.5 text-xs text-fg-muted"
                  disabled={templateActions.createTask.isPending}
                >
                  <LayoutTemplateIcon /> From template
                </Button>
              }
              options={taskTemplates.map((t) => ({
                value: t.id,
                label: t.name,
                ...(t.counts.subtasks > 0 && {
                  hint: `${t.counts.subtasks} sub-task${t.counts.subtasks === 1 ? '' : 's'}`,
                }),
              }))}
              selected={[]}
              placeholder="Create from template…"
              onSelect={([id]) => id && fromTemplate(id)}
            />
          )}
        </div>
        <Button type="submit" variant="primary" size="sm" disabled={lines.length === 0 || !team}>
          {lines.length > 1 ? `Create ${lines.length} tasks` : 'Create task'}
          <Shortcut
            keys="Mod+Enter"
            className="[&_kbd]:border-transparent [&_kbd]:bg-accent-fg/15 [&_kbd]:text-accent-fg"
          />
        </Button>
      </div>
    </form>
  );
}
