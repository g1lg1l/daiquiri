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
import { m } from '../../../i18n/settings';
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
        <h2 className="text-lg font-semibold font-display">{m.settings.sections.trash}</h2>
        <p className="text-[13px] text-fg-muted">{m.settings.trash.intro(KEEP_DAYS)}</p>
      </header>

      {trash.data?.length === 0 && (
        <p className="text-[13px] text-fg-subtle">{m.settings.trash.empty}</p>
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
                    {m.settings.trash.deleted(
                      timeAgo(task.deletedAt),
                      task.subtasks,
                      daysLeft(task),
                    )}
                  </span>
                </span>
                <Button
                  size="sm"
                  onClick={() =>
                    actions.restore.mutate([task.id], {
                      onSuccess: () => toast(m.settings.trash.restored(identifier)),
                    })
                  }
                >
                  {m.common.restore}
                </Button>
                {admin && (
                  <Button size="sm" variant="ghost" onClick={() => setPurging(task)}>
                    {m.settings.trash.deleteForever}
                  </Button>
                )}
              </li>
            );
          })}
        </ul>
      )}

      <Dialog open={purging !== null} onOpenChange={(open) => !open && setPurging(null)}>
        <DialogContent>
          <DialogTitle>{m.settings.trash.purgeTitle(purging?.title ?? '')}</DialogTitle>
          <DialogDescription>{m.settings.trash.purgeDescription}</DialogDescription>
          <DialogFooter>
            <Button onClick={() => setPurging(null)}>{m.common.cancel}</Button>
            <Button
              variant="danger"
              onClick={() => {
                if (purging) actions.purge.mutate([purging.id]);
                setPurging(null);
              }}
            >
              {m.settings.trash.deleteForever}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </section>
  );
}
