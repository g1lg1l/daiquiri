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
import { Button, cn, CommandDialog, DatePicker, InlineCalendar, toast } from '@daiq/ui';
import { CalendarIcon, XIcon } from 'lucide-react';
import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from 'react';
import { m } from '../../i18n';
import { copyText } from '../../lib/clipboard';
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
  copyId: (task: Task) => void;
  copyLink: (task: Task) => void;
}

const TaskActionsContext = createContext<TaskActions | null>(null);

export function useTaskActions(): TaskActions {
  const context = useContext(TaskActionsContext);
  if (!context) throw new Error('useTaskActions must be used inside <TaskActionsProvider>');
  return context;
}

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
        tasks.length > 1 ? { toast: m.tasks.undo.onTasks(label, tasks.length) } : {},
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
        update(group, { statusId: target }, m.tasks.undo.status(chosen.name));
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
      setSet(tasks, userIds, 'assigneeIds', setAssigneesMutation, m.tasks.field.assignees),
    [setSet, setAssigneesMutation],
  );
  const setLabels = useCallback(
    (tasks: Task[], labelIds: string[]) =>
      setSet(tasks, labelIds, 'labelIds', setLabelsMutation, m.tasks.field.labels),
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
        tasks.length === 1
          ? m.tasks.undo.deleted(identifier(tasks[0]!))
          : m.tasks.undo.deletedMany(tasks.length);
      pushUndo({ label, undo: () => restoreTasks.mutateAsync(ids) }, { toast: label });
    },
    [deleteTasks, restoreTasks, identifier],
  );

  const copyId = useCallback(
    (task: Task) => copyText(identifier(task), m.common.copied(identifier(task))),
    [identifier],
  );

  const copyLink = useCallback(
    (task: Task) =>
      copyText(
        `${window.location.origin}${import.meta.env.BASE_URL}${workspace.slug}/task/${identifier(task)}`,
        m.common.linkCopied,
      ),
    [workspace.slug, identifier],
  );

  const openPicker = useCallback(
    (kind: PickerKind, tasks: Task[]) => {
      const team = tasks[0] && data.teamsById.get(tasks[0].teamId);
      if (!team) return;
      // Estimates and cycles are team modules: say how to turn them on instead of doing nothing.
      if (kind === 'estimate' && !team.estimatesEnabled) {
        toast.info(m.tasks.picker.estimatesOff(team.name));
        return;
      }
      if (kind === 'cycle' && !team.cyclesEnabled) {
        toast.info(m.tasks.picker.cyclesOff(team.name));
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
      copyId,
      copyLink,
    }),
    [
      openPicker,
      update,
      setStatus,
      setAssignees,
      setLabels,
      toggleAssignMe,
      remove,
      copyId,
      copyLink,
    ],
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
        label={picker ? m.tasks.picker.title[picker.kind] : ''}
      >
        {picker && first && (
          <>
            <p className="truncate px-4 pt-3 text-xs text-fg-subtle">
              {tasks.length === 1
                ? `${identifier(first)}  ${first.title}`
                : m.tasks.picker.selected(tasks.length)}
            </p>
            {picker.kind === 'status' && (
              <PickerList
                options={statusOptions(team?.statuses ?? [])}
                selected={tasks.length === 1 ? [first.statusId] : []}
                placeholder={m.tasks.picker.placeholder.status}
                onSelect={([id]) => id && setStatus(tasks, id)}
                onDone={close}
              />
            )}
            {picker.kind === 'priority' && (
              <PickerList
                options={priorityOptions()}
                selected={tasks.length === 1 ? [String(first.priority)] : []}
                placeholder={m.tasks.picker.placeholder.priority}
                onSelect={([value]) => {
                  const priority = Number(value);
                  if (isPriority(priority)) update(tasks, { priority }, m.tasks.field.priority);
                }}
                onDone={close}
              />
            )}
            {picker.kind === 'assignee' && (
              <PickerList
                multiple
                options={memberOptions(
                  data.members.filter(
                    (member) => member.role !== 'guest' || team?.memberIds.includes(member.id),
                  ),
                  userId,
                )}
                selected={shared('assigneeIds')}
                placeholder={m.tasks.picker.placeholder.assignee}
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
                placeholder={m.tasks.picker.placeholder.labels}
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
                placeholder={m.tasks.picker.placeholder.project}
                onSelect={([id]) =>
                  update(
                    tasks.filter((t) => t.teamId === first.teamId),
                    { projectId: id === NO_VALUE || !id ? null : id },
                    m.tasks.field.project,
                  )
                }
                onDone={close}
              />
            )}
            {picker.kind === 'estimate' && team && (
              <PickerList
                options={estimatePickerOptions(team.estimateScale)}
                selected={tasks.length === 1 ? [String(first.estimate ?? NO_VALUE)] : []}
                placeholder={m.tasks.picker.placeholder.estimate}
                onSelect={([value]) =>
                  update(
                    sameTeam,
                    { estimate: value && value !== NO_VALUE ? Number(value) : null },
                    m.tasks.field.estimate,
                  )
                }
                onDone={close}
              />
            )}
            {picker.kind === 'cycle' && (
              <PickerList
                options={cycleOptions(cycles.data ?? [], today)}
                selected={tasks.length === 1 ? [first.cycleId ?? NO_VALUE] : []}
                placeholder={m.tasks.picker.placeholder.cycle}
                onSelect={([id]) =>
                  update(
                    sameTeam,
                    { cycleId: id && id !== NO_VALUE ? id : null },
                    m.tasks.field.cycle,
                  )
                }
                onDone={close}
              />
            )}
            {picker.kind === 'dueDate' && (
              <DueDatePicker
                value={tasks.length === 1 ? first.dueDate : null}
                onChange={(dueDate) => {
                  update(
                    tasks,
                    { dueDate },
                    dueDate ? m.tasks.field.dueDate : m.tasks.undo.clearedDueDate,
                  );
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

/** The quick dates offered by every date picker. */
function useQuickDates() {
  const today = useToday();
  return [
    { label: m.common.today, value: today },
    { label: m.common.tomorrow, value: addDays(today, 1) },
    { label: m.common.nextWeek, value: addDays(startOfWeek(today), 7) },
    { label: m.common.inTwoWeeks, value: addDays(today, 14) },
  ];
}

function DueDatePicker({
  value,
  onChange,
}: {
  value: string | null;
  onChange: (date: string | null) => void;
}) {
  const quick = useQuickDates();
  return (
    <>
      <PickerList
        options={[
          ...quick.map((q) => ({ value: q.value, label: q.label, hint: q.value })),
          ...(value ? [{ value: NO_VALUE, label: m.tasks.picker.removeDueDate }] : []),
        ]}
        selected={value ? [value] : []}
        placeholder={m.tasks.picker.placeholder.date}
        onSelect={([date]) => onChange(date === NO_VALUE || !date ? null : date)}
      />
      <div className="flex justify-center border-t border-border p-2">
        <InlineCalendar value={value} onChange={onChange} />
      </div>
    </>
  );
}

/** Date property: a button showing the date that opens a calendar with quick picks. */
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
  const quick = useQuickDates();
  const shown = value ? formatDueDate(value, today) : label;
  return (
    <span className="relative inline-flex items-center gap-0.5">
      <DatePicker value={value} onChange={onChange} label={label} quickPicks={quick}>
        <Button
          type="button"
          variant={variant}
          size="sm"
          aria-label={value ? m.tasks.dateField.value(label, shown) : label}
          className={cn(
            variant === 'ghost' && 'h-7 px-1.5 font-normal',
            !value && 'text-fg-subtle',
          )}
        >
          <CalendarIcon />
          {shown}
        </Button>
      </DatePicker>
      {value && (
        <Button
          type="button"
          variant="ghost"
          size="icon-sm"
          className="size-6"
          aria-label={m.tasks.dateField.clear(label)}
          onClick={() => onChange(null)}
        >
          <XIcon className="size-3.5" />
        </Button>
      )}
    </span>
  );
}
