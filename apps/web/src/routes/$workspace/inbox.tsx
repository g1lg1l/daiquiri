import { useNotifications, useUpdateNotifications } from '@daiq/data';
import { addDays, type Notification } from '@daiq/domain';
import { Avatar, Button, buttonVariants, cn, Shortcut } from '@daiq/ui';
import { createFileRoute, Link } from '@tanstack/react-router';
import { ArchiveIcon, CheckCheckIcon, InboxIcon } from 'lucide-react';
import { useMemo, useState } from 'react';
import { z } from 'zod';
import { ViewHeader } from '../../features/shell/view-header';
import { SHORTCUTS } from '../../features/shortcuts/registry';
import { useShortcuts } from '../../features/shortcuts/use-shortcuts';
import { TaskDetail } from '../../features/tasks/task-detail';
import { useIdentifier } from '../../features/tasks/use-identifier';
import { useWorkspace, useWorkspaceData } from '../../features/workspace/workspace-context';
import { timeAgo } from '../../lib/time';
import { nowIso, useToday } from '../../lib/use-today';

export const Route = createFileRoute('/$workspace/inbox')({
  validateSearch: z.object({
    tab: z.enum(['inbox', 'snoozed', 'archived']).optional().catch(undefined),
  }),
  component: Inbox,
});

const VERB: Record<Notification['kind'], string> = {
  assigned: 'assigned you',
  mention: 'mentioned you',
  comment: 'commented',
  status: 'changed the status',
  unblocked: 'unblocked your task',
  automation: 'asked you to look at this',
  update_reminder: 'reminds you to post a project update',
};

function Inbox() {
  const { workspace } = useWorkspace();
  const data = useWorkspaceData();
  const identifier = useIdentifier();
  const notifications = useNotifications(workspace.id);
  const update = useUpdateNotifications(workspace.id);
  const tab = Route.useSearch().tab ?? 'inbox';
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const today = useToday();
  const [now] = useState(nowIso);

  const items = useMemo(
    () =>
      (notifications.data ?? []).filter((n) => {
        const snoozed = n.snoozedUntil !== null && n.snoozedUntil > now;
        if (tab === 'archived') return n.archivedAt !== null;
        if (tab === 'snoozed') return snoozed && !n.archivedAt;
        return !n.archivedAt && !snoozed;
      }),
    [notifications.data, tab, now],
  );
  const selected = items.find((n) => n.id === selectedId) ?? null;
  const selectedIdentifier = selected?.task
    ? identifier({ teamId: selected.task.teamId, number: selected.task.number })
    : null;
  const unreadIds = items.filter((n) => !n.readAt).map((n) => n.id);

  const open = (notification: Notification) => {
    setSelectedId(notification.id);
    if (!notification.readAt)
      update.mutate({ ids: [notification.id], patch: { readAt: nowIso() } });
  };
  const move = (delta: 1 | -1) => {
    const index = items.findIndex((n) => n.id === selectedId);
    const next = items[Math.max(0, Math.min(items.length - 1, index + delta))];
    if (next) {
      open(next);
      document.querySelector<HTMLElement>(`[data-notification-id="${next.id}"]`)?.focus();
    }
  };
  const archive = (notification: Notification) => {
    move(1);
    update.mutate({
      ids: [notification.id],
      patch: { archivedAt: tab === 'archived' ? null : nowIso() },
    });
  };
  const snooze = (notification: Notification) => {
    const tomorrow = new Date(`${addDays(today, 1)}T09:00:00`).toISOString();
    move(1);
    update.mutate({
      ids: [notification.id],
      patch: { snoozedUntil: tab === 'snoozed' ? null : tomorrow },
    });
  };

  useShortcuts({
    next: () => move(1),
    previous: () => move(-1),
    toggleRead: () =>
      selected &&
      update.mutate({ ids: [selected.id], patch: { readAt: selected.readAt ? null : nowIso() } }),
    archive: () => selected && archive(selected),
    snooze: () => selected && snooze(selected),
  });

  return (
    <div className="flex min-h-0 flex-1">
      <div className="flex w-full min-w-0 flex-col md:w-[400px] md:shrink-0 md:border-r md:border-border">
        <ViewHeader title="Inbox" icon={<InboxIcon className="size-4 text-fg-muted" />}>
          {unreadIds.length > 0 && tab === 'inbox' && (
            <Button
              variant="ghost"
              size="sm"
              onClick={() => update.mutate({ ids: unreadIds, patch: { readAt: nowIso() } })}
            >
              <CheckCheckIcon /> Mark all read
            </Button>
          )}
        </ViewHeader>
        <nav
          aria-label="Inbox sections"
          className="flex gap-0.5 border-b border-border px-3 py-1.5"
        >
          {(['inbox', 'snoozed', 'archived'] as const).map((value) => (
            <Link
              key={value}
              to="."
              search={{ tab: value === 'inbox' ? undefined : value }}
              replace
              className={cn(
                'rounded-md px-2 py-1 text-xs text-fg-muted capitalize hover:bg-surface-muted hover:text-fg',
                tab === value && 'bg-surface-emphasis font-medium text-fg',
              )}
            >
              {value}
            </Link>
          ))}
        </nav>
        <ul className="min-h-0 flex-1 overflow-y-auto scrollbar-thin" aria-label="Notifications">
          {items.map((notification) => {
            const task = notification.task;
            const actor = notification.actorId
              ? data.membersById.get(notification.actorId)
              : undefined;
            return (
              <li key={notification.id}>
                <button
                  type="button"
                  data-notification-id={notification.id}
                  onClick={() => open(notification)}
                  aria-current={selectedId === notification.id || undefined}
                  className={cn(
                    'flex w-full gap-3 border-b border-border/60 px-4 py-3 text-left hover:bg-surface-subtle focus-visible:bg-surface-muted',
                    selectedId === notification.id && 'bg-surface-muted',
                  )}
                >
                  <Avatar
                    name={
                      actor?.displayName ??
                      (notification.kind === 'automation' ? 'Automation' : 'Daiquiri')
                    }
                    size="lg"
                  />
                  <span className="flex min-w-0 flex-1 flex-col gap-0.5">
                    <span className="flex items-center gap-2 text-[13px]">
                      <span className={cn('truncate', !notification.readAt && 'font-semibold')}>
                        {task?.title ?? notification.project?.name ?? 'A task'}
                      </span>
                      {!notification.readAt && (
                        <span
                          className="size-2 shrink-0 rounded-full bg-accent"
                          aria-label="Unread"
                        />
                      )}
                    </span>
                    <span className="truncate text-xs text-fg-muted">
                      {actor?.displayName ??
                        (notification.kind === 'automation'
                          ? 'An automation'
                          : notification.kind === 'update_reminder'
                            ? 'Daiquiri'
                            : 'Someone')}{' '}
                      {VERB[notification.kind]}
                      {notification.eventCount > 1 && ` and ${notification.eventCount - 1} more`}
                    </span>
                  </span>
                  <span className="flex shrink-0 flex-col items-end gap-1 text-[11px] text-fg-subtle">
                    <time dateTime={notification.createdAt}>{timeAgo(notification.createdAt)}</time>
                    {task && (
                      <span className="tabular">
                        {identifier({ teamId: task.teamId, number: task.number })}
                      </span>
                    )}
                  </span>
                </button>
              </li>
            );
          })}
          {items.length === 0 && (
            <li className="flex flex-col items-center gap-2 px-6 py-20 text-center text-[13px] text-fg-muted">
              <ArchiveIcon className="size-5 text-fg-subtle" aria-hidden />
              {tab === 'inbox'
                ? 'You’re all caught up.'
                : tab === 'snoozed'
                  ? 'Nothing snoozed.'
                  : 'No archived notifications.'}
            </li>
          )}
        </ul>
        <p className="hidden items-center gap-3 border-t border-border px-4 py-2 text-[11px] text-fg-subtle md:flex">
          <span className="flex items-center gap-1">
            <Shortcut keys={SHORTCUTS.toggleRead.keys} /> read
          </span>
          <span className="flex items-center gap-1">
            <Shortcut keys={SHORTCUTS.archive.keys} /> archive
          </span>
          <span className="flex items-center gap-1">
            <Shortcut keys={SHORTCUTS.snooze.keys} /> snooze
          </span>
        </p>
      </div>
      <section aria-label="Notification detail" className="hidden min-w-0 flex-1 flex-col md:flex">
        {selectedIdentifier ? (
          <TaskDetail key={selectedIdentifier} identifier={selectedIdentifier} mode="peek" />
        ) : selected?.project ? (
          <div className="flex flex-1 flex-col items-center justify-center gap-3 px-6 text-center">
            <p className="text-[13px] text-fg-muted">
              No update on <strong className="text-fg">{selected.project.name}</strong> this week. A
              few lines on how it is going keep everyone in the loop.
            </p>
            <Link
              to="/$workspace/project/$projectId"
              params={{ workspace: workspace.slug, projectId: selected.project.id }}
              search={{ tab: 'updates' }}
              className={buttonVariants({ variant: 'primary', size: 'sm' })}
            >
              Post an update
            </Link>
          </div>
        ) : (
          <div className="flex flex-1 items-center justify-center text-[13px] text-fg-subtle">
            Select a notification to see the task.
          </div>
        )}
      </section>
    </div>
  );
}
