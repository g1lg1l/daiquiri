/**
 * Query keys. Task lists are keyed by scope so cache patchers can decide
 * membership from the key alone (see cache.ts).
 */
export type TaskScope =
  | { kind: 'team'; id: string }
  | { kind: 'project'; id: string }
  | { kind: 'assignee'; id: string; workspaceId: string }
  | { kind: 'creator'; id: string; workspaceId: string }
  | { kind: 'parent'; id: string }
  | { kind: 'cycle'; id: string };

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
  /** Under 'relations' so realtime relation events refresh it too. */
  dependencies: (workspaceId: string) => ['relations', 'blocks', workspaceId] as const,
  comments: (taskId: string) => ['comments', taskId] as const,
  attachments: (taskId: string) => ['attachments', taskId] as const,
  activity: (taskId: string) => ['activity', taskId] as const,
  recurrence: (taskId: string) => ['recurrence', taskId] as const,
  notifications: (workspaceId: string) => ['notifications', workspaceId] as const,
  notificationSettings: (workspaceId: string) => ['notification-settings', workspaceId] as const,
  cycles: (teamId: string) => ['cycles', teamId] as const,
  customFields: (workspaceId: string) => ['custom-fields', workspaceId] as const,
  milestones: (projectId: string) => ['milestones', projectId] as const,
  projectUpdates: (projectId: string) => ['project-updates', projectId] as const,
  latestProjectUpdates: (workspaceId: string) =>
    ['project-updates', 'latest', workspaceId] as const,
  cycleProgress: (cycleId: string) => ['cycles', 'progress', cycleId] as const,
  statusFlow: (workspaceId: string, fingerprint: string) =>
    ['status-flow', workspaceId, fingerprint] as const,
  views: (workspaceId: string) => ['views', workspaceId] as const,
  templates: (workspaceId: string) => ['templates', workspaceId] as const,
  trash: (workspaceId: string) => ['trash', workspaceId] as const,
  automations: (teamId: string) => ['automations', teamId] as const,
  automationRuns: (automationId: string) => ['automations', 'runs', automationId] as const,
  favorites: (workspaceId: string) => ['favorites', workspaceId] as const,
  search: (workspaceId: string, query: string) => ['search', workspaceId, query] as const,
  memberEmails: (workspaceId: string) => ['member-emails', workspaceId] as const,
  invitations: (workspaceId: string) => ['invitations', workspaceId] as const,
};
