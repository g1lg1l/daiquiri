import type { Task } from '@daiq/domain';
import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuTrigger,
  MenuItem,
  MenuSeparator,
} from '@daiq/ui';
import {
  CalendarIcon,
  CircleDashedIcon,
  CopyIcon,
  ExternalLinkIcon,
  FolderIcon,
  LinkIcon,
  SignalHighIcon,
  TagIcon,
  Trash2Icon,
  UserIcon,
  UserPlusIcon,
} from 'lucide-react';
import { useState, type ReactNode } from 'react';
import { SHORTCUTS } from '../shortcuts/registry';
import { useTaskActions, type PickerKind } from './task-actions';

/** Elements that stand for one task, in every view. */
const TASK_ELEMENT = '[data-task-id], [data-card-id], [data-chip-id], [data-bar-id]';

const taskIdOf = (target: EventTarget) => {
  const element = target instanceof Element ? target.closest<HTMLElement>(TASK_ELEMENT) : null;
  if (!element) return undefined;
  const { taskId, cardId, chipId, barId } = element.dataset;
  return taskId ?? cardId ?? chipId ?? barId;
};

const PICKERS: { kind: PickerKind; label: string; icon: ReactNode; keys: string }[] = [
  { kind: 'status', label: 'Status…', icon: <CircleDashedIcon />, keys: SHORTCUTS.status.keys },
  { kind: 'priority', label: 'Priority…', icon: <SignalHighIcon />, keys: SHORTCUTS.priority.keys },
  { kind: 'assignee', label: 'Assignees…', icon: <UserIcon />, keys: SHORTCUTS.assignee.keys },
  { kind: 'labels', label: 'Labels…', icon: <TagIcon />, keys: SHORTCUTS.labels.keys },
  { kind: 'dueDate', label: 'Due date…', icon: <CalendarIcon />, keys: SHORTCUTS.dueDate.keys },
  { kind: 'project', label: 'Project…', icon: <FolderIcon />, keys: SHORTCUTS.project.keys },
];

/**
 * Right-click (or long-press) on any task inside `children` opens the task's
 * actions. `tasksFor` says which tasks a click on one task acts on (the
 * selection, when the task is part of it). Elsewhere the browser's own menu
 * is left alone.
 */
export function TaskContextMenu({
  tasksFor,
  onOpen,
  children,
}: {
  tasksFor: (taskId: string) => Task[];
  onOpen: (task: Task, mode: 'page' | 'peek') => void;
  children: ReactNode;
}) {
  const actions = useTaskActions();
  const [tasks, setTasks] = useState<Task[]>([]);
  const [first] = tasks;
  return (
    <ContextMenu>
      <ContextMenuTrigger
        className="contents"
        onContextMenu={(event) => {
          const id = taskIdOf(event.target);
          const next = id ? tasksFor(id) : [];
          if (next.length === 0) event.preventBaseUIHandler();
          else setTasks(next);
        }}
      >
        {children}
      </ContextMenuTrigger>
      <ContextMenuContent className="w-56">
        {first && tasks.length === 1 && (
          <>
            <MenuItem onClick={() => onOpen(first, 'page')} shortcut={SHORTCUTS.open.keys}>
              <ExternalLinkIcon />
              Open
            </MenuItem>
            <MenuSeparator />
          </>
        )}
        {PICKERS.map((picker) => (
          <MenuItem
            key={picker.kind}
            onClick={() => actions.openPicker(picker.kind, tasks)}
            shortcut={picker.keys}
          >
            {picker.icon}
            {picker.label}
          </MenuItem>
        ))}
        <MenuItem onClick={() => actions.toggleAssignMe(tasks)} shortcut={SHORTCUTS.assignMe.keys}>
          <UserPlusIcon />
          Assign to me
        </MenuItem>
        {first && tasks.length === 1 && (
          <>
            <MenuSeparator />
            <MenuItem onClick={() => actions.copyId(first)} shortcut={SHORTCUTS.copyId.keys}>
              <CopyIcon />
              Copy ID
            </MenuItem>
            <MenuItem onClick={() => actions.copyLink(first)} shortcut={SHORTCUTS.copyLink.keys}>
              <LinkIcon />
              Copy link
            </MenuItem>
          </>
        )}
        <MenuSeparator />
        <MenuItem
          destructive
          onClick={() => actions.remove(tasks)}
          shortcut={SHORTCUTS.remove.keys}
        >
          <Trash2Icon />
          {tasks.length > 1 ? `Delete ${tasks.length} tasks` : 'Delete'}
        </MenuItem>
      </ContextMenuContent>
    </ContextMenu>
  );
}
