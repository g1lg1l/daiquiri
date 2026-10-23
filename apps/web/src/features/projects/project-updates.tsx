import { useProjectUpdateActions, useProjectUpdates } from '@daiq/data';
import {
  PROJECT_HEALTH,
  PROJECT_HEALTH_LABEL,
  type Project,
  type ProjectHealth,
  type ProjectUpdate,
  type RichDocument,
} from '@daiq/domain';
import { Avatar, Button, cn, Menu, MenuContent, MenuItem, MenuTrigger, Skeleton } from '@daiq/ui';
import { MegaphoneIcon, MoreHorizontalIcon } from 'lucide-react';
import { lazy, Suspense, useState } from 'react';
import { m } from '../../i18n/team';
import { newId } from '../../lib/ids';
import { formatDateTime, timeAgo } from '../../lib/time';
import { pushUndo } from '../undo/undo';
import { useWorkspace, useWorkspaceData } from '../workspace/workspace-context';
import { HealthBadge } from './project-status';

const RichTextEditor = lazy(() =>
  import('@daiq/editor/editor').then((mod) => ({ default: mod.RichTextEditor })),
);
const RichTextView = lazy(() =>
  import('@daiq/editor/editor').then((mod) => ({ default: mod.RichTextView })),
);

const HEALTH_RING: Record<ProjectHealth, string> = {
  on_track: 'has-checked:border-status-completed has-checked:bg-status-completed/10',
  at_risk: 'has-checked:border-warning has-checked:bg-warning/15',
  off_track: 'has-checked:border-danger has-checked:bg-danger-subtle',
};

function hasText(doc: RichDocument | null): boolean {
  return Boolean(
    doc?.content?.some(
      (node) =>
        typeof node === 'object' &&
        node !== null &&
        !Array.isArray(node) &&
        Array.isArray(node.content) &&
        node.content.length > 0,
    ),
  );
}

function Composer({
  onPost,
}: {
  onPost: (health: ProjectHealth, body: RichDocument | null) => void;
}) {
  const [health, setHealth] = useState<ProjectHealth>('on_track');
  const [doc, setDoc] = useState<RichDocument | null>(null);
  const [version, setVersion] = useState(0);
  const post = () => {
    onPost(health, hasText(doc) ? doc : null);
    setDoc(null);
    setVersion((v) => v + 1);
  };
  const t = m.team.updates;
  return (
    <section
      aria-label={t.composer}
      className="flex flex-col gap-3 rounded-xl border border-border bg-surface p-4"
    >
      <fieldset className="flex flex-wrap items-center gap-2">
        <legend className="mb-2 text-xs font-medium text-fg-muted">{t.question}</legend>
        {PROJECT_HEALTH.map((value) => (
          <label
            key={value}
            className={cn(
              'flex h-7 cursor-pointer items-center gap-1.5 rounded-full border border-border px-3 text-xs has-focus-visible:outline-2 has-focus-visible:outline-focus',
              HEALTH_RING[value],
            )}
          >
            <input
              type="radio"
              name="health"
              value={value}
              checked={health === value}
              onChange={() => setHealth(value)}
              className="sr-only"
            />
            {PROJECT_HEALTH_LABEL[value]}
          </label>
        ))}
      </fieldset>
      <div className="rounded-lg border border-border px-3 py-2 focus-within:border-focus">
        <Suspense fallback={<Skeleton className="h-16" />}>
          <RichTextEditor
            key={version}
            value={null}
            onChange={setDoc}
            debounceMs={0}
            onSubmit={post}
            placeholder={t.placeholder}
            ariaLabel={t.editorLabel}
            className="min-h-16 text-[13px]"
          />
        </Suspense>
      </div>
      <div className="flex justify-end">
        <Button variant="primary" size="sm" onClick={post}>
          {t.post}
        </Button>
      </div>
    </section>
  );
}

/** A project's status updates, newest first, with a composer on top (feature spec §2). */
export function ProjectUpdates({ project }: { project: Project }) {
  const { userId, workspace } = useWorkspace();
  const data = useWorkspaceData();
  const updates = useProjectUpdates(project.id);
  const actions = useProjectUpdateActions(project, userId);
  const t = m.team.updates;
  const canDelete = (update: ProjectUpdate) =>
    update.authorId === userId || workspace.role === 'owner' || workspace.role === 'admin';

  return (
    <div className="min-h-0 flex-1 overflow-y-auto px-4 py-6 scrollbar-thin md:px-6">
      <div className="mx-auto flex max-w-2xl flex-col gap-6">
        {workspace.role !== 'guest' && (
          <Composer onPost={(health, body) => actions.post.mutate({ id: newId(), health, body })} />
        )}
        {updates.isPending ? (
          <Skeleton className="h-24" />
        ) : updates.data?.length === 0 ? (
          <div className="flex flex-col items-start gap-2 py-6 text-[13px] text-fg-muted">
            <MegaphoneIcon aria-hidden className="size-5 text-fg-subtle" />
            {t.empty}
          </div>
        ) : (
          <ol className="flex flex-col gap-4">
            {updates.data?.map((update) => {
              const author = update.authorId ? data.membersById.get(update.authorId) : undefined;
              return (
                <li
                  key={update.id}
                  className="flex flex-col gap-2 rounded-xl border border-border bg-surface p-4"
                >
                  <header className="flex items-center gap-2 text-[13px]">
                    <Avatar name={author?.displayName ?? m.common.formerMember} size="sm" />
                    <span className="font-medium">
                      {author?.displayName ?? m.common.formerMember}
                    </span>
                    <time
                      dateTime={update.createdAt}
                      title={formatDateTime(update.createdAt)}
                      className="text-xs text-fg-subtle"
                    >
                      {timeAgo(update.createdAt)}
                    </time>
                    <HealthBadge health={update.health} className="ml-auto" />
                    {canDelete(update) && (
                      <Menu>
                        <MenuTrigger
                          render={
                            <Button
                              variant="ghost"
                              size="icon-sm"
                              className="size-6"
                              aria-label={t.actions}
                            />
                          }
                        >
                          <MoreHorizontalIcon />
                        </MenuTrigger>
                        <MenuContent align="end">
                          <MenuItem
                            destructive
                            onClick={() => {
                              actions.remove.mutate(update.id);
                              pushUndo(
                                {
                                  label: t.delete,
                                  undo: () =>
                                    actions.post.mutateAsync({
                                      id: update.id,
                                      health: update.health,
                                      body: update.body,
                                    }),
                                },
                                { toast: t.deleted },
                              );
                            }}
                          >
                            {t.delete}
                          </MenuItem>
                        </MenuContent>
                      </Menu>
                    )}
                  </header>
                  {update.body && (
                    <Suspense fallback={<Skeleton className="h-6" />}>
                      <RichTextView doc={update.body} className="text-[13px]" />
                    </Suspense>
                  )}
                </li>
              );
            })}
          </ol>
        )}
      </div>
    </div>
  );
}
