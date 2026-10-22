import { REALTIME_SUBSCRIBE_STATES } from '@supabase/supabase-js';
import { useQueryClient, type QueryClient } from '@tanstack/react-query';
import { useEffect, useEffectEvent } from 'react';
import type { DaiqClient } from './client';
import { pendingWrites, removeTasks } from './cache';
import { useDaiqClient } from './context';
import { unwrapMaybe } from './errors';
import { keys } from './keys';
import { refreshTask } from './tasks';

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

function hasId(data: unknown, id: string): boolean {
  return typeof data === 'object' && data !== null && 'id' in data && data.id === id;
}

async function applyEvent(
  client: DaiqClient,
  queryClient: QueryClient,
  workspaceId: string,
  event: ChangeEvent,
): Promise<void> {
  switch (event.entity) {
    case 'task':
      if (pendingWrites.has(event.id)) return;
      if (event.op === 'delete') removeTasks(queryClient, new Set([event.id]));
      else await refreshTask(client, queryClient, event.id);
      await Promise.all([
        queryClient.invalidateQueries({
          queryKey: keys.allTaskDetails(),
          predicate: (query) => hasId(query.state.data, event.id),
        }),
        queryClient.invalidateQueries({ queryKey: keys.activity(event.id) }),
        queryClient.invalidateQueries({ queryKey: ['relations'] }),
      ]);
      return;
    case 'comment': {
      const row = unwrapMaybe(
        await client.from('comments').select('task_id').eq('id', event.id).maybeSingle(),
      );
      if (row) {
        await Promise.all([
          queryClient.invalidateQueries({ queryKey: keys.comments(row.task_id) }),
          queryClient.invalidateQueries({ queryKey: keys.activity(row.task_id) }),
        ]);
      }
      return;
    }
    case 'project':
      await queryClient.invalidateQueries({ queryKey: keys.projects(workspaceId) });
      return;
    case 'label':
      await queryClient.invalidateQueries({ queryKey: keys.labels(workspaceId) });
      return;
    case 'team':
    case 'status':
      await queryClient.invalidateQueries({ queryKey: keys.teams(workspaceId) });
      return;
    case 'workspace_member':
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: keys.members(workspaceId) }),
        queryClient.invalidateQueries({ queryKey: keys.teams(workspaceId) }),
        queryClient.invalidateQueries({ queryKey: keys.workspaces() }),
      ]);
      return;
    case 'notification':
      await queryClient.invalidateQueries({ queryKey: keys.notifications(workspaceId) });
      return;
    default:
      return;
  }
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
      for (const event of events) {
        applyEvent(client, queryClient, workspaceId, event).catch(reportError);
      }
    };

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
