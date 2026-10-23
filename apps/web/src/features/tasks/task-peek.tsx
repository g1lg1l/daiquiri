import type { Task } from '@daiq/domain';
import { useEffect } from 'react';
import { m } from '../../i18n';
import { TaskDetail } from './task-detail';
import { useIdentifier } from './use-identifier';

/** Side peek: the task beside the list, closed with Esc (focus returns to the list). */
export function TaskPeek({ task, onClose }: { task: Task; onClose: () => void }) {
  const identifier = useIdentifier();
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (
        event.key === 'Escape' &&
        !event.defaultPrevented &&
        !document.querySelector('[role="dialog"]')
      ) {
        onClose();
        document.querySelector<HTMLElement>(`[data-task-id="${task.id}"]`)?.focus();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose, task.id]);

  return (
    <aside
      aria-label={m.tasks.preview}
      className="flex w-[min(46vw,560px)] shrink-0 animate-in flex-col border-l border-border bg-surface duration-200 fade-in-0 slide-in-from-right-4 motion-reduce:animate-none"
    >
      <TaskDetail key={task.id} identifier={identifier(task)} mode="peek" onClose={onClose} />
    </aside>
  );
}
