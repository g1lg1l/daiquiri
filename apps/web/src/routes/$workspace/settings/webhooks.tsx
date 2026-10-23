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
import { m } from '../../../i18n/settings';
import { timeAgo } from '../../../lib/time';

export const Route = createFileRoute('/$workspace/settings/webhooks')({ component: Webhooks });

const copy = (text: string, message: string) =>
  void navigator.clipboard.writeText(text).then(() => toast(message, { id: 'copy' }));

function Secret({ secret, onDone }: { secret: string | null; onDone: () => void }) {
  return (
    <Dialog open={secret !== null} onOpenChange={(open) => !open && onDone()}>
      <DialogContent>
        <DialogTitle>{m.settings.webhooks.secretTitle}</DialogTitle>
        <DialogDescription>{m.settings.webhooks.secretDescription}</DialogDescription>
        <div className="flex items-center gap-2">
          <code className="min-w-0 flex-1 truncate rounded-md bg-surface-muted px-2 py-1.5 text-xs">
            {secret}
          </code>
          <Button
            size="sm"
            onClick={() => secret && copy(secret, m.settings.webhooks.secretCopied)}
          >
            <CopyIcon /> {m.common.copy}
          </Button>
        </div>
        <DialogFooter>
          <Button variant="primary" onClick={onDone}>
            {m.common.done}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function Deliveries({ hook }: { hook: Webhook }) {
  const deliveries = useWebhookDeliveries(hook.id);
  if (!deliveries.data?.length) {
    return <p className="text-xs text-fg-subtle">{m.settings.webhooks.noDeliveries}</p>;
  }
  return (
    <ol className="flex max-h-72 flex-col gap-1 overflow-y-auto text-xs scrollbar-thin">
      {deliveries.data.map((d) => (
        <li key={d.id} className="flex items-start gap-2">
          {d.status === 'succeeded' ? (
            <CheckIcon
              aria-label={m.settings.webhooks.delivered}
              className="mt-0.5 size-3.5 shrink-0 text-accent-text"
            />
          ) : d.status === 'failed' ? (
            <XIcon
              aria-label={m.settings.webhooks.failed}
              className="mt-0.5 size-3.5 shrink-0 text-danger"
            />
          ) : (
            <span
              aria-label={m.settings.webhooks.waiting}
              className="mt-1 size-2.5 shrink-0 rounded-full border border-fg-subtle"
            />
          )}
          <span className="min-w-0 flex-1">
            <span className="font-medium">{d.event}</span>{' '}
            <span className="text-fg-muted">
              {d.status === 'succeeded'
                ? m.settings.webhooks.status.delivered(d.responseStatus ?? 200)
                : d.status === 'failed'
                  ? m.settings.webhooks.status.gaveUp(d.attempts)
                  : d.attempts > 0
                    ? m.settings.webhooks.status.retrying(d.attempts)
                    : m.settings.webhooks.status.queued}
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
  const urlProblem = url.trim() && !isSafeWebhookUrl(url) ? m.settings.webhooks.badUrl : null;

  if (!admin) {
    return (
      <section className="flex flex-col gap-2">
        <h2 className="text-lg font-semibold font-display">{m.settings.sections.webhooks}</h2>
        <p className="text-[13px] text-fg-muted">{m.settings.webhooks.adminsOnly}</p>
      </section>
    );
  }

  return (
    <section className="flex flex-col gap-4">
      <header className="flex flex-col gap-1">
        <h2 className="text-lg font-semibold font-display">{m.settings.sections.webhooks}</h2>
        <p className="text-[13px] text-fg-muted">{m.settings.webhooks.intro}</p>
        <details className="text-xs text-fg-muted">
          <summary className="cursor-pointer">{m.settings.webhooks.signature}</summary>
          <p className="mt-2">
            {m.settings.webhooks.signatureHelp((text) => (
              <code key={text}>{text}</code>
            ))}
          </p>
        </details>
      </header>

      {workspace.isDemo ? (
        <p className="rounded-lg border border-dashed border-border p-4 text-[13px] text-fg-subtle">
          {m.settings.webhooks.demo}
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
              <Label htmlFor="webhook-name">{m.settings.name}</Label>
              <Input
                id="webhook-name"
                value={name}
                required
                maxLength={80}
                placeholder={m.settings.webhooks.namePlaceholder}
                onChange={(event) => setName(event.target.value)}
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="webhook-url">{m.settings.webhooks.endpoint}</Label>
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
            <legend className="mb-1.5 text-[13px] font-medium">{m.settings.webhooks.events}</legend>
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
            {m.settings.webhooks.add}
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
                aria-label={m.settings.webhooks.sendTo(hook.name)}
                checked={hook.enabled}
                onChange={(event) =>
                  actions.update.mutate({ id: hook.id, patch: { enabled: event.target.checked } })
                }
                className="switch mt-1"
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
                      toast(m.settings.webhooks.testQueued);
                    },
                  })
                }
              >
                {m.settings.webhooks.sendTest}
              </Button>
              <Button
                size="sm"
                variant="ghost"
                aria-expanded={open === hook.id}
                onClick={() => setOpen(open === hook.id ? null : hook.id)}
              >
                {m.settings.webhooks.deliveries}
              </Button>
              <Button
                size="sm"
                variant="ghost"
                onClick={() => actions.rotate.mutate(hook.id, { onSuccess: setSecret })}
              >
                {m.settings.webhooks.newSecret}
              </Button>
              <Button
                size="icon-sm"
                variant="ghost"
                aria-label={m.settings.deleteNamed(hook.name)}
                onClick={() => setDeleting(hook)}
              >
                <Trash2Icon />
              </Button>
            </div>
            {open === hook.id && (
              <section aria-label={m.settings.webhooks.deliveriesTo(hook.name)} className="pl-7">
                <Deliveries hook={hook} />
              </section>
            )}
          </li>
        ))}
      </ul>

      <Secret secret={secret} onDone={() => setSecret(null)} />
      <Dialog open={deleting !== null} onOpenChange={(next) => !next && setDeleting(null)}>
        <DialogContent>
          <DialogTitle>{m.settings.deleteTitle(deleting?.name ?? '')}</DialogTitle>
          <DialogDescription>{m.settings.webhooks.deleteDescription}</DialogDescription>
          <DialogFooter>
            <Button onClick={() => setDeleting(null)}>{m.common.cancel}</Button>
            <Button
              variant="danger"
              onClick={() => {
                if (deleting) actions.remove.mutate(deleting.id);
                setDeleting(null);
              }}
            >
              {m.settings.webhooks.deleteConfirm}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </section>
  );
}
