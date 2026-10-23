import { useWebhookActions, useWebhookDeliveries, useWebhooks } from '@daiq/data';
import {
  can,
  isSafeWebhookUrl,
  WEBHOOK_EVENT_LABEL,
  WEBHOOK_EVENTS,
  type Webhook,
  type WebhookEvent,
} from '@daiq/domain';
import {
  Button,
  cn,
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogTitle,
  FieldError,
  Input,
  Label,
  toast,
} from '@daiq/ui';
import { createFileRoute } from '@tanstack/react-router';
import { CheckIcon, CopyIcon, Trash2Icon, XIcon } from 'lucide-react';
import { useState } from 'react';
import { useWorkspace } from '../../../features/workspace/workspace-context';
import { timeAgo } from '../../../lib/time';

export const Route = createFileRoute('/$workspace/settings/webhooks')({ component: Webhooks });

const copy = (text: string, what: string) =>
  void navigator.clipboard.writeText(text).then(() => toast(`${what} copied`, { id: 'copy' }));

function Secret({ secret, onDone }: { secret: string | null; onDone: () => void }) {
  return (
    <Dialog open={secret !== null} onOpenChange={(open) => !open && onDone()}>
      <DialogContent>
        <DialogTitle>Signing secret</DialogTitle>
        <DialogDescription>
          Copy it now: it is shown only once. Your endpoint uses it to check that requests come from
          Daiquiri.
        </DialogDescription>
        <div className="flex items-center gap-2">
          <code className="min-w-0 flex-1 truncate rounded-md bg-surface-muted px-2 py-1.5 text-xs">
            {secret}
          </code>
          <Button size="sm" onClick={() => secret && copy(secret, 'Secret')}>
            <CopyIcon /> Copy
          </Button>
        </div>
        <DialogFooter>
          <Button variant="primary" onClick={onDone}>
            Done
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function Deliveries({ hook }: { hook: Webhook }) {
  const deliveries = useWebhookDeliveries(hook.id);
  if (!deliveries.data?.length) {
    return <p className="text-xs text-fg-subtle">No deliveries yet. Send a test to try it.</p>;
  }
  return (
    <ol className="flex max-h-72 flex-col gap-1 overflow-y-auto text-xs scrollbar-thin">
      {deliveries.data.map((d) => (
        <li key={d.id} className="flex items-start gap-2">
          {d.status === 'succeeded' ? (
            <CheckIcon
              aria-label="Delivered"
              className="mt-0.5 size-3.5 shrink-0 text-accent-text"
            />
          ) : d.status === 'failed' ? (
            <XIcon aria-label="Failed" className="mt-0.5 size-3.5 shrink-0 text-danger" />
          ) : (
            <span
              aria-label="Waiting"
              className="mt-1 size-2.5 shrink-0 rounded-full border border-fg-subtle"
            />
          )}
          <span className="min-w-0 flex-1">
            <span className="font-medium">{d.event}</span>{' '}
            <span className="text-fg-muted">
              {d.status === 'succeeded'
                ? `delivered (HTTP ${d.responseStatus ?? 200})`
                : d.status === 'failed'
                  ? `gave up after ${d.attempts} attempts`
                  : d.attempts > 0
                    ? `retrying (attempt ${d.attempts} of 6)`
                    : 'queued'}
            </span>
            {d.error && <span className="block text-danger">{d.error}</span>}
          </span>
          <time dateTime={d.createdAt} className="shrink-0 text-fg-subtle">
            {timeAgo(d.createdAt)}
          </time>
        </li>
      ))}
    </ol>
  );
}

function Webhooks() {
  const { workspace } = useWorkspace();
  const admin = can(workspace.role, 'workspace.update');
  const hooks = useWebhooks(workspace.id, admin);
  const actions = useWebhookActions(workspace.id);
  const [name, setName] = useState('');
  const [url, setUrl] = useState('');
  const [events, setEvents] = useState<WebhookEvent[]>(['task.created', 'task.updated']);
  const [error, setError] = useState<string | null>(null);
  const [secret, setSecret] = useState<string | null>(null);
  const [open, setOpen] = useState<string | null>(null);
  const [deleting, setDeleting] = useState<Webhook | null>(null);
  const urlProblem =
    url.trim() && !isSafeWebhookUrl(url)
      ? 'Use an https address with a public host name, on the standard port (443).'
      : null;

  if (!admin) {
    return (
      <section className="flex flex-col gap-2">
        <h2 className="text-lg font-semibold font-display">Webhooks</h2>
        <p className="text-[13px] text-fg-muted">Only admins manage webhooks.</p>
      </section>
    );
  }

  return (
    <section className="flex flex-col gap-4">
      <header className="flex flex-col gap-1">
        <h2 className="text-lg font-semibold font-display">Webhooks</h2>
        <p className="text-[13px] text-fg-muted">
          Daiquiri posts JSON to your endpoint when tasks or comments change, from every team.
          Failed deliveries are retried six times, waiting longer each time.
        </p>
        <details className="text-xs text-fg-muted">
          <summary className="cursor-pointer">Checking the signature</summary>
          <p className="mt-2">
            Each request has a <code>Daiquiri-Signature: t=…,v1=…</code> header. Compute HMAC-SHA256
            of <code>t + "." + raw body</code> with your secret and compare it with <code>v1</code>;
            reject requests whose <code>t</code> is more than five minutes old.
          </p>
        </details>
      </header>

      {workspace.isDemo ? (
        <p className="rounded-lg border border-dashed border-border p-4 text-[13px] text-fg-subtle">
          Webhooks are turned off in the demo, so it cannot send requests to other sites.
        </p>
      ) : (
        <form
          className="flex flex-col gap-3 rounded-lg border border-border p-3"
          onSubmit={(event) => {
            event.preventDefault();
            setError(null);
            if (urlProblem || events.length === 0) return;
            actions.create.mutate(
              { name: name.trim(), url: url.trim(), events },
              {
                onSuccess: (result) => {
                  setSecret(result.secret);
                  setName('');
                  setUrl('');
                },
                onError: (e) => setError(e.message),
              },
            );
          }}
        >
          <div className="grid gap-3 sm:grid-cols-[1fr_2fr]">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="webhook-name">Name</Label>
              <Input
                id="webhook-name"
                value={name}
                required
                maxLength={80}
                placeholder="Deploy bot"
                onChange={(event) => setName(event.target.value)}
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="webhook-url">Endpoint URL</Label>
              <Input
                id="webhook-url"
                value={url}
                required
                inputMode="url"
                placeholder="https://hooks.example.com/daiquiri"
                aria-invalid={Boolean(urlProblem)}
                onChange={(event) => setUrl(event.target.value)}
              />
            </div>
          </div>
          {urlProblem && <FieldError>{urlProblem}</FieldError>}
          <fieldset className="flex flex-wrap gap-x-4 gap-y-1.5">
            <legend className="mb-1.5 text-[13px] font-medium">Events</legend>
            {WEBHOOK_EVENTS.map((event) => (
              <label key={event} className="flex items-center gap-2 text-[13px]">
                <input
                  type="checkbox"
                  checked={events.includes(event)}
                  onChange={(e) =>
                    setEvents(
                      e.target.checked ? [...events, event] : events.filter((x) => x !== event),
                    )
                  }
                  className="accent-(--accent)"
                />
                {WEBHOOK_EVENT_LABEL[event]}
              </label>
            ))}
          </fieldset>
          {error && <FieldError>{error}</FieldError>}
          <Button
            type="submit"
            variant="primary"
            className="self-start"
            disabled={Boolean(urlProblem) || events.length === 0 || actions.create.isPending}
          >
            Add webhook
          </Button>
        </form>
      )}

      <ul className="flex flex-col gap-3">
        {hooks.data?.map((hook) => (
          <li
            key={hook.id}
            aria-label={hook.name}
            className="flex flex-col gap-2 rounded-lg border border-border p-3"
          >
            <div className="flex items-start gap-3">
              <input
                type="checkbox"
                role="switch"
                aria-checked={hook.enabled}
                aria-label={`Send to ${hook.name}`}
                checked={hook.enabled}
                onChange={(event) =>
                  actions.update.mutate({ id: hook.id, patch: { enabled: event.target.checked } })
                }
                className="mt-1 accent-(--accent)"
              />
              <div className="min-w-0 flex-1">
                <p className={cn('text-[13px] font-medium', !hook.enabled && 'text-fg-muted')}>
                  {hook.name}
                </p>
                <code className="block truncate text-xs text-fg-subtle">{hook.url}</code>
                <p className="text-xs text-fg-muted">
                  {hook.events.map((e) => WEBHOOK_EVENT_LABEL[e]).join(', ')}
                </p>
              </div>
              <Button
                size="sm"
                variant="ghost"
                onClick={() =>
                  actions.ping.mutate(hook.id, {
                    onSuccess: () => {
                      setOpen(hook.id);
                      toast('Test queued');
                    },
                  })
                }
              >
                Send test
              </Button>
              <Button
                size="sm"
                variant="ghost"
                aria-expanded={open === hook.id}
                onClick={() => setOpen(open === hook.id ? null : hook.id)}
              >
                Deliveries
              </Button>
              <Button
                size="sm"
                variant="ghost"
                onClick={() => actions.rotate.mutate(hook.id, { onSuccess: setSecret })}
              >
                New secret
              </Button>
              <Button
                size="icon-sm"
                variant="ghost"
                aria-label={`Delete ${hook.name}`}
                onClick={() => setDeleting(hook)}
              >
                <Trash2Icon />
              </Button>
            </div>
            {open === hook.id && (
              <section aria-label={`Deliveries to ${hook.name}`} className="pl-7">
                <Deliveries hook={hook} />
              </section>
            )}
          </li>
        ))}
      </ul>

      <Secret secret={secret} onDone={() => setSecret(null)} />
      <Dialog open={deleting !== null} onOpenChange={(next) => !next && setDeleting(null)}>
        <DialogContent>
          <DialogTitle>Delete {deleting?.name}?</DialogTitle>
          <DialogDescription>
            Deliveries stop, its log and secret are deleted, and automations that call it fail.
          </DialogDescription>
          <DialogFooter>
            <Button onClick={() => setDeleting(null)}>Cancel</Button>
            <Button
              variant="danger"
              onClick={() => {
                if (deleting) actions.remove.mutate(deleting.id);
                setDeleting(null);
              }}
            >
              Delete webhook
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </section>
  );
}
