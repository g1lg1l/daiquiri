import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  WEBHOOK_EVENTS,
  type Webhook,
  type WebhookDelivery,
  type WebhookEvent,
} from '@daiq/domain';
import { z } from 'zod';
import { useDaiqClient } from './context';
import { ensureOk, unwrap } from './errors';
import { keys } from './keys';

const isEvent = (value: string): value is WebhookEvent => WEBHOOK_EVENTS.some((e) => e === value);
const STATUSES = ['pending', 'sending', 'succeeded', 'failed'] as const;
const isStatus = (value: string): value is WebhookDelivery['status'] =>
  STATUSES.some((s) => s === value);

/** Admins only (RLS returns nothing to anyone else). */
export function useWebhooks(workspaceId: string, enabled = true) {
  const client = useDaiqClient();
  return useQuery({
    queryKey: keys.webhooks(workspaceId),
    enabled,
    queryFn: async (): Promise<Webhook[]> =>
      unwrap(
        await client
          .from('webhooks')
          .select('id, workspace_id, name, url, events, enabled')
          .eq('workspace_id', workspaceId)
          .order('created_at'),
      ).map((row) => ({
        id: row.id,
        workspaceId: row.workspace_id,
        name: row.name,
        url: row.url,
        events: row.events.filter(isEvent),
        enabled: row.enabled,
      })),
  });
}

export function useWebhookDeliveries(webhookId: string | undefined) {
  const client = useDaiqClient();
  return useQuery({
    queryKey: keys.webhookDeliveries(webhookId ?? ''),
    enabled: Boolean(webhookId),
    // Deliveries move on their own (sent, retried): poll while the log is open.
    refetchInterval: 5000,
    queryFn: async (): Promise<WebhookDelivery[]> =>
      unwrap(
        await client
          .from('webhook_deliveries')
          .select('id, event, status, attempts, response_status, error, created_at')
          .eq('webhook_id', webhookId ?? '')
          .order('id', { ascending: false })
          .limit(50),
      ).flatMap((row) =>
        isStatus(row.status)
          ? [
              {
                id: row.id,
                event: row.event,
                status: row.status,
                attempts: row.attempts,
                responseStatus: row.response_status,
                error: row.error,
                createdAt: row.created_at,
              },
            ]
          : [],
      ),
  });
}

const created = z.object({ id: z.string(), secret: z.string() });

export function useWebhookActions(workspaceId: string) {
  const client = useDaiqClient();
  const queryClient = useQueryClient();
  const key = keys.webhooks(workspaceId);
  const refresh = () => queryClient.invalidateQueries({ queryKey: key });
  const create = useMutation({
    mutationFn: async (input: { name: string; url: string; events: WebhookEvent[] }) =>
      created.parse(
        unwrap(
          await client.rpc('create_webhook', {
            workspace_id: workspaceId,
            name: input.name,
            url: input.url,
            events: input.events,
          }),
        ),
      ),
    onSettled: refresh,
  });
  const update = useMutation({
    mutationFn: async ({
      id,
      patch,
    }: {
      id: string;
      patch: Partial<Pick<Webhook, 'name' | 'url' | 'events' | 'enabled'>>;
    }) => ensureOk(await client.from('webhooks').update(patch).eq('id', id)),
    onMutate: ({ id, patch }) =>
      queryClient.setQueryData<Webhook[]>(key, (list = []) =>
        list.map((hook) => (hook.id === id ? { ...hook, ...patch } : hook)),
      ),
    onSettled: refresh,
  });
  const remove = useMutation({
    mutationFn: async (id: string) => ensureOk(await client.from('webhooks').delete().eq('id', id)),
    onMutate: (id) =>
      queryClient.setQueryData<Webhook[]>(key, (list = []) => list.filter((h) => h.id !== id)),
    onSettled: refresh,
  });
  const rotate = useMutation({
    mutationFn: async (id: string): Promise<string> =>
      z.string().parse(unwrap(await client.rpc('rotate_webhook_secret', { webhook_id: id }))),
  });
  const ping = useMutation({
    mutationFn: async (id: string) =>
      ensureOk(await client.rpc('ping_webhook', { webhook_id: id })),
    onSettled: (_data, _error, id) =>
      queryClient.invalidateQueries({ queryKey: keys.webhookDeliveries(id) }),
  });
  return { create, update, remove, rotate, ping };
}
