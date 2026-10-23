import { useTrash, useTrashActions, type TrashedTask } from '@daiq/data';
import { can, daysBetween, formatIdentifier, toIsoDate } from '@daiq/domain';
import {
  Button,
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogTitle,
  toast,
} from '@daiq/ui';
import { createFileRoute } from '@tanstack/react-router';
import { useState } from 'react';
import { TeamBadge } from '../../../components/team-badge';
import { useWorkspace, useWorkspaceData } from '../../../features/workspace/workspace-context';
import { timeAgo } from '../../../lib/time';
import { useToday } from '../../../lib/use-today';

export const Route = createFileRoute('/$workspace/settings/trash')({ component: Trash });

const KEEP_DAYS = 30;

function Trash() {
  const { workspace } = useWorkspace();
  const data = useWorkspaceData();
  const trash = useTrash(workspace.id);
  const actions = useTrashActions(workspace.id);
  const today = useToday();
  const [purging, setPurging] = useState<TrashedTask | null>(null);
  const admin = can(workspace.role, 'workspace.update');
  const daysLeft = (task: TrashedTask) =>
    Math.max(0, KEEP_DAYS - daysBetween(toIsoDate(new Date(task.deletedAt)), today));

  return (
    <section className="flex flex-col gap-4">
      <header>
        <h2 className="text-lg font-semibold font-display">Trash</h2>
        <p className="text-[13px] text-fg-muted">
          Deleted tasks stay here for {KEEP_DAYS} days, then they are deleted for good. Restoring a
          task brings back the sub-tasks deleted with it.
        </p>
      </header>

      {trash.data?.length === 0 && (
        <p className="text-[13px] text-fg-subtle">The trash is empty.</p>
      )}
      {(trash.data?.length ?? 0) > 0 && (
        <ul className="flex flex-col divide-y divide-border rounded-lg border border-border">
          {trash.data?.map((task) => {
            const team = data.teamsById.get(task.teamId);
            const identifier = team ? formatIdentifier(team.key, task.number) : '';
            return (
              <li key={task.id} className="flex items-center gap-3 px-3 py-2.5 text-[13px]">
                {team && <TeamBadge teamKey={team.key} />}
                <span className="min-w-0 flex-1">
                  <span className="block truncate">
                    <span className="text-fg-muted tabular">{identifier}</span> {task.title}
                  </span>
                  <span className="text-xs text-fg-subtle">
                    Deleted {timeAgo(task.deletedAt)}
                    {task.subtasks > 0 &&
                      `, with ${task.subtasks} sub-task${task.subtasks === 1 ? '' : 's'}`}
                    . {daysLeft(task)} days left.
                  </span>
                </span>
                <Button
                  size="sm"
                  onClick={() =>
                    actions.restore.mutate([task.id], {
                      onSuccess: () => toast(`Restored ${identifier}`),
                    })
                  }
                >
                  Restore
                </Button>
                {admin && (
                  <Button size="sm" variant="ghost" onClick={() => setPurging(task)}>
                    Delete forever
                  </Button>
                )}
              </li>
            );
          })}
        </ul>
      )}

      <Dialog open={purging !== null} onOpenChange={(open) => !open && setPurging(null)}>
        <DialogContent>
          <DialogTitle>Delete {purging?.title} forever?</DialogTitle>
          <DialogDescription>
            The task, its sub-tasks, comments and history are deleted. This can’t be undone.
          </DialogDescription>
          <DialogFooter>
            <Button onClick={() => setPurging(null)}>Cancel</Button>
            <Button
              variant="danger"
              onClick={() => {
                if (purging) actions.purge.mutate([purging.id]);
                setPurging(null);
              }}
            >
              Delete forever
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </section>
  );
}
