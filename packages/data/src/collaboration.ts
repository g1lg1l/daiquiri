import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type {
  ActivityEntry,
  Comment,
  RelationKind,
  RichDocument,
  TaskRelation,
} from '@daiq/domain';
import { useDaiqClient } from './context';
import { ensureOk, unwrap } from './errors';
import { keys } from './keys';
import { documentToJson, toActivity, toComment } from './mappers';

const COMMENT_COLUMNS = '*, comment_reactions(emoji, user_id)';

export function useComments(taskId: string | undefined) {
  const client = useDaiqClient();
  return useQuery({
    queryKey: keys.comments(taskId ?? ''),
    enabled: Boolean(taskId),
    queryFn: async (): Promise<Comment[]> =>
      unwrap(
        await client
          .from('comments')
          .select(COMMENT_COLUMNS)
          .eq('task_id', taskId ?? '')
          .order('created_at'),
      ).map(toComment),
  });
}

export function useActivity(taskId: string | undefined) {
  const client = useDaiqClient();
  return useQuery({
    queryKey: keys.activity(taskId ?? ''),
    enabled: Boolean(taskId),
    queryFn: async (): Promise<ActivityEntry[]> =>
      unwrap(
        await client
          .from('activity')
          .select('*')
          .eq('task_id', taskId ?? '')
          .order('id'),
      ).map(toActivity),
  });
}

export function useCommentActions(taskId: string, workspaceId: string, userId: string) {
  const client = useDaiqClient();
  const queryClient = useQueryClient();
  const key = keys.comments(taskId);
  const setComments = (update: (comments: Comment[]) => Comment[]) =>
    queryClient.setQueryData<Comment[]>(key, (comments = []) => update(comments));

  const create = useMutation({
    mutationFn: async (input: { id: string; body: RichDocument; parentId?: string | null }) =>
      toComment(
        unwrap(
          await client
            .from('comments')
            .insert({
              id: input.id,
              workspace_id: workspaceId,
              task_id: taskId,
              parent_id: input.parentId ?? null,
              body: documentToJson(input.body),
            })
            .select(COMMENT_COLUMNS)
            .single(),
        ),
      ),
    onMutate: (input) =>
      setComments((comments) => [
        ...comments,
        {
          id: input.id,
          taskId,
          parentId: input.parentId ?? null,
          authorId: userId,
          body: input.body,
          createdAt: new Date().toISOString(),
          editedAt: null,
          deletedAt: null,
          reactions: [],
        },
      ]),
    onError: (_error, input) =>
      setComments((comments) => comments.filter((c) => c.id !== input.id)),
    onSuccess: (comment) =>
      setComments((comments) => comments.map((c) => (c.id === comment.id ? comment : c))),
    onSettled: () => queryClient.invalidateQueries({ queryKey: keys.activity(taskId) }),
  });

  const update = useMutation({
    mutationFn: async (input: { id: string; body?: RichDocument; deleted?: boolean }) =>
      toComment(
        unwrap(
          await client
            .from('comments')
            .update({
              ...(input.body && { body: documentToJson(input.body) }),
              ...(input.deleted && { deleted_at: new Date().toISOString() }),
            })
            .eq('id', input.id)
            .select(COMMENT_COLUMNS)
            .single(),
        ),
      ),
    onSuccess: (comment) =>
      setComments((comments) => comments.map((c) => (c.id === comment.id ? comment : c))),
  });

  const toggleReaction = useMutation({
    mutationFn: async ({
      commentId,
      emoji,
      active,
    }: {
      commentId: string;
      emoji: string;
      active: boolean;
    }) => {
      if (active) {
        ensureOk(
          await client
            .from('comment_reactions')
            .delete()
            .match({ comment_id: commentId, emoji, user_id: userId }),
        );
      } else {
        ensureOk(
          await client
            .from('comment_reactions')
            .insert({ comment_id: commentId, emoji, user_id: userId, workspace_id: workspaceId }),
        );
      }
    },
    onMutate: ({ commentId, emoji, active }) =>
      setComments((comments) =>
        comments.map((c) =>
          c.id !== commentId
            ? c
            : {
                ...c,
                reactions: active
                  ? c.reactions.filter((r) => !(r.emoji === emoji && r.userId === userId))
                  : [...c.reactions, { emoji, userId }],
              },
        ),
      ),
    onError: () => queryClient.invalidateQueries({ queryKey: key }),
  });

  return { create, update, toggleReaction };
}

export function useRelations(taskId: string | undefined) {
  const client = useDaiqClient();
  return useQuery({
    queryKey: keys.relations(taskId ?? ''),
    enabled: Boolean(taskId),
    queryFn: async (): Promise<TaskRelation[]> =>
      unwrap(
        await client
          .from('task_relations')
          .select('id, task_id, related_task_id, kind')
          .or(`task_id.eq.${taskId},related_task_id.eq.${taskId}`),
      ).map((row) => ({
        id: row.id,
        taskId: row.task_id,
        relatedTaskId: row.related_task_id,
        kind: row.kind,
      })),
  });
}

export function useRelationActions(taskId: string, workspaceId: string) {
  const client = useDaiqClient();
  const queryClient = useQueryClient();
  const refresh = () => queryClient.invalidateQueries({ queryKey: ['relations'] });
  const add = useMutation({
    mutationFn: async (input: { relatedTaskId: string; kind: RelationKind; inverse?: boolean }) =>
      ensureOk(
        await client.from('task_relations').insert({
          workspace_id: workspaceId,
          task_id: input.inverse ? input.relatedTaskId : taskId,
          related_task_id: input.inverse ? taskId : input.relatedTaskId,
          kind: input.kind,
        }),
      ),
    onSettled: refresh,
  });
  const remove = useMutation({
    mutationFn: async (relationId: string) =>
      ensureOk(await client.from('task_relations').delete().eq('id', relationId)),
    onSettled: refresh,
  });
  return { add, remove };
}

export function useTaskSubscription(
  taskId: string | undefined,
  workspaceId: string,
  userId: string,
) {
  const client = useDaiqClient();
  const queryClient = useQueryClient();
  const key = ['subscription', taskId ?? '', userId] as const;
  const query = useQuery({
    queryKey: key,
    enabled: Boolean(taskId),
    queryFn: async (): Promise<boolean> =>
      unwrap(
        await client
          .from('task_subscribers')
          .select('user_id')
          .eq('task_id', taskId ?? '')
          .eq('user_id', userId),
      ).length > 0,
  });
  const toggle = useMutation({
    mutationFn: async (subscribe: boolean) =>
      subscribe
        ? ensureOk(
            await client
              .from('task_subscribers')
              .upsert(
                { task_id: taskId ?? '', user_id: userId, workspace_id: workspaceId },
                { ignoreDuplicates: true },
              ),
          )
        : ensureOk(
            await client
              .from('task_subscribers')
              .delete()
              .match({ task_id: taskId ?? '', user_id: userId }),
          ),
    onMutate: (subscribe) => queryClient.setQueryData(key, subscribe),
    onError: (_error, subscribe) => queryClient.setQueryData(key, !subscribe),
  });
  return { subscribed: query.data ?? false, toggle };
}
