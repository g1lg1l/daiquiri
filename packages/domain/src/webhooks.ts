export const WEBHOOK_EVENTS = [
  'task.created',
  'task.updated',
  'task.deleted',
  'comment.created',
] as const;
export type WebhookEvent = (typeof WEBHOOK_EVENTS)[number];

export const WEBHOOK_EVENT_LABEL: Record<WebhookEvent, string> = {
  'task.created': 'Task created',
  'task.updated': 'Task changed',
  'task.deleted': 'Task deleted',
  'comment.created': 'Comment added',
};

const INTERNAL_NAMES =
  /(^|\.)(localhost|local|localdomain|internal|intranet|lan|home|corp|test|invalid|example|arpa)$/;

/**
 * The same rule the database enforces (app.is_safe_webhook_url): https on
 * port 443 to a DNS name that is not an IP literal or an internal-only name.
 */
export function isSafeWebhookUrl(url: string): boolean {
  const lower = url.trim().toLowerCase();
  if (lower.length > 2000) return false;
  if (!/^https:\/\/[a-z0-9-]+(\.[a-z0-9-]+)+(:443)?(\/\S*)?$/.test(lower)) return false;
  const host = /^https:\/\/([^/:]+)/.exec(lower)?.[1] ?? '';
  return !/^[0-9.]+$/.test(host) && !INTERNAL_NAMES.test(host);
}

export interface Webhook {
  id: string;
  workspaceId: string;
  name: string;
  url: string;
  events: WebhookEvent[];
  enabled: boolean;
}

export interface WebhookDelivery {
  id: number;
  event: string;
  status: 'pending' | 'sending' | 'succeeded' | 'failed';
  attempts: number;
  responseStatus: number | null;
  error: string | null;
  createdAt: string;
}
