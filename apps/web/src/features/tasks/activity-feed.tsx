import { useActivity, useCommentActions, useComments } from '@daiq/data';
import {
  formatDueDate,
  isPriority,
  PRIORITY_LABEL,
  toIsoDate,
  type ActivityEntry,
  type Comment,
  type RichDocument,
  type TaskDetail,
} from '@daiq/domain';
import {
  Avatar,
  Button,
  cn,
  Menu,
  MenuContent,
  MenuItem,
  MenuTrigger,
  Skeleton,
  Tooltip,
} from '@daiq/ui';
import { MoreHorizontalIcon, SmilePlusIcon } from 'lucide-react';
import { Children, lazy, Suspense, useState, type ReactNode } from 'react';
import { m } from '../../i18n';
import { newId } from '../../lib/ids';
import { formatDateTime, timeAgo } from '../../lib/time';
import { useWorkspace, useWorkspaceData } from '../workspace/workspace-context';

const RichTextEditor = lazy(() =>
  import('@daiq/editor/editor').then((mod) => ({ default: mod.RichTextEditor })),
);
const RichTextView = lazy(() =>
  import('@daiq/editor/editor').then((mod) => ({ default: mod.RichTextView })),
);

const QUICK_REACTIONS = ['👍', '🎉', '❤️', '👀', '🚀', '✅'];

function str(value: unknown): string {
  return typeof value === 'string' ? value : '';
}

function describe(
  entry: ActivityEntry,
  actor: ReactNode,
  name: (id: string) => string,
): ReactNode[] | null {
  const t = m.task.activity;
  const data = entry.data;
  const today = toIsoDate(new Date());
  switch (entry.kind) {
    case 'task.created':
      return t.created(actor);
    case 'task.status_changed':
      return t.statusChanged(
        actor,
        <strong>{str(data.from)}</strong>,
        <strong>{str(data.to)}</strong>,
      );
    case 'task.priority_changed': {
      const to = Number(data.to);
      return isPriority(to)
        ? to === 0
          ? t.priorityRemoved(actor)
          : t.prioritySet(actor, <strong>{PRIORITY_LABEL[to]}</strong>)
        : null;
    }
    case 'task.renamed':
      return t.renamed(actor, str(data.to));
    case 'task.project_changed':
      return data.to
        ? t.movedTo(actor, <strong>{str(data.to)}</strong>)
        : t.removedFrom(actor, <strong>{str(data.from)}</strong>);
    case 'task.due_date_changed':
      return data.to
        ? t.dueDateSet(actor, <strong>{formatDueDate(str(data.to), today)}</strong>)
        : t.dueDateRemoved(actor);
    case 'task.assignee_added':
      return str(data.user_id) === entry.actorId
        ? t.selfAssigned(actor)
        : t.assigned(actor, <strong>{name(str(data.user_id))}</strong>);
    case 'task.assignee_removed':
      return str(data.user_id) === entry.actorId
        ? t.selfUnassigned(actor)
        : t.unassigned(actor, <strong>{name(str(data.user_id))}</strong>);
    case 'task.description_changed':
      return t.descriptionUpdated(actor);
    case 'task.parent_changed':
      return data.to ? t.madeSubtask(actor) : t.parentRemoved(actor);
    case 'task.estimate_changed':
      return typeof data.to === 'number'
        ? t.estimateSet(actor, <strong>{data.to}</strong>)
        : t.estimateRemoved(actor);
    case 'task.cycle_changed': {
      if (typeof data.to !== 'number')
        return t.removedFrom(actor, <strong>{t.cycle(String(data.from))}</strong>);
      const to = <strong>{t.cycle(data.to)}</strong>;
      // A system change (actor null) is the nightly rollover of an ended cycle.
      return entry.actorId === null && typeof data.from === 'number'
        ? t.rolledOver(actor, to, data.from)
        : t.movedTo(actor, to);
    }
    case 'task.attachment_added':
      return t.attached(actor, <strong>{str(data.file_name)}</strong>);
    case 'task.deleted':
      return t.deleted(actor);
    case 'task.restored':
      return t.restored(actor);
    case 'task.submitted':
      return t.submitted(actor, <strong>{str(data.form)}</strong>);
    default:
      return null;
  }
}

type FeedItem =
  | { kind: 'activity'; at: string; entry: ActivityEntry }
  | { kind: 'comment'; at: string; comment: Comment };

export function ActivityFeed({ task }: { task: TaskDetail }) {
  const { workspace, userId } = useWorkspace();
  const data = useWorkspaceData();
  const activity = useActivity(task.id);
  const comments = useComments(task.id);
  const actions = useCommentActions(task.id, workspace.id, userId);
  const [showActivity, setShowActivity] = useState(true);
  const name = (id: string | null) =>
    id ? (data.membersById.get(id)?.displayName ?? m.common.someone) : 'Daiquiri';
  // Changes made by an automation name it instead of a person.
  const actorName = (entry: ActivityEntry) => {
    if (typeof entry.data.automation === 'string')
      return m.task.activity.automation(entry.data.automation);
    // Someone outside the workspace, through a public form.
    if (entry.actorId === null && typeof entry.data.email === 'string') return entry.data.email;
    return name(entry.actorId);
  };

  const items: FeedItem[] = [
    ...(showActivity
      ? (activity.data ?? []).map((entry): FeedItem => ({
          kind: 'activity',
          at: entry.createdAt,
          entry,
        }))
      : []),
    ...(comments.data ?? [])
      .filter((comment) => !comment.parentId)
      .map((comment): FeedItem => ({ kind: 'comment', at: comment.createdAt, comment })),
  ].sort((a, b) => a.at.localeCompare(b.at));
  const replies = (id: string) => comments.data?.filter((c) => c.parentId === id) ?? [];

  return (
    <section aria-labelledby="activity-heading" className="flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <h2 id="activity-heading" className="text-[13px] font-semibold">
          {m.task.activity.heading}
        </h2>
        <label className="flex items-center gap-1.5 text-xs text-fg-muted">
          <input
            type="checkbox"
            checked={showActivity}
            onChange={(e) => setShowActivity(e.target.checked)}
            className="accent-(--accent)"
          />
          {m.task.activity.showChanges}
        </label>
      </div>
      {(activity.isPending || comments.isPending) && <Skeleton className="h-16" />}
      <ol className="flex flex-col gap-3">
        {items.map((item) => {
          if (item.kind === 'activity') {
            const actor = actorName(item.entry);
            const parts = describe(
              item.entry,
              <span className="font-medium text-fg">{actor}</span>,
              (id) => name(id),
            );
            if (!parts) return null;
            return (
              <li
                key={`a-${item.entry.id}`}
                className="flex items-center gap-2 pl-1 text-xs text-fg-muted"
              >
                <Avatar name={actor} size="xs" />
                <span>{Children.toArray(parts)}</span>
                <Tooltip label={formatDateTime(item.at)}>
                  <time dateTime={item.at} className="text-fg-subtle">
                    {timeAgo(item.at)}
                  </time>
                </Tooltip>
              </li>
            );
          }
          return (
            <li key={`c-${item.comment.id}`}>
              <CommentCard comment={item.comment} name={name} actions={actions} userId={userId} />
              {replies(item.comment.id).length > 0 && (
                <ol className="mt-2 ml-6 flex flex-col gap-2 border-l border-border pl-3">
                  {replies(item.comment.id).map((reply) => (
                    <li key={reply.id}>
                      <CommentCard comment={reply} name={name} actions={actions} userId={userId} />
                    </li>
                  ))}
                </ol>
              )}
            </li>
          );
        })}
      </ol>
      <CommentComposer
        onSubmit={(body) => actions.create.mutate({ id: newId(), body })}
        mentionables={data.members.map((member) => ({
          id: member.id,
          name: member.displayName,
          avatarUrl: member.avatarUrl,
        }))}
      />
    </section>
  );
}

function CommentCard({
  comment,
  name,
  actions,
  userId,
}: {
  comment: Comment;
  name: (id: string | null) => string;
  actions: ReturnType<typeof useCommentActions>;
  userId: string;
}) {
  const grouped = new Map<string, string[]>();
  for (const reaction of comment.reactions)
    grouped.set(reaction.emoji, [...(grouped.get(reaction.emoji) ?? []), reaction.userId]);
  return (
    <article className="group/comment rounded-lg border border-border bg-surface px-3 py-2.5">
      <header className="mb-1 flex items-center gap-2 text-xs">
        <Avatar name={name(comment.authorId)} size="sm" />
        <span className="font-medium">{name(comment.authorId)}</span>
        <Tooltip label={formatDateTime(comment.createdAt)}>
          <time dateTime={comment.createdAt} className="text-fg-subtle">
            {timeAgo(comment.createdAt)}
          </time>
        </Tooltip>
        {comment.editedAt && <span className="text-fg-subtle">{m.task.comments.edited}</span>}
        {comment.authorId === userId && !comment.deletedAt && (
          <Menu>
            <MenuTrigger
              render={
                <Button
                  variant="ghost"
                  size="icon-sm"
                  className="ml-auto opacity-0 group-hover/comment:opacity-100 focus-visible:opacity-100 aria-expanded:opacity-100"
                  aria-label={m.task.comments.actions}
                />
              }
            >
              <MoreHorizontalIcon />
            </MenuTrigger>
            <MenuContent align="end">
              <MenuItem
                destructive
                onClick={() => actions.update.mutate({ id: comment.id, deleted: true })}
              >
                {m.task.comments.delete}
              </MenuItem>
            </MenuContent>
          </Menu>
        )}
      </header>
      {comment.deletedAt ? (
        <p className="text-[13px] text-fg-subtle italic">{m.task.comments.deleted}</p>
      ) : (
        <Suspense fallback={<Skeleton className="h-4" />}>
          <RichTextView doc={comment.body} className="text-[13px]" />
        </Suspense>
      )}
      {!comment.deletedAt && (
        <div className="mt-2 flex flex-wrap items-center gap-1">
          {[...grouped].map(([emoji, users]) => {
            const mine = users.includes(userId);
            return (
              <button
                key={emoji}
                type="button"
                aria-pressed={mine}
                aria-label={`${emoji} ${users.length}`}
                onClick={() =>
                  actions.toggleReaction.mutate({ commentId: comment.id, emoji, active: mine })
                }
                className={cn(
                  'flex h-6 items-center gap-1 rounded-full border px-2 text-xs tabular',
                  mine
                    ? 'border-accent/40 bg-accent-subtle text-accent-text'
                    : 'border-border text-fg-muted hover:bg-surface-muted',
                )}
              >
                {emoji} {users.length}
              </button>
            );
          })}
          <Menu>
            <MenuTrigger
              render={
                <Button
                  variant="ghost"
                  size="icon-sm"
                  className="size-6 opacity-0 group-hover/comment:opacity-100 focus-visible:opacity-100 aria-expanded:opacity-100"
                  aria-label={m.task.comments.addReaction}
                />
              }
            >
              <SmilePlusIcon className="!size-3.5" />
            </MenuTrigger>
            <MenuContent className="flex min-w-0 gap-0.5 p-1">
              {QUICK_REACTIONS.map((emoji) => (
                <MenuItem
                  key={emoji}
                  className="h-8 w-8 justify-center px-0 text-base"
                  onClick={() =>
                    actions.toggleReaction.mutate({
                      commentId: comment.id,
                      emoji,
                      active: grouped.get(emoji)?.includes(userId) ?? false,
                    })
                  }
                  aria-label={m.task.comments.react(emoji)}
                >
                  {emoji}
                </MenuItem>
              ))}
            </MenuContent>
          </Menu>
        </div>
      )}
    </article>
  );
}

function CommentComposer({
  onSubmit,
  mentionables,
}: {
  onSubmit: (body: RichDocument) => void;
  mentionables: { id: string; name: string; avatarUrl: string | null }[];
}) {
  const [doc, setDoc] = useState<RichDocument | null>(null);
  const [version, setVersion] = useState(0);
  const isEmpty = !doc?.content?.some(
    (node) =>
      typeof node === 'object' &&
      node !== null &&
      !Array.isArray(node) &&
      Array.isArray(node.content) &&
      node.content.length > 0,
  );
  const submit = () => {
    if (!doc || isEmpty) return;
    onSubmit(doc);
    setDoc(null);
    setVersion((v) => v + 1);
  };
  return (
    <div
      id="comment-composer"
      className="rounded-lg border border-border bg-surface px-3 py-2 focus-within:border-focus"
    >
      <Suspense fallback={<Skeleton className="h-10" />}>
        <RichTextEditor
          key={version}
          value={null}
          onChange={setDoc}
          debounceMs={0}
          onSubmit={submit}
          placeholder={m.task.comments.placeholder}
          ariaLabel={m.task.comments.label}
          mentionables={mentionables}
          className="min-h-10 text-[13px]"
        />
      </Suspense>
      <div className="mt-1 flex justify-end">
        <Button size="sm" variant="primary" disabled={isEmpty} onClick={submit}>
          {m.task.comments.submit}
        </Button>
      </div>
    </div>
  );
}
