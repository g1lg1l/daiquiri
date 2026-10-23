import { REALTIME_SUBSCRIBE_STATES } from '@supabase/supabase-js';
import { useQueryClient, type QueryClient } from '@tanstack/react-query';
import { useEffect, useEffectEvent } from 'react';
import type { DaiqClient } from './client';
import { pendingWrites, removeTasks } from './cache';
import { useDaiqClient } from './context';
import { unwrap } from './errors';
import { keys } from './keys';
import { refreshTasks } from './tasks';

/** Thin event broadcast by database triggers (ADR-0007). */
interface ChangeEvent {
  entity: string;
  id: string;
  op: 'insert' | 'update' | 'delete';
  actor_id: string | null;
}

const COALESCE_MS = 100;

function isChangeEvent(payload: unknown): payload is ChangeEvent {
  return (
    typeof payload === 'object' &&
    payload !== null &&
    'entity' in payload &&
    typeof payload.entity === 'string' &&
    'id' in payload &&
    typeof payload.id === 'string' &&
    'op' in payload &&
    (payload.op === 'insert' || payload.op === 'update' || payload.op === 'delete')
  );
}

/** Above this many changed tasks in one batch, refetching the visible lists once is cheaper. */
const BULK_TASK_EVENTS = 300;

function hasIdIn(data: unknown, ids: ReadonlySet<string>): boolean {
  return (
    typeof data === 'object' &&
    data !== null &&
    'id' in data &&
    typeof data.id === 'string' &&
    ids.has(data.id)
  );
}

/** True for `[prefix, id]` keys whose id is in `ids` (comments, activity, relations). */
const keyFor =
  (prefix: string, ids: ReadonlySet<string>) =>
  ({ queryKey }: { queryKey: readonly unknown[] }) =>
    queryKey[0] === prefix && typeof queryKey[1] === 'string' && ids.has(queryKey[1]);

async function applyTaskEvents(
  client: DaiqClient,
  queryClient: QueryClient,
  events: readonly ChangeEvent[],
): Promise<void> {
  // Our own optimistic writes are already in the cache.
  const relevant = events.filter((event) => !pendingWrites.has(event.id));
  if (relevant.length === 0) return;
  const deleted = new Set(relevant.filter((e) => e.op === 'delete').map((e) => e.id));
  const changed = relevant.filter((e) => e.op !== 'delete').map((e) => e.id);
  if (deleted.size > 0) removeTasks(queryClient, deleted);
  if (changed.length > BULK_TASK_EVENTS) {
    await queryClient.invalidateQueries({ queryKey: keys.allTasks() });
  } else if (changed.length > 0) {
    await refreshTasks(client, queryClient, changed);
  }
  const ids = new Set(relevant.map((e) => e.id));
  await Promise.all([
    queryClient.invalidateQueries({
      queryKey: keys.allTaskDetails(),
      predicate: (query) => hasIdIn(query.state.data, ids),
    }),
    queryClient.invalidateQueries({ predicate: keyFor('activity', ids) }),
    queryClient.invalidateQueries({ predicate: keyFor('attachments', ids) }),
    queryClient.invalidateQueries({ queryKey: ['relations'] }),
    queryClient.invalidateQueries({ queryKey: ['status-flow'] }),
  ]);
}

async function applyCommentEvents(
  client: DaiqClient,
  queryClient: QueryClient,
  events: readonly ChangeEvent[],
): Promise<void> {
  const rows = unwrap(
    await client
      .from('comments')
      .select('task_id')
      .in(
        'id',
        events.map((e) => e.id),
      ),
  );
  const taskIds = new Set(rows.map((row) => row.task_id));
  if (taskIds.size === 0) return;
  await Promise.all([
    queryClient.invalidateQueries({ predicate: keyFor('comments', taskIds) }),
    queryClient.invalidateQueries({ predicate: keyFor('activity', taskIds) }),
  ]);
}

/**
 * Applies one coalesced batch: task changes are fetched in bulk (or the lists
 * refetched once for imports), every other entity invalidates its query once.
 */
async function applyEvents(
  client: DaiqClient,
  queryClient: QueryClient,
  workspaceId: string,
  events: readonly ChangeEvent[],
): Promise<void> {
  const byEntity = new Map<string, ChangeEvent[]>();
  for (const event of events) {
    byEntity.set(event.entity, [...(byEntity.get(event.entity) ?? []), event]);
  }
  const invalidate = (queryKey: readonly unknown[]) => queryClient.invalidateQueries({ queryKey });
  const work: Promise<unknown>[] = [];
  for (const [entity, batch] of byEntity) {
    switch (entity) {
      case 'task':
        work.push(applyTaskEvents(client, queryClient, batch));
        break;
      case 'task_bulk':
        // An import or bulk edit: the database sent one event per team instead of per task.
        work.push(invalidate(keys.allTasks()));
        break;
      case 'comment':
        work.push(applyCommentEvents(client, queryClient, batch));
        break;
      case 'project':
        work.push(invalidate(keys.projects(workspaceId)));
        break;
      case 'label':
        work.push(invalidate(keys.labels(workspaceId)));
        break;
      case 'team':
      case 'status':
        work.push(invalidate(keys.teams(workspaceId)));
        break;
      case 'cycle':
        work.push(invalidate(['cycles']));
        break;
      case 'custom_field':
        work.push(invalidate(keys.customFields(workspaceId)), invalidate(keys.teams(workspaceId)));
        break;
      case 'milestone':
        work.push(invalidate(['milestones']));
        break;
      case 'project_update':
        work.push(invalidate(['project-updates']));
        break;
      case 'workspace_member':
        work.push(
          invalidate(keys.members(workspaceId)),
          invalidate(keys.teams(workspaceId)),
          invalidate(keys.workspaces()),
        );
        break;
      case 'notification':
        work.push(invalidate(keys.notifications(workspaceId)));
        break;
      default:
        break;
    }
  }
  await Promise.all(work);
}

/**
 * Subscribes to the workspace, user and team topics and keeps caches fresh.
 * Channels are bounded: one per topic, re-created only when the topic set changes.
 */
export function useRealtimeSync(options: {
  workspaceId: string;
  userId: string;
  teamIds: readonly string[];
  onError?: (error: unknown) => void;
}): void {
  const client = useDaiqClient();
  const queryClient = useQueryClient();
  const { workspaceId, userId } = options;
  const teamKey = [...options.teamIds].sort().join(',');
  // Latest callback without re-subscribing every channel when it changes identity.
  const reportError = useEffectEvent((error: unknown) => options.onError?.(error));

  useEffect(() => {
    const topics = [
      `workspace:${workspaceId}`,
      `user:${userId}`,
      ...teamKey
        .split(',')
        .filter(Boolean)
        .map((id) => `team:${id}`),
    ];
    const queue = new Map<string, ChangeEvent>();
    let timer: ReturnType<typeof setTimeout> | undefined;
    let disposed = false;

    const flush = () => {
      timer = undefined;
      const events = [...queue.values()];
      queue.clear();
      applyEvents(client, queryClient, workspaceId, events).catch(reportError);
    };

    // Data fetched (or restored from the persisted cache) before every channel
    // was listening may have missed events: refetch it once all are subscribed.
    const listeningSince = Date.now();
    const subscribed = new Set<string>();
    let caughtUp = false;

    const channels = topics.map((topic) => {
      let subscribedBefore = false;
      return client
        .channel(topic, { config: { private: true } })
        .on('broadcast', { event: 'change' }, ({ payload }) => {
          if (!isChangeEvent(payload)) return;
          queue.set(`${payload.entity}:${payload.id}`, payload);
          timer ??= setTimeout(flush, COALESCE_MS);
        })
        .subscribe((status) => {
          if (status !== REALTIME_SUBSCRIBE_STATES.SUBSCRIBED || disposed) return;
          // After a reconnect we may have missed events: refresh what is on screen.
          if (subscribedBefore) void queryClient.invalidateQueries();
          subscribedBefore = true;
          subscribed.add(topic);
          if (!caughtUp && subscribed.size === topics.length) {
            caughtUp = true;
            void queryClient.invalidateQueries({
              predicate: (query) => query.state.dataUpdatedAt < listeningSince,
            });
          }
        });
    });

    void client.realtime.setAuth();

    return () => {
      disposed = true;
      if (timer) clearTimeout(timer);
      for (const channel of channels) void client.removeChannel(channel);
    };
  }, [client, queryClient, workspaceId, userId, teamKey]);
}
