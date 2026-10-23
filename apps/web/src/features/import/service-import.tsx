import {
  useCreateLabel,
  useCreateProject,
  useImportComments,
  useImportTasks,
  useMemberEmails,
  useTasks,
  type ImportRow,
} from '@daiq/data';
import {
  can,
  commentHeading,
  defaultStatusFor,
  orderForImport,
  sortKeysBetween,
  textToDocument,
  type ExternalTask,
  type RichDocument,
  type Team,
} from '@daiq/domain';
import { Button, FieldError, Input, Label, Select } from '@daiq/ui';
import { Link } from '@tanstack/react-router';
import { ExternalLinkIcon } from 'lucide-react';
import { useMemo, useState } from 'react';
import { m } from '../../i18n/importer';
import { newId } from '../../lib/ids';
import { useWorkspace, useWorkspaceData } from '../workspace/workspace-context';
import type { Scope, Source } from './sources';

const DEFAULT = '';
const statusKey = (task: Pick<ExternalTask, 'status' | 'category'>) =>
  `${task.status ?? ''}\u0000${task.category ?? ''}`;

/** The source's estimate in the team's scale, as a whole number. */
const estimateFor = (task: ExternalTask, scale: Team['estimateScale']) => {
  const value = scale === 'hours' ? task.estimateHours : task.estimatePoints;
  return value === null ? null : Math.min(999, Math.max(0, Math.round(value)));
};

type Step =
  | { kind: 'token' }
  | { kind: 'scope'; scopes: Scope[] }
  | { kind: 'review'; scope: Scope; tasks: ExternalTask[] }
  | { kind: 'done'; tasks: number; comments: number };

/** Import a Linear team, an Asana project or a ClickUp list into a Daiquiri team. */
export function ServiceImport({ source, team }: { source: Source; team: Team }) {
  const { workspace } = useWorkspace();
  const data = useWorkspaceData();
  const admin = can(workspace.role, 'workspace.update');
  const emails = useMemberEmails(workspace.id, admin).data;
  const existing = useTasks({ kind: 'team', id: team.id });
  const importTasks = useImportTasks(team.id);
  const importComments = useImportComments(workspace.id);
  const createLabel = useCreateLabel(workspace.id);
  const createProject = useCreateProject(workspace.id);

  const [step, setStep] = useState<Step>({ kind: 'token' });
  const [token, setToken] = useState('');
  const [scopeId, setScopeId] = useState('');
  const [comments, setComments] = useState(true);
  const [createLabels, setCreateLabels] = useState(true);
  const [createProjects, setCreateProjects] = useState(true);
  const [statusMap, setStatusMap] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState<string | null>(null);
  const [progress, setProgress] = useState<{ done: number; total: number } | null>(null);
  const [error, setError] = useState<string | null>(null);

  const run = async (label: string, work: () => Promise<void>) => {
    setError(null);
    setBusy(label);
    try {
      await work();
    } catch (e) {
      setError(e instanceof Error ? e.message : m.importer.service.unreadable(source.name));
    } finally {
      setBusy(null);
      setProgress(null);
    }
  };

  // People: by email when the workspace's emails are visible (admins), else by name.
  const memberFor = useMemo(() => {
    const byEmail = new Map(
      [...(emails ?? new Map<string, string>())].map(([id, email]) => [email.toLowerCase(), id]),
    );
    const byName = new Map(
      data.members.map((member) => [member.displayName.trim().toLowerCase(), member.id]),
    );
    return (person: { name: string; email: string | null }) =>
      (person.email ? byEmail.get(person.email.toLowerCase()) : undefined) ??
      byName.get(person.name.trim().toLowerCase());
  }, [emails, data.members]);

  const review = useMemo(() => {
    if (step.kind !== 'review') return null;
    const statuses = new Map<
      string,
      { status: string | null; category: ExternalTask['category']; count: number }
    >();
    for (const task of step.tasks) {
      const key = statusKey(task);
      const entry = statuses.get(key) ?? { status: task.status, category: task.category, count: 0 };
      entry.count += 1;
      statuses.set(key, entry);
    }
    const knownLabels = new Set(data.labels.map((l) => l.name.toLowerCase()));
    const teamProjects = new Set(
      data.projects.filter((p) => p.teamId === team.id).map((p) => p.name.toLowerCase()),
    );
    const people = new Map<string, boolean>();
    for (const task of step.tasks)
      for (const a of task.assignees) people.set(a.name, Boolean(memberFor(a)));
    return {
      statuses: [...statuses.entries()],
      subtasks: step.tasks.filter((t) => t.parentId).length,
      comments: step.tasks.reduce((sum, t) => sum + t.comments.length, 0),
      missingLabels: [...new Set(step.tasks.flatMap((t) => t.labels))].filter(
        (n) => !knownLabels.has(n.toLowerCase()),
      ),
      missingProjects: [
        ...new Set(step.tasks.flatMap((t) => (t.project ? [t.project] : []))),
      ].filter((n) => !teamProjects.has(n.toLowerCase())),
      unmatched: [...people.entries()].filter(([, matched]) => !matched).map(([name]) => name),
    };
  }, [step, data.labels, data.projects, team, memberFor]);

  const importAll = (tasks: ExternalTask[]) =>
    run(m.importer.service.importingBusy, async () => {
      const { markdownToDocument } = await import('@daiq/editor');
      const toDocument = (text: string, markdown: boolean): RichDocument | null =>
        !text.trim() ? null : markdown ? markdownToDocument(text) : textToDocument(text);

      // Labels and projects that do not exist yet.
      const labelIds = new Map(data.labels.map((l) => [l.name.toLowerCase(), l.id]));
      if (createLabels) {
        for (const name of review?.missingLabels ?? []) {
          // oxlint-disable-next-line no-await-in-loop
          const label = await createLabel.mutateAsync({
            id: newId(),
            name: name.slice(0, 40),
            color: 'gray',
          });
          labelIds.set(name.toLowerCase(), label.id);
        }
      }
      const projectIds = new Map(
        data.projects.filter((p) => p.teamId === team.id).map((p) => [p.name.toLowerCase(), p.id]),
      );
      if (createProjects) {
        for (const name of review?.missingProjects ?? []) {
          // oxlint-disable-next-line no-await-in-loop
          const project = await createProject.mutateAsync({
            id: newId(),
            teamId: team.id,
            name: name.slice(0, 120),
          });
          projectIds.set(name.toLowerCase(), project.id);
        }
      }

      const ids = new Map(tasks.map((t) => [t.sourceId, newId()]));
      const first = existing.data?.reduce<string | null>(
        (min, task) => (min === null || task.sortKey < min ? task.sortKey : min),
        null,
      );
      const keys = sortKeysBetween(null, first ?? null, tasks.length);
      const rows: ImportRow[] = tasks.map((task, index) => ({
        id: ids.get(task.sourceId) ?? newId(),
        parentId: task.parentId ? (ids.get(task.parentId) ?? null) : null,
        title: task.title.trim().slice(0, 200) || m.importer.service.untitled,
        description: toDocument(
          task.description.slice(0, 50_000),
          task.descriptionFormat === 'markdown',
        ),
        statusId: statusMap[statusKey(task)] || null,
        priority: task.priority,
        projectId: task.project ? (projectIds.get(task.project.toLowerCase()) ?? null) : null,
        dueDate: task.dueDate,
        startDate: task.startDate,
        estimate: estimateFor(task, team.estimateScale),
        sortKey: keys[index] ?? '',
        assigneeIds: [...new Set(task.assignees.flatMap((a) => memberFor(a) ?? []))],
        labelIds: [...new Set(task.labels.flatMap((n) => labelIds.get(n.toLowerCase()) ?? []))],
      }));
      setProgress({ done: 0, total: rows.length });
      await importTasks.mutateAsync({
        rows,
        onProgress: (done) => setProgress({ done, total: rows.length }),
      });

      const toPost = tasks.flatMap((task) =>
        task.comments.flatMap((comment) => {
          const body = toDocument(
            `${commentHeading(comment, source.name)}\n\n${comment.text}`,
            source.id === 'linear',
          );
          const taskId = ids.get(task.sourceId);
          return body && taskId ? [{ taskId, body }] : [];
        }),
      );
      if (toPost.length) {
        setBusy(m.importer.service.addingComments);
        setProgress({ done: 0, total: toPost.length });
        await importComments.mutateAsync({
          comments: toPost,
          onProgress: (done) => setProgress({ done, total: toPost.length }),
        });
      }
      setStep({ kind: 'done', tasks: rows.length, comments: toPost.length });
    });

  if (step.kind === 'done') {
    return (
      <section className="flex flex-col items-start gap-3" aria-live="polite">
        <h2 className="text-lg font-semibold font-display">
          {m.importer.imported(step.tasks)}
          {step.comments > 0 && m.importer.service.andComments(step.comments)}
        </h2>
        <Link
          to="/$workspace/team/$teamKey/tasks"
          params={{ workspace: workspace.slug, teamKey: team.key }}
          className="text-[13px] text-accent-text underline-offset-4 hover:underline"
        >
          {m.importer.openTasks(team.name)}
        </Link>
      </section>
    );
  }

  // The select has no option groups, so name the group when there are several.
  const grouped = step.kind === 'scope' && new Set(step.scopes.map((s) => s.group)).size > 1;

  return (
    <div className="flex flex-col gap-4">
      {step.kind === 'token' && (
        <form
          className="flex flex-col gap-3"
          onSubmit={(event) => {
            event.preventDefault();
            void run(m.importer.service.connecting, async () => {
              const scopes = await source.scopes(token);
              if (scopes.length === 0)
                throw new Error(m.importer.service.nothingToImport(source.name));
              setScopeId(scopes[0]?.id ?? '');
              setStep({ kind: 'scope', scopes });
            });
          }}
        >
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="import-token">
              {m.importer.service.tokenLabel(source.name, source.tokenLabel)}
            </Label>
            <Input
              id="import-token"
              type="password"
              autoComplete="off"
              spellCheck={false}
              required
              value={token}
              onChange={(event) => setToken(event.target.value)}
            />
            <p className="text-xs text-fg-subtle">
              {m.importer.service.createIn}{' '}
              <a
                href={source.tokenHelp.url}
                target="_blank"
                rel="noreferrer noopener"
                className="inline-flex items-center gap-0.5 underline"
              >
                {source.tokenHelp.text}
                <ExternalLinkIcon aria-hidden className="size-3" />
              </a>
              {m.importer.service.tokenPrivacy}
            </p>
          </div>
          <Button type="submit" variant="primary" className="self-start" disabled={busy !== null}>
            {busy ?? m.importer.service.connect}
          </Button>
        </form>
      )}

      {step.kind === 'scope' && (
        <form
          className="flex flex-col gap-3"
          onSubmit={(event) => {
            event.preventDefault();
            const scope = step.scopes.find((s) => s.id === scopeId);
            if (!scope) return;
            void run(m.importer.service.reading, async () => {
              const tasks = orderForImport(
                await source.tasks(token, scope, {
                  comments,
                  onProgress: (message) => setBusy(message),
                }),
              );
              if (tasks.length === 0) throw new Error(m.importer.service.noTasks(scope.name));
              setStatusMap(
                Object.fromEntries(
                  tasks.map((task) => [
                    statusKey(task),
                    defaultStatusFor(task, team.statuses) ?? DEFAULT,
                  ]),
                ),
              );
              setStep({ kind: 'review', scope, tasks });
            });
          }}
        >
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="import-scope">
              {m.importer.service.scopeToImport(source.scopeLabel)}
            </Label>
            <Select
              id="import-scope"
              value={scopeId}
              onValueChange={setScopeId}
              options={step.scopes.map((s) => ({
                value: s.id,
                label: grouped ? `${s.group} · ${s.name}` : s.name,
              }))}
            />
          </div>
          <label className="flex items-center gap-2 text-[13px]">
            <input
              type="checkbox"
              checked={comments}
              onChange={(event) => setComments(event.target.checked)}
              className="accent-(--accent)"
            />
            {m.importer.service.includeComments}
          </label>
          <Button type="submit" variant="primary" className="self-start" disabled={busy !== null}>
            {busy ?? m.importer.service.readTasks}
          </Button>
        </form>
      )}

      {step.kind === 'review' && review && (
        <section aria-label={m.importer.service.review} className="flex flex-col gap-4">
          <h2 className="text-[13px] font-semibold">
            {m.importer.service.summary(step.tasks.length, step.scope.name)}
            {review.subtasks > 0 && m.importer.service.subtasks(review.subtasks)}
            {review.comments > 0 && m.importer.service.withComments(review.comments)}
          </h2>

          <fieldset className="flex flex-col gap-2">
            <legend className="mb-1.5 text-[13px] font-semibold">
              {m.importer.service.statuses}
            </legend>
            {review.statuses.map(([key, entry]) => (
              <label key={key} className="flex items-center justify-between gap-3 text-[13px]">
                <span>
                  {entry.status ??
                    (entry.category === 'completed'
                      ? m.importer.service.completed
                      : m.importer.service.noStatus)}{' '}
                  <span className="text-xs text-fg-subtle">({entry.count})</span>
                </span>
                <Select
                  aria-label={m.importer.service.statusFor(
                    entry.status ?? m.importer.service.withoutStatus,
                  )}
                  value={statusMap[key] ?? DEFAULT}
                  onValueChange={(value) => setStatusMap({ ...statusMap, [key]: value })}
                  options={[
                    { value: DEFAULT, label: m.importer.service.teamDefault(team.name) },
                    ...team.statuses.map((s) => ({ value: s.id, label: s.name })),
                  ]}
                />
              </label>
            ))}
          </fieldset>

          <ul className="flex flex-col gap-1 text-xs text-fg-muted">
            {review.unmatched.length > 0 && (
              <li>
                {m.importer.service.unassigned(
                  review.unmatched.slice(0, 6).join(', '),
                  review.unmatched.length - 6,
                )}
                {!admin && m.importer.service.adminsMatch}
              </li>
            )}
            {review.missingLabels.length > 0 && (
              <li>
                <label className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    checked={createLabels}
                    onChange={(event) => setCreateLabels(event.target.checked)}
                    className="accent-(--accent)"
                  />
                  {m.importer.service.createLabels(review.missingLabels.length)}
                </label>
              </li>
            )}
            {review.missingProjects.length > 0 && (
              <li>
                <label className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    checked={createProjects}
                    onChange={(event) => setCreateProjects(event.target.checked)}
                    className="accent-(--accent)"
                  />
                  {m.importer.service.createProjects(
                    review.missingProjects.length,
                    review.missingProjects.slice(0, 4).join(', '),
                  )}
                </label>
              </li>
            )}
          </ul>

          {progress && (
            <progress
              aria-label={busy ?? m.importer.importing}
              max={progress.total}
              value={progress.done}
              className="h-1.5 w-full overflow-hidden rounded-full [&::-moz-progress-bar]:bg-accent [&::-webkit-progress-bar]:bg-surface-muted [&::-webkit-progress-value]:bg-accent"
            />
          )}
          <Button
            variant="primary"
            className="self-start"
            disabled={busy !== null}
            onClick={() => void importAll(step.tasks)}
          >
            {busy ?? m.importer.importTasks(step.tasks.length)}
          </Button>
        </section>
      )}

      {error && (
        <FieldError>
          {error}
          {step.kind === 'review' && m.importer.service.errorKept}
        </FieldError>
      )}
    </div>
  );
}
