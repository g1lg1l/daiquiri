import { useRunningTimer, useTimerActions } from '@daiq/data';
import { formatClock, formatIdentifier } from '@daiq/domain';
import { Button } from '@daiq/ui';
import { Link } from '@tanstack/react-router';
import { SquareIcon } from 'lucide-react';
import { m } from '../../i18n';
import { useWorkspace, useWorkspaceData } from '../workspace/workspace-context';
import { useElapsed } from './use-elapsed';

/** The signed-in person's running timer, wherever they are in the app. */
export function RunningTimer() {
  const { workspace, userId } = useWorkspace();
  const data = useWorkspaceData();
  const running = useRunningTimer(userId).data;
  const { stop } = useTimerActions(userId);
  const elapsed = useElapsed(running?.startedAt);
  const team = running ? data.teamsById.get(running.task.teamId) : undefined;
  if (!running || !team || running.task.number === null) return null;
  const identifier = formatIdentifier(team.key, running.task.number);
  return (
    // Not a live region: the clock ticks every second.
    <section
      aria-label={m.task.time.running(identifier)}
      className="flex items-center gap-2 rounded-md border border-accent/40 bg-accent-subtle/40 px-2 py-1.5 text-xs"
    >
      <span
        aria-hidden
        className="size-2 shrink-0 animate-pulse rounded-full bg-accent motion-reduce:animate-none"
      />
      <Link
        to="/$workspace/task/$identifier"
        params={{ workspace: workspace.slug, identifier }}
        className="min-w-0 flex-1 truncate hover:underline"
      >
        {running.task.title}
      </Link>
      <span className="text-fg-muted tabular">{formatClock(elapsed)}</span>
      <Button
        variant="ghost"
        size="icon-sm"
        aria-label={m.task.time.stopTimer}
        onClick={() => stop.mutate()}
        className="size-6"
      >
        <SquareIcon className="fill-current" />
      </Button>
    </section>
  );
}
