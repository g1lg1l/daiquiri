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
import { lazy, Suspense, useState, type ReactNode } from 'react';
import { newId } from '../../lib/ids';
import { formatDateTime, timeAgo } from '../../lib/time';
import { useWorkspace, useWorkspaceData } from '../workspace/workspace-context';

const RichTextEditor = lazy(() =>
  import('@daiq/editor/editor').then((m) => ({ default: m.RichTextEditor })),
);
const RichTextView = lazy(() =>
  import('@daiq/editor/editor').then((m) => ({ default: m.RichTextView })),
);

const QUICK_REACTIONS = ['👍', '🎉', '❤️', '👀', '🚀', '✅'];

function str(value: unknown): string {
  return typeof value === 'string' ? value : '';
}

function describe(entry: ActivityEntry, name: (id: string) => string): ReactNode | null {
  const data = entry.data;
  const today = toIsoDate(new Date());
  switch (entry.kind) {
    case 'task.created':
      return 'created the task';
    case 'task.status_changed':
      return (
        <>
          changed status from <strong>{str(data.from)}</strong> to <strong>{str(data.to)}</strong>
        </>
      );
    case 'task.priority_changed': {
      const to = Number(data.to);
      return isPriority(to) ? (
        to === 0 ? (
          'removed the priority'
        ) : (
          <>
            set priority to <strong>{PRIORITY_LABEL[to]}</strong>
          </>
        )
      ) : null;
    }
    case 'task.renamed':
      return <>renamed the task to “{str(data.to)}”</>;
    case 'task.project_changed':
      return data.to ? (
        <>
          moved the task to <strong>{str(data.to)}</strong>
        </>
      ) : (
        <>
          removed the task from <strong>{str(data.from)}</strong>
        </>
      );
    case 'task.due_date_changed':
      return data.to ? (
        <>
          set the due date to <strong>{formatDueDate(str(data.to), today)}</strong>
        </>
      ) : (
        'removed the due date'
      );
    case 'task.assignee_added':
      return str(data.user_id) === entry.actorId ? (
        'self-assigned the task'
      ) : (
        <>
          assigned <strong>{name(str(data.user_id))}</strong>
        </>
      );
    case 'task.assignee_removed':
      return str(data.user_id) === entry.actorId ? (
        'unassigned themself'
      ) : (
        <>
          unassigned <strong>{name(str(data.user_id))}</strong>
        </>
      );
    case 'task.description_changed':
      return 'updated the description';
    case 'task.parent_changed':
      return data.to ? 'made this a sub-task' : 'removed the parent task';
    case 'task.deleted':
      return 'deleted the task';
    case 'task.restored':
      return 'restored the task';
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
    id ? (data.membersById.get(id)?.displayName ?? 'Someone') : 'Daiq';

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
          Activity
        </h2>
        <label className="flex items-center gap-1.5 text-xs text-fg-muted">
          <input
            type="checkbox"
            checked={showActivity}
            onChange={(e) => setShowActivity(e.target.checked)}
            className="accent-(--accent)"
          />
          Show changes
        </label>
      </div>
      {(activity.isPending || comments.isPending) && <Skeleton className="h-16" />}
      <ol className="flex flex-col gap-3">
        {items.map((item) => {
          if (item.kind === 'activity') {
            const text = describe(item.entry, (id) => name(id));
            if (!text) return null;
            return (
              <li
                key={`a-${item.entry.id}`}
                className="flex items-center gap-2 pl-1 text-xs text-fg-muted"
              >
                <Avatar name={name(item.entry.actorId)} size="xs" />
                <span>
                  <span className="font-medium text-fg">{name(item.entry.actorId)}</span> {text}
                </span>
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
        mentionables={data.members.map((m) => ({
          id: m.id,
          name: m.displayName,
          avatarUrl: m.avatarUrl,
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
        {comment.editedAt && <span className="text-fg-subtle">(edited)</span>}
        {comment.authorId === userId && !comment.deletedAt && (
          <Menu>
            <MenuTrigger
              render={
                <Button
                  variant="ghost"
                  size="icon-sm"
                  className="ml-auto opacity-0 group-hover/comment:opacity-100 focus-visible:opacity-100 aria-expanded:opacity-100"
                  aria-label="Comment actions"
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
                Delete comment
              </MenuItem>
            </MenuContent>
          </Menu>
        )}
      </header>
      {comment.deletedAt ? (
        <p className="text-[13px] text-fg-subtle italic">This comment was deleted.</p>
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
                  aria-label="Add reaction"
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
                  aria-label={`React with ${emoji}`}
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
          placeholder="Leave a comment… (@ to mention)"
          ariaLabel="Comment"
          mentionables={mentionables}
          className="min-h-10 text-[13px]"
        />
      </Suspense>
      <div className="mt-1 flex justify-end">
        <Button size="sm" variant="primary" disabled={isEmpty} onClick={submit}>
          Comment
        </Button>
      </div>
    </div>
  );
}
