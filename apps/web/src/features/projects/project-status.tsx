import type { ProjectStatus } from '@daiq/domain';
import { cn } from '@daiq/ui';

export const PROJECT_STATUS_LABEL: Record<ProjectStatus, string> = {
  planned: 'Planned',
  active: 'Active',
  paused: 'Paused',
  completed: 'Completed',
  canceled: 'Canceled',
};

export const PROJECT_STATUSES: ProjectStatus[] = [
  'planned',
  'active',
  'paused',
  'completed',
  'canceled',
];

const tone: Record<ProjectStatus, string> = {
  planned: 'text-status-unstarted',
  active: 'text-status-started',
  paused: 'text-status-backlog',
  completed: 'text-status-completed',
  canceled: 'text-status-canceled',
};

/** Project status: a ring that fills with progress, coloured by status. */
export function ProjectStatusIcon({
  status,
  progress = 0,
  className,
}: {
  status: ProjectStatus;
  progress?: number;
  className?: string;
}) {
  const circumference = 2 * Math.PI * 5.5;
  return (
    <svg
      viewBox="0 0 16 16"
      className={cn('size-3.5 shrink-0', tone[status], className)}
      aria-hidden
    >
      <circle
        cx="8"
        cy="8"
        r="5.5"
        fill="none"
        stroke="currentColor"
        strokeOpacity="0.3"
        strokeWidth="2"
      />
      <circle
        cx="8"
        cy="8"
        r="5.5"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeDasharray={`${circumference * Math.min(1, Math.max(0, progress))} ${circumference}`}
        transform="rotate(-90 8 8)"
        strokeLinecap="round"
      />
    </svg>
  );
}

export function progressOf(counts: { done: number; total: number }): number {
  return counts.total === 0 ? 0 : counts.done / counts.total;
}
