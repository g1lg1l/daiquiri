import {
  useCreateLabel,
  useCycles,
  useDeleteTasks,
  useRestoreTasks,
  useSetAssignees,
  useSetLabels,
  useUpdateTasks,
} from '@daiq/data';
import {
  addDays,
  firstStatusOf,
  formatDueDate,
  isPriority,
  LABEL_COLORS,
  startOfWeek,
  type Task,
  type TaskDetail,
  type TaskPatch,
} from '@daiq/domain';
import { Button, cn, CommandDialog, toast } from '@daiq/ui';
import { CalendarIcon, XIcon } from 'lucide-react';
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
import { useToday } from '../../lib/use-today';
import {
  cycleOptions,
  estimatePickerOptions,
  labelOptions,
  memberOptions,
  NO_VALUE,
  priorityOptions,
  projectOptions,
  statusOptions,
} from '../pickers/options';
import { PickerList } from '../pickers/picker-list';
import { pushUndo } from '../undo/undo';
import { useWorkspace, useWorkspaceData } from '../workspace/workspace-context';
import { useIdentifier } from './use-identifier';

export type PickerKind =
  'status' | 'priority' | 'assignee' | 'labels' | 'project' | 'dueDate' | 'estimate' | 'cycle';

interface TaskActions {
  openPicker: (kind: PickerKind, tasks: Task[]) => void;
  update: (tasks: Task[], patch: TaskPatch, label: string) => void;
  setStatus: (tasks: Task[], statusId: string) => void;
  setAssignees: (tasks: Task[], userIds: string[]) => void;
  setLabels: (tasks: Task[], labelIds: string[]) => void;
  toggleAssignMe: (tasks: Task[]) => void;
  remove: (tasks: Task[]) => void;
  copyLink: (task: Task) => void;
}

const TaskActionsContext = createContext<TaskActions | null>(null);

export function useTaskActions(): TaskActions {
  const context = useContext(TaskActionsContext);
  if (!context) throw new Error('useTaskActions must be used inside <TaskActionsProvider>');
  return context;
}

const PICKER_TITLE: Record<PickerKind, string> = {
  status: 'Change status',
  priority: 'Set priority',
  assignee: 'Assign to',
  labels: 'Labels',
  project: 'Move to project',
  dueDate: 'Due date',
  estimate: 'Set estimate',
  cycle: 'Move to cycle',
};

/** Previous values of the patched fields, for undo. */
function inverse(task: Task | TaskDetail, patch: TaskPatch): TaskPatch {
  const previous: TaskPatch = {};
  if (patch.title !== undefined) previous.title = task.title;
  if (patch.description !== undefined)
    previous.description = 'description' in task ? task.description : null;
  if (patch.statusId !== undefined) previous.statusId = task.statusId;
  if (patch.priority !== undefined) previous.priority = task.priority;
  if (patch.projectId !== undefined) previous.projectId = task.projectId;
  if (patch.parentId !== undefined) previous.parentId = task.parentId;
  if (patch.startDate !== undefined) previous.startDate = task.startDate;
  if (patch.dueDate !== undefined) previous.dueDate = task.dueDate;
  if (patch.estimate !== undefined) previous.estimate = task.estimate;
  if (patch.cycleId !== undefined) previous.cycleId = task.cycleId;
  if (patch.milestoneId !== undefined) previous.milestoneId = task.milestoneId;
  if (patch.sortKey !== undefined) previous.sortKey = task.sortKey;
  return previous;
}

export function TaskActionsProvider({ children }: { children: ReactNode }) {
  const { workspace, userId } = useWorkspace();
  const data = useWorkspaceData();
  const identifier = useIdentifier();
  const updateTasks = useUpdateTasks();
  const setAssigneesMutation = useSetAssignees();
  const setLabelsMutation = useSetLabels();
  const deleteTasks = useDeleteTasks();
  const restoreTasks = useRestoreTasks();
  const createLabel = useCreateLabel(workspace.id);
  const [picker, setPicker] = useState<{ kind: PickerKind; tasks: Task[] } | null>(null);

  const update = useCallback(
    (tasks: Task[], patch: TaskPatch, label: string) => {
      if (tasks.length === 0) return;
      updateTasks.mutate({ ids: tasks.map((t) => t.id), patch });
      const inverses = tasks.map((task) => ({ id: task.id, patch: inverse(task, patch) }));
      pushUndo(
        {
          label,
          undo: () =>
            Promise.all(
              inverses.map((entry) =>
                updateTasks.mutateAsync({ ids: [entry.id], patch: entry.patch }),
              ),
            ),
        },
        tasks.length > 1 ? { toast: `${label} on ${tasks.length} tasks` } : {},
      );
    },
    [updateTasks],
  );

  const setStatus = useCallback(
    (tasks: Task[], statusId: string) => {
      const chosen = data.statuses.get(statusId);
      if (!chosen) return;
      // Tasks of other teams move to the first status of the same category in their team.
      const byStatus = new Map<string, Task[]>();
      for (const task of tasks) {
        const target =
          task.teamId === chosen.teamId
            ? chosen.id
            : firstStatusOf(data.teamsById.get(task.teamId)?.statuses ?? [], chosen.category)?.id;
        if (target && target !== task.statusId)
          byStatus.set(target, [...(byStatus.get(target) ?? []), task]);
      }
      for (const [target, group] of byStatus)
        update(group, { statusId: target }, `Status → ${chosen.name}`);
    },
    [data.statuses, data.teamsById, update],
  );

  const setSet = useCallback(
    (
      tasks: Task[],
      next: string[],
      field: 'assigneeIds' | 'labelIds',
      mutation: typeof setAssigneesMutation,
      label: string,
    ) => {
      const previous = tasks.map((task) => ({ taskId: task.id, ids: task[field] }));
      for (const task of tasks) mutation.mutate({ taskId: task.id, ids: next });
      pushUndo({
        label,
        undo: () => Promise.all(previous.map((entry) => mutation.mutateAsync(entry))),
      });
    },
    [],
  );

  const setAssignees = useCallback(
    (tasks: Task[], userIds: string[]) =>
      setSet(tasks, userIds, 'assigneeIds', setAssigneesMutation, 'Assignees'),
    [setSet, setAssigneesMutation],
  );
  const setLabels = useCallback(
    (tasks: Task[], labelIds: string[]) =>
      setSet(tasks, labelIds, 'labelIds', setLabelsMutation, 'Labels'),
    [setSet, setLabelsMutation],
  );

  const toggleAssignMe = useCallback(
    (tasks: Task[]) => {
      const allMine = tasks.every((task) => task.assigneeIds.includes(userId));
      for (const task of tasks) {
        const next = allMine
          ? task.assigneeIds.filter((id) => id !== userId)
          : [...new Set([...task.assigneeIds, userId])];
        setAssignees([task], next);
      }
    },
    [userId, setAssignees],
  );

  const remove = useCallback(
    (tasks: Task[]) => {
      const ids = tasks.map((task) => task.id);
      deleteTasks.mutate(ids);
      const label =
        tasks.length === 1 ? `Deleted ${identifier(tasks[0]!)}` : `Deleted ${tasks.length} tasks`;
      pushUndo({ label, undo: () => restoreTasks.mutateAsync(ids) }, { toast: label });
    },
    [deleteTasks, restoreTasks, identifier],
  );

  const copyLink = useCallback(
    (task: Task) => {
      const url = `${window.location.origin}${import.meta.env.BASE_URL}${workspace.slug}/task/${identifier(task)}`;
      navigator.clipboard
        .writeText(url)
        .then(() => toast('Link copied', { id: 'copy' }))
        .catch(() => toast.error('Your browser blocked clipboard access.'));
    },
    [workspace.slug, identifier],
  );

  const openPicker = useCallback(
    (kind: PickerKind, tasks: Task[]) => {
      const team = tasks[0] && data.teamsById.get(tasks[0].teamId);
      if (!team) return;
      // Estimates and cycles are team modules: say how to turn them on instead of doing nothing.
      if (kind === 'estimate' && !team.estimatesEnabled) {
        toast(`Estimates are off for ${team.name}. Turn them on in the team's settings.`);
        return;
      }
      if (kind === 'cycle' && !team.cyclesEnabled) {
        toast(`Cycles are off for ${team.name}. Turn them on in the team's settings.`);
        return;
      }
      setPicker({ kind, tasks });
    },
    [data.teamsById],
  );

  const actionsValue = useMemo(
    () => ({
      openPicker,
      update,
      setStatus,
      setAssignees,
      setLabels,
      toggleAssignMe,
      remove,
      copyLink,
    }),
    [openPicker, update, setStatus, setAssignees, setLabels, toggleAssignMe, remove, copyLink],
  );

  const close = () => setPicker(null);
  const tasks = picker?.tasks ?? [];
  const first = tasks[0];
  const team = first ? data.teamsById.get(first.teamId) : undefined;
  const cycles = useCycles(picker?.kind === 'cycle' ? team?.id : undefined);
  const today = useToday();
  const sameTeam = tasks.filter((t) => t.teamId === first?.teamId);
  const shared = (field: 'assigneeIds' | 'labelIds') =>
    first ? first[field].filter((id) => tasks.every((task) => task[field].includes(id))) : [];

  return (
    <TaskActionsContext.Provider value={actionsValue}>
      {children}
      <CommandDialog
        open={picker !== null}
        onOpenChange={(open) => !open && close()}
        label={picker ? PICKER_TITLE[picker.kind] : ''}
      >
        {picker && first && (
          <>
            <p className="truncate px-4 pt-3 text-xs text-fg-subtle">
              {tasks.length === 1
                ? `${identifier(first)}  ${first.title}`
                : `${tasks.length} tasks selected`}
            </p>
            {picker.kind === 'status' && (
              <PickerList
                options={statusOptions(team?.statuses ?? [])}
                selected={tasks.length === 1 ? [first.statusId] : []}
                placeholder="Change status to…"
                onSelect={([id]) => id && setStatus(tasks, id)}
                onDone={close}
              />
            )}
            {picker.kind === 'priority' && (
              <PickerList
                options={priorityOptions()}
                selected={tasks.length === 1 ? [String(first.priority)] : []}
                placeholder="Set priority to…"
                onSelect={([value]) => {
                  const priority = Number(value);
                  if (isPriority(priority)) update(tasks, { priority }, 'Priority');
                }}
                onDone={close}
              />
            )}
            {picker.kind === 'assignee' && (
              <PickerList
                multiple
                options={memberOptions(
                  data.members.filter((m) => m.role !== 'guest' || team?.memberIds.includes(m.id)),
                  userId,
                )}
                selected={shared('assigneeIds')}
                placeholder="Assign to…"
                onSelect={(ids) => {
                  setAssignees(tasks, ids);
                  setPicker({
                    kind: 'assignee',
                    tasks: tasks.map((t) => ({ ...t, assigneeIds: ids })),
                  });
                }}
                onDone={close}
              />
            )}
            {picker.kind === 'labels' && (
              <PickerList
                multiple
                options={labelOptions(data.labels)}
                selected={shared('labelIds')}
                placeholder="Add labels…"
                onSelect={(ids) => {
                  setLabels(tasks, ids);
                  setPicker({ kind: 'labels', tasks: tasks.map((t) => ({ ...t, labelIds: ids })) });
                }}
                onCreate={(name) => {
                  const id = newId();
                  const color =
                    LABEL_COLORS[(data.labels.length * 3) % LABEL_COLORS.length] ?? 'gray';
                  createLabel.mutate(
                    { id, name, color },
                    {
                      onSuccess: () => {
                        const ids = [...shared('labelIds'), id];
                        setLabels(tasks, ids);
                        setPicker({
                          kind: 'labels',
                          tasks: tasks.map((t) => ({ ...t, labelIds: ids })),
                        });
                      },
                    },
                  );
                }}
                onDone={close}
              />
            )}
            {picker.kind === 'project' && (
              <PickerList
                options={projectOptions(data.projects.filter((p) => p.teamId === first.teamId))}
                selected={[first.projectId ?? NO_VALUE]}
                placeholder="Move to project…"
                onSelect={([id]) =>
                  update(
                    tasks.filter((t) => t.teamId === first.teamId),
                    { projectId: id === NO_VALUE || !id ? null : id },
                    'Project',
                  )
                }
                onDone={close}
              />
            )}
            {picker.kind === 'estimate' && team && (
              <PickerList
                options={estimatePickerOptions(team.estimateScale)}
                selected={tasks.length === 1 ? [String(first.estimate ?? NO_VALUE)] : []}
                placeholder="Set estimate to…"
                onSelect={([value]) =>
                  update(
                    sameTeam,
                    { estimate: value && value !== NO_VALUE ? Number(value) : null },
                    'Estimate',
                  )
                }
                onDone={close}
              />
            )}
            {picker.kind === 'cycle' && (
              <PickerList
                options={cycleOptions(cycles.data ?? [], today)}
                selected={tasks.length === 1 ? [first.cycleId ?? NO_VALUE] : []}
                placeholder="Move to cycle…"
                onSelect={([id]) =>
                  update(sameTeam, { cycleId: id && id !== NO_VALUE ? id : null }, 'Cycle')
                }
                onDone={close}
              />
            )}
            {picker.kind === 'dueDate' && (
              <DueDatePicker
                value={tasks.length === 1 ? first.dueDate : null}
                onChange={(dueDate) => {
                  update(tasks, { dueDate }, dueDate ? 'Due date' : 'Cleared due date');
                  close();
                }}
              />
            )}
          </>
        )}
      </CommandDialog>
    </TaskActionsContext.Provider>
  );
}

function DueDatePicker({
  value,
  onChange,
}: {
  value: string | null;
  onChange: (date: string | null) => void;
}) {
  const today = useToday();
  const nextMonday = addDays(startOfWeek(today), 7);
  const quick = [
    { label: 'Today', date: today },
    { label: 'Tomorrow', date: addDays(today, 1) },
    { label: 'Next week', date: nextMonday },
    { label: 'In two weeks', date: addDays(today, 14) },
  ];
  return (
    <PickerList
      options={[
        ...quick.map((q) => ({ value: q.date, label: q.label, hint: q.date })),
        ...(value ? [{ value: NO_VALUE, label: 'Remove due date' }] : []),
      ]}
      selected={value ? [value] : []}
      placeholder="Pick a date…"
      onSelect={([date]) => onChange(date === NO_VALUE || !date ? null : date)}
    />
  );
}

/**
 * Date property: a button showing the formatted date that opens the browser's
 * native date picker (no date-picker library; keyboard accessible via the button).
 */
export function DateField({
  label,
  value,
  onChange,
  variant = 'ghost',
}: {
  label: string;
  value: string | null;
  onChange: (value: string | null) => void;
  variant?: 'ghost' | 'secondary';
}) {
  const today = useToday();
  const input = useRef<HTMLInputElement>(null);
  return (
    <span className="relative inline-flex items-center gap-0.5">
      <Button
        type="button"
        variant={variant}
        size="sm"
        className={cn(variant === 'ghost' && 'h-7 px-1.5 font-normal', !value && 'text-fg-subtle')}
        onClick={() => {
          const element = input.current;
          if (!element) return;
          if (typeof element.showPicker === 'function') element.showPicker();
          else element.focus();
        }}
      >
        <CalendarIcon />
        {value ? formatDueDate(value, today) : label}
      </Button>
      <input
        ref={input}
        type="date"
        tabIndex={-1}
        aria-label={label}
        className="pointer-events-none absolute inset-0 size-full opacity-0"
        value={value ?? ''}
        onChange={(event) => onChange(event.target.value || null)}
      />
      {value && (
        <Button
          type="button"
          variant="ghost"
          size="icon-sm"
          className="size-6"
          aria-label={`Clear ${label.toLowerCase()}`}
          onClick={() => onChange(null)}
        >
          <XIcon className="size-3.5" />
        </Button>
      )}
    </span>
  );
}
