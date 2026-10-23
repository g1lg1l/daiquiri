import { useCreateWorkspace } from '@daiq/data';
import { slugify, suggestTeamKey, teamKeySchema, workspaceSlugSchema } from '@daiq/domain';
import { Button, cn, FieldError, Input, Label } from '@daiq/ui';
import { createFileRoute, redirect, useNavigate } from '@tanstack/react-router';
import { useState } from 'react';
import { AuthLayout } from '../features/auth/auth-layout';
import { useSubmit } from '../features/auth/use-form-error';
import { requireAuth } from '../app/router-context';
import { m } from '../i18n/auth';

export const Route = createFileRoute('/onboarding')({
  beforeLoad: (options) => {
    const { auth } = requireAuth(options);
    if (auth.isAnonymous) throw redirect({ to: '/signup' });
  },
  component: Onboarding,
});

// The statuses each template creates, named as the database names them.
const TEMPLATES = [
  { id: 'software', workflow: ['Backlog', 'Todo', 'In Progress', 'In Review', 'Done'] },
  { id: 'marketing', workflow: ['Ideas', 'Planned', 'In Progress', 'Review', 'Published'] },
  { id: 'operations', workflow: ['Backlog', 'To Do', 'Doing', 'Waiting', 'Done'] },
  { id: 'generic', workflow: ['Backlog', 'Todo', 'In Progress', 'Done'] },
] as const;

type TemplateId = (typeof TEMPLATES)[number]['id'];

function Onboarding() {
  const navigate = useNavigate();
  const createWorkspace = useCreateWorkspace();
  const { pending, error, run } = useSubmit();
  const [name, setName] = useState('');
  const [slug, setSlug] = useState('');
  const [slugEdited, setSlugEdited] = useState(false);
  const [template, setTemplate] = useState<TemplateId>('software');
  const [teamName, setTeamName] = useState<string>(m.auth.onboarding.teams[template]);
  const effectiveSlug = slugEdited ? slug : slugify(name);
  const teamKey = suggestTeamKey(teamName);
  const slugError = effectiveSlug && !workspaceSlugSchema.safeParse(effectiveSlug).success;

  const onSubmit = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    void run(async () => {
      const workspace = await createWorkspace.mutateAsync({
        name: name.trim(),
        slug: effectiveSlug,
        teamName: teamName.trim(),
        teamKey: teamKeySchema.safeParse(teamKey).success ? teamKey : 'GEN',
        template,
      });
      await navigate({
        to: '/$workspace/team/$teamKey/tasks',
        params: { workspace: workspace.slug, teamKey },
      });
    });
  };

  return (
    <AuthLayout title={m.auth.onboarding.title}>
      <form className="flex flex-col gap-5" onSubmit={onSubmit}>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="ws-name">{m.auth.onboarding.name}</Label>
          <Input
            id="ws-name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder={m.auth.onboarding.namePlaceholder}
            required
            maxLength={80}
            autoFocus
          />
        </div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="ws-slug">{m.auth.onboarding.address}</Label>
          <div className="flex items-center rounded-md border border-border bg-surface-subtle pl-2.5 text-[13px] text-fg-subtle focus-within:border-focus">
            <span className="shrink-0">daiq/</span>
            <Input
              id="ws-slug"
              className="border-0 bg-transparent pl-0.5 shadow-none focus-visible:ring-0"
              value={effectiveSlug}
              onChange={(e) => {
                setSlugEdited(true);
                setSlug(e.target.value.toLowerCase());
              }}
              aria-invalid={slugError || undefined}
              required
            />
          </div>
          {slugError && <FieldError>{m.auth.onboarding.slugError}</FieldError>}
        </div>

        <fieldset className="flex flex-col gap-2">
          <legend className="mb-1.5 text-[13px] font-medium">
            {m.auth.onboarding.howTeamWorks}
          </legend>
          <div className="grid grid-cols-2 gap-2">
            {TEMPLATES.map((t) => (
              <label
                key={t.id}
                className={cn(
                  'flex cursor-pointer flex-col gap-1 rounded-lg border border-border p-3 transition-colors hover:bg-surface-subtle has-checked:border-accent has-checked:bg-accent-subtle/60 has-focus-visible:outline-2 has-focus-visible:outline-focus',
                )}
              >
                <input
                  type="radio"
                  name="template"
                  value={t.id}
                  checked={template === t.id}
                  onChange={() => {
                    setTemplate(t.id);
                    setTeamName(m.auth.onboarding.teams[t.id]);
                  }}
                  className="sr-only"
                />
                <span className="text-[13px] font-medium">{m.auth.onboarding.teams[t.id]}</span>
                <span className="text-xs leading-snug text-fg-muted">{t.workflow.join(' → ')}</span>
              </label>
            ))}
          </div>
        </fieldset>

        <div className="flex flex-col gap-1.5">
          <Label htmlFor="team-name">{m.auth.onboarding.firstTeam}</Label>
          <Input
            id="team-name"
            value={teamName}
            onChange={(e) => setTeamName(e.target.value)}
            required
            maxLength={60}
          />
          <p className="text-xs text-fg-subtle">
            {m.auth.onboarding.numbered}{' '}
            <span className="font-medium text-fg-muted tabular">{teamKey}-1</span>,{' '}
            <span className="font-medium text-fg-muted tabular">{teamKey}-2</span>…
          </p>
        </div>

        {error && <FieldError>{error}</FieldError>}
        <Button
          type="submit"
          variant="primary"
          size="lg"
          disabled={pending || !name.trim() || Boolean(slugError)}
        >
          {m.auth.onboarding.submit}
        </Button>
      </form>
    </AuthLayout>
  );
}
