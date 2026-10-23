import type { Priority, StatusCategory } from '@daiq/domain';
import { cn } from '@daiq/ui';
import { useState } from 'react';

const statusColor: Record<StatusCategory, string> = {
  triage: 'text-status-triage',
  backlog: 'text-status-backlog',
  unstarted: 'text-status-unstarted',
  started: 'text-status-started',
  completed: 'text-status-completed',
  canceled: 'text-status-canceled',
};

/** Status icon by category: shape carries meaning, colour reinforces it. */
export function StatusIcon({
  category,
  className,
}: {
  category: StatusCategory;
  className?: string;
}) {
  const common = { fill: 'none', stroke: 'currentColor', strokeWidth: 1.6 } as const;
  // Completing a task pops its icon; icons that load completed stay still.
  const [shown, setShown] = useState(category);
  const [pop, setPop] = useState(false);
  if (shown !== category) {
    setShown(category);
    setPop(category === 'completed');
  }
  return (
    <svg
      viewBox="0 0 16 16"
      className={cn('size-3.5 shrink-0', statusColor[category], pop && 'animate-pop', className)}
      onAnimationEnd={() => setPop(false)}
      aria-hidden
    >
      {category === 'backlog' && <circle cx="8" cy="8" r="6" {...common} strokeDasharray="2.2 2" />}
      {category === 'triage' && (
        <>
          <circle cx="8" cy="8" r="6" {...common} />
          <circle cx="8" cy="8" r="2" fill="currentColor" />
        </>
      )}
      {category === 'unstarted' && <circle cx="8" cy="8" r="6" {...common} />}
      {category === 'started' && (
        <>
          <circle cx="8" cy="8" r="6" {...common} />
          <path d="M8 4a4 4 0 0 1 0 8z" fill="currentColor" />
        </>
      )}
      {category === 'completed' && (
        <>
          <circle cx="8" cy="8" r="6.8" fill="currentColor" />
          <path
            d="m5.2 8.2 1.9 1.9 3.8-3.9"
            fill="none"
            stroke="var(--surface)"
            strokeWidth="1.7"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </>
      )}
      {category === 'canceled' && (
        <>
          <circle cx="8" cy="8" r="6.8" fill="currentColor" />
          <path
            d="m5.8 5.8 4.4 4.4m0-4.4-4.4 4.4"
            stroke="var(--surface)"
            strokeWidth="1.6"
            strokeLinecap="round"
          />
        </>
      )}
    </svg>
  );
}

/** Priority: dots for none, signal bars for low → high, an alert badge for urgent. */
export function PriorityIcon({ priority, className }: { priority: Priority; className?: string }) {
  if (priority === 1) {
    return (
      <svg
        viewBox="0 0 16 16"
        className={cn('size-3.5 shrink-0 text-priority-urgent', className)}
        aria-hidden
      >
        <rect x="1.5" y="1.5" width="13" height="13" rx="3.5" fill="currentColor" />
        <path d="M8 4.6v4.4" stroke="var(--surface)" strokeWidth="1.8" strokeLinecap="round" />
        <circle cx="8" cy="11.4" r="1" fill="var(--surface)" />
      </svg>
    );
  }
  if (priority === 0) {
    return (
      <svg
        viewBox="0 0 16 16"
        className={cn('size-3.5 shrink-0 text-fg-subtle', className)}
        aria-hidden
      >
        {[3.5, 8, 12.5].map((x) => (
          <rect key={x} x={x - 1.1} y="7" width="2.2" height="2" rx="0.6" fill="currentColor" />
        ))}
      </svg>
    );
  }
  const filled = 4 - priority + 1; // high 3, medium 2, low 1
  return (
    <svg
      viewBox="0 0 16 16"
      className={cn('size-3.5 shrink-0 text-fg-muted', className)}
      aria-hidden
    >
      {[0, 1, 2].map((bar) => (
        <rect
          key={bar}
          x={2 + bar * 4.5}
          y={10 - bar * 3.5}
          width="3"
          height={4 + bar * 3.5}
          rx="1"
          fill="currentColor"
          opacity={bar < filled ? 1 : 0.28}
        />
      ))}
    </svg>
  );
}
