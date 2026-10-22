/**
 * Query keys. Task lists are keyed by scope so cache patchers can decide
 * membership from the key alone (see cache.ts).
 */
export type TaskScope =
  | { kind: 'team'; id: string }
  | { kind: 'project'; id: string }
  | { kind: 'assignee'; id: string; workspaceId: string }
  | { kind: 'creator'; id: string; workspaceId: string }
  | { kind: 'parent'; id: string };

export const keys = {
  workspaces: () => ['workspaces'] as const,
  members: (workspaceId: string) => ['members', workspaceId] as const,
  teams: (workspaceId: string) => ['teams', workspaceId] as const,
  labels: (workspaceId: string) => ['labels', workspaceId] as const,
  projects: (workspaceId: string) => ['projects', workspaceId] as const,
  tasks: (scope: TaskScope) =>
    scope.kind === 'assignee' || scope.kind === 'creator'
      ? (['tasks', scope.kind, scope.id, scope.workspaceId] as const)
      : (['tasks', scope.kind, scope.id] as const),
  allTasks: () => ['tasks'] as const,
  taskDetail: (teamId: string, number: number) => ['task', 'ref', teamId, number] as const,
  allTaskDetails: () => ['task'] as const,
  relations: (taskId: string) => ['relations', taskId] as const,
  comments: (taskId: string) => ['comments', taskId] as const,
  activity: (taskId: string) => ['activity', taskId] as const,
  notifications: (workspaceId: string) => ['notifications', workspaceId] as const,
  views: (workspaceId: string) => ['views', workspaceId] as const,
  favorites: (workspaceId: string) => ['favorites', workspaceId] as const,
  search: (workspaceId: string, query: string) => ['search', workspaceId, query] as const,
  memberEmails: (workspaceId: string) => ['member-emails', workspaceId] as const,
  invitations: (workspaceId: string) => ['invitations', workspaceId] as const,
};
