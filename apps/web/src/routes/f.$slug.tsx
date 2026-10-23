import { toDaiqError, usePublicForm, useSubmitForm } from '@daiq/data';
import { PRIORITY_LABEL, isPriority, type CustomField } from '@daiq/domain';
import { Button, FieldError, Input, Label, Select, Skeleton, Textarea } from '@daiq/ui';
import { createFileRoute } from '@tanstack/react-router';
import { CheckCircle2Icon } from 'lucide-react';
import { useState } from 'react';
import { Wordmark } from '../components/wordmark';
import { DateField } from '../features/tasks/task-actions';

import { formString } from '../lib/forms';

/** A team's intake form, open to anyone for public forms (feature spec §13). */
export const Route = createFileRoute('/f/$slug')({ component: IntakeForm });

const PRIORITY_CHOICES = [1, 2, 3, 4, 0] as const;

/** A custom field's answer, typed for the database; undefined when left empty. */
function fieldValue(field: CustomField, form: FormData): unknown {
  const raw = formString(form, `field-${field.id}`).trim();
  switch (field.kind) {
    case 'checkbox':
      return form.get(`field-${field.id}`) === 'on' ? true : undefined;
    case 'multi_select': {
      const ids = form
        .getAll(`field-${field.id}`)
        .filter((v): v is string => typeof v === 'string');
      return ids.length ? ids : undefined;
    }
    case 'number':
      return raw === '' ? undefined : Number(raw);
    case 'text':
    case 'url':
    case 'date':
    case 'select':
    case 'person':
      return raw || undefined;
    default:
      return field.kind satisfies never;
  }
}

function DateInput({ name, label }: { name: string; label: string }) {
  const [date, setDate] = useState<string | null>(null);
  return (
    <>
      <DateField label={label} value={date} onChange={setDate} variant="secondary" />
      <input type="hidden" name={name} value={date ?? ''} />
    </>
  );
}

function FieldInput({ field }: { field: CustomField }) {
  const id = `field-${field.id}`;
  switch (field.kind) {
    case 'checkbox':
      return (
        <label className="flex items-center gap-2 text-[13px]">
          <input type="checkbox" name={id} className="accent-(--accent)" /> {field.name}
        </label>
      );
    case 'multi_select':
      return (
        <fieldset className="flex flex-col gap-1.5">
          <legend className="mb-1 text-[13px] font-medium">{field.name}</legend>
          {field.options.map((option) => (
            <label key={option.id} className="flex items-center gap-2 text-[13px]">
              <input type="checkbox" name={id} value={option.id} className="accent-(--accent)" />
              {option.name}
            </label>
          ))}
        </fieldset>
      );
    case 'select':
      return (
        <div className="flex flex-col gap-1.5">
          <Label htmlFor={id}>{field.name}</Label>
          <Select
            id={id}
            name={id}
            defaultValue={null}
            placeholder="Choose…"
            options={field.options.map((option) => ({ value: option.id, label: option.name }))}
          />
        </div>
      );
    case 'date':
      return (
        <div className="flex flex-col gap-1.5">
          <span className="text-[13px] font-medium">{field.name}</span>
          <DateInput name={id} label={field.name} />
        </div>
      );
    case 'number':
    case 'url':
    case 'text':
    case 'person':
      return (
        <div className="flex flex-col gap-1.5">
          <Label htmlFor={id}>{field.name}</Label>
          <Input
            id={id}
            name={id}
            type={field.kind === 'number' ? 'number' : field.kind === 'url' ? 'url' : 'text'}
            {...(field.kind === 'number' && { step: 'any' })}
          />
        </div>
      );
    default:
      return field.kind satisfies never;
  }
}

function IntakeForm() {
  const { slug } = Route.useParams();
  const form = usePublicForm(slug);
  const submit = useSubmitForm();
  const [reference, setReference] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const data = form.data;

  return (
    <div className="min-h-dvh bg-surface">
      <main className="mx-auto flex max-w-lg flex-col gap-6 px-6 py-12">
        {form.isPending ? (
          <Skeleton className="h-64" />
        ) : !data ? (
          <section className="flex flex-col gap-2">
            <h1 className="text-xl font-semibold font-display">This form isn’t available</h1>
            <p className="text-[13px] text-fg-muted">
              The link may be wrong, the form may be closed, or it may only be open to members of
              its workspace. If you are a member, sign in and open the link again.
            </p>
          </section>
        ) : reference !== null ? (
          <section className="flex flex-col items-start gap-3" aria-live="polite">
            <CheckCircle2Icon aria-hidden className="size-8 text-accent-text" />
            <h1 className="text-xl font-semibold font-display">Thanks, we have it</h1>
            <p className="text-[13px] text-fg-muted">
              {data.team} at {data.workspace} will look at it
              {reference ? `. Your reference is ${reference}.` : '.'}
            </p>
            <Button
              onClick={() => {
                setReference(null);
                submit.reset();
              }}
            >
              Send another
            </Button>
          </section>
        ) : (
          <>
            <header className="flex flex-col gap-1">
              <p className="text-xs text-fg-subtle">
                {data.workspace}, {data.team}
              </p>
              <h1 className="text-2xl font-semibold font-display">{data.name}</h1>
              {data.description && (
                <p className="text-[13px] whitespace-pre-line text-fg-muted">{data.description}</p>
              )}
            </header>
            <form
              className="flex flex-col gap-4"
              onSubmit={(event) => {
                event.preventDefault();
                setError(null);
                const values = new FormData(event.currentTarget);
                const priority = Number(formString(values, 'priority') || 0);
                submit.mutate(
                  {
                    slug,
                    title: formString(values, 'title'),
                    details: formString(values, 'details'),
                    email: formString(values, 'email'),
                    priority,
                    fields: Object.fromEntries(
                      data.fields.flatMap((field) => {
                        const value = fieldValue(field, values);
                        return value === undefined ? [] : [[field.id, value]];
                      }),
                    ),
                    website: formString(values, 'website'),
                  },
                  {
                    onSuccess: (identifier) => setReference(identifier ?? ''),
                    onError: (e) => setError(toDaiqError(e).message),
                  },
                );
              }}
            >
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="title">Subject</Label>
                <Input id="title" name="title" required maxLength={200} autoFocus />
              </div>
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="details">Details</Label>
                <Textarea id="details" name="details" rows={5} maxLength={5000} />
              </div>
              {data.askPriority && (
                <div className="flex flex-col gap-1.5">
                  <Label htmlFor="priority">How urgent is it?</Label>
                  <Select
                    id="priority"
                    name="priority"
                    defaultValue="0"
                    options={PRIORITY_CHOICES.map((p) => ({
                      value: String(p),
                      label: isPriority(p) ? PRIORITY_LABEL[p] : String(p),
                    }))}
                  />
                </div>
              )}
              {data.fields.map((field) => (
                <FieldInput key={field.id} field={field} />
              ))}
              {!data.signedIn && (
                <div className="flex flex-col gap-1.5">
                  <Label htmlFor="email">Your email</Label>
                  <Input id="email" name="email" type="email" required maxLength={254} />
                  <p className="text-xs text-fg-subtle">
                    So the team can get back to you. Only they will see it.
                  </p>
                </div>
              )}
              {/* Bots fill in every field; people never see this one. */}
              <div aria-hidden className="absolute -left-[9999px]">
                <label>
                  Website
                  <input name="website" tabIndex={-1} autoComplete="off" />
                </label>
              </div>
              {error && <FieldError>{error}</FieldError>}
              <Button type="submit" variant="primary" disabled={submit.isPending}>
                Send
              </Button>
            </form>
          </>
        )}
        <footer className="mt-auto pt-6 text-xs text-fg-subtle">
          <Wordmark />
        </footer>
      </main>
    </div>
  );
}
