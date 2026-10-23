import {
  isEstimateScale,
  isLabelColor,
  isNotificationKind,
  isPriority,
  isRichDocument,
  type ActivityEntry,
  type Comment,
  type JsonValue,
  type Label,
  type Notification,
  type Project,
  type RichDocument,
  type Status,
  type Task,
  type TaskDetail,
  type TaskPatch,
  type Team,
} from '@daiq/domain';
import type { Json, Tables, TablesUpdate } from './database.types';

export const TASK_COLUMNS =
  'id, workspace_id, team_id, number, title, status_id, priority, project_id, parent_id, creator_id, start_date, due_date, estimate, cycle_id, milestone_id, sort_key, completed_at, canceled_at, created_at, updated_at, task_assignees(user_id), task_labels(label_id)';

export const TASK_DETAIL_COLUMNS = `${TASK_COLUMNS}, description`;

type TaskRow = Omit<
  Tables<'tasks'>,
  'description' | 'description_text' | 'search' | 'deleted_at'
> & {
  task_assignees: { user_id: string }[];
  task_labels: { label_id: string }[];
};

export function toDocument(json: Json | null | undefined): RichDocument | null {
  return isRichDocument(json) ? json : null;
}

/** Domain document → JSON column value (RichDocument is plain JSON by construction). */
export function documentToJson(doc: RichDocument): { [key: string]: JsonValue | undefined } {
  return doc;
}

export function toTask(row: TaskRow): Task {
  return {
    id: row.id,
    workspaceId: row.workspace_id,
    teamId: row.team_id,
    number: row.number,
    title: row.title,
    statusId: row.status_id,
    priority: isPriority(row.priority) ? row.priority : 0,
    projectId: row.project_id,
    parentId: row.parent_id,
    creatorId: row.creator_id,
    startDate: row.start_date,
    dueDate: row.due_date,
    estimate: row.estimate,
    cycleId: row.cycle_id,
    milestoneId: row.milestone_id,
    sortKey: row.sort_key,
    completedAt: row.completed_at,
    canceledAt: row.canceled_at,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    assigneeIds: row.task_assignees.map((a) => a.user_id),
    labelIds: row.task_labels.map((l) => l.label_id),
  };
}

export function toTaskDetail(row: TaskRow & { description: Json | null }): TaskDetail {
  return { ...toTask(row), description: toDocument(row.description) };
}

/** Domain patch → database columns (only the provided keys). */
export function toTaskUpdate(patch: TaskPatch) {
  const columns: TablesUpdate<'tasks'> = {};
  if (patch.title !== undefined) columns.title = patch.title;
  if (patch.description !== undefined) {
    columns.description = patch.description ? documentToJson(patch.description) : null;
  }
  if (patch.statusId !== undefined) columns.status_id = patch.statusId;
  if (patch.priority !== undefined) columns.priority = patch.priority;
  if (patch.projectId !== undefined) columns.project_id = patch.projectId;
  if (patch.parentId !== undefined) columns.parent_id = patch.parentId;
  if (patch.startDate !== undefined) columns.start_date = patch.startDate;
  if (patch.dueDate !== undefined) columns.due_date = patch.dueDate;
  if (patch.estimate !== undefined) columns.estimate = patch.estimate;
  if (patch.cycleId !== undefined) columns.cycle_id = patch.cycleId;
  if (patch.milestoneId !== undefined) columns.milestone_id = patch.milestoneId;
  if (patch.sortKey !== undefined) columns.sort_key = patch.sortKey;
  return columns;
}

export function toStatus(row: Tables<'statuses'>): Status {
  return {
    id: row.id,
    teamId: row.team_id,
    name: row.name,
    category: row.category,
    position: row.position,
  };
}

export function toTeam(
  row: Tables<'teams'> & { statuses: Tables<'statuses'>[]; team_members: { user_id: string }[] },
): Team {
  return {
    id: row.id,
    workspaceId: row.workspace_id,
    key: row.key,
    name: row.name,
    description: row.description,
    isPrivate: row.is_private,
    cyclesEnabled: row.cycles_enabled,
    cycleWeeks: row.cycle_weeks,
    cycleStartWeekday: row.cycle_start_weekday,
    estimatesEnabled: row.estimates_enabled,
    estimateScale: isEstimateScale(row.estimate_scale) ? row.estimate_scale : 'points',
    triageEnabled: row.triage_enabled,
    memberIds: row.team_members.map((m) => m.user_id),
    statuses: row.statuses.map(toStatus),
  };
}

export function toLabel(row: Tables<'labels'>): Label {
  return {
    id: row.id,
    workspaceId: row.workspace_id,
    name: row.name,
    color: isLabelColor(row.color) ? row.color : 'gray',
  };
}

export function toProject(row: Tables<'projects'>): Project {
  return {
    id: row.id,
    workspaceId: row.workspace_id,
    teamId: row.team_id,
    name: row.name,
    status: row.status,
    leadId: row.lead_id,
    startDate: row.start_date,
    targetDate: row.target_date,
    sortKey: row.sort_key,
    archivedAt: row.archived_at,
    createdAt: row.created_at,
  };
}

export function toComment(
  row: Tables<'comments'> & { comment_reactions: { emoji: string; user_id: string }[] },
): Comment {
  return {
    id: row.id,
    taskId: row.task_id,
    parentId: row.parent_id,
    authorId: row.author_id,
    body: toDocument(row.body) ?? { type: 'doc', content: [] },
    createdAt: row.created_at,
    editedAt: row.edited_at,
    deletedAt: row.deleted_at,
    reactions: row.comment_reactions.map((r) => ({ emoji: r.emoji, userId: r.user_id })),
  };
}

export function toActivity(row: Tables<'activity'>): ActivityEntry {
  return {
    id: row.id,
    taskId: row.task_id,
    actorId: row.actor_id,
    kind: row.kind,
    data:
      typeof row.data === 'object' && row.data !== null && !Array.isArray(row.data) ? row.data : {},
    createdAt: row.created_at,
  };
}

export function toNotification(
  row: Tables<'notifications'> & {
    tasks: { title: string; number: number; team_id: string } | null;
  },
): Notification | null {
  if (!isNotificationKind(row.kind)) return null;
  return {
    id: row.id,
    workspaceId: row.workspace_id,
    taskId: row.task_id,
    task: row.tasks
      ? { title: row.tasks.title, number: row.tasks.number, teamId: row.tasks.team_id }
      : null,
    commentId: row.comment_id,
    actorId: row.actor_id,
    kind: row.kind,
    eventCount: row.event_count,
    readAt: row.read_at,
    snoozedUntil: row.snoozed_until,
    archivedAt: row.archived_at,
    createdAt: row.created_at,
  };
}
