import type { WorkspaceRole } from './permissions';
import type { Priority } from './priority';
import type { StatusCategory } from './status';

/*
 * Domain model used by the UI. Database rows (snake_case, generated types) are
 * mapped into these shapes in @daiq/data, so database naming never leaks into
 * components and domain functions work on one well-defined model.
 */

/** JSON value; structurally identical to the database `Json` type. */
export type JsonValue =
  string | number | boolean | null | { [key: string]: JsonValue | undefined } | JsonValue[];

/** ProseMirror JSON document (ADR-0005). Validated structurally by the editor schema. */
export type RichDocument = { type: 'doc'; content?: JsonValue[] };

export function isRichDocument(value: unknown): value is RichDocument {
  return (
    typeof value === 'object' &&
    value !== null &&
    !Array.isArray(value) &&
    'type' in value &&
    value.type === 'doc' &&
    (!('content' in value) || Array.isArray(value.content))
  );
}

export interface Profile {
  id: string;
  displayName: string;
  avatarUrl: string | null;
}

export interface Workspace {
  id: string;
  slug: string;
  name: string;
  isDemo: boolean;
  role: WorkspaceRole;
}

export interface Member extends Profile {
  role: WorkspaceRole;
  joinedAt: string;
}

export interface Status {
  id: string;
  teamId: string;
  name: string;
  category: StatusCategory;
  position: number;
}

export const ESTIMATE_SCALES = ['points', 'hours'] as const;
export type EstimateScale = (typeof ESTIMATE_SCALES)[number];
export const isEstimateScale = (value: string): value is EstimateScale =>
  (ESTIMATE_SCALES as readonly string[]).includes(value);

export interface Cycle {
  id: string;
  workspaceId: string;
  teamId: string;
  number: number;
  name: string | null;
  /** First and last day, inclusive (ISO calendar dates). */
  startsOn: string;
  endsOn: string;
  completedAt: string | null;
}

export interface Milestone {
  id: string;
  workspaceId: string;
  teamId: string;
  projectId: string;
  name: string;
  targetDate: string | null;
  sortKey: string;
}

export const PROJECT_HEALTH = ['on_track', 'at_risk', 'off_track'] as const;
export type ProjectHealth = (typeof PROJECT_HEALTH)[number];
export const isProjectHealth = (value: string): value is ProjectHealth =>
  (PROJECT_HEALTH as readonly string[]).includes(value);
export const PROJECT_HEALTH_LABEL: Record<ProjectHealth, string> = {
  on_track: 'On track',
  at_risk: 'At risk',
  off_track: 'Off track',
};

export interface ProjectUpdate {
  id: string;
  projectId: string;
  authorId: string | null;
  health: ProjectHealth;
  body: RichDocument | null;
  createdAt: string;
  updatedAt: string;
}

export interface Team {
  id: string;
  workspaceId: string;
  key: string;
  name: string;
  description: string | null;
  isPrivate: boolean;
  cyclesEnabled: boolean;
  /** Cycle length in weeks (1–4) and start weekday (0 = Sunday … 6 = Saturday). */
  cycleWeeks: number;
  cycleStartWeekday: number;
  estimatesEnabled: boolean;
  estimateScale: EstimateScale;
  triageEnabled: boolean;
  memberIds: string[];
  statuses: Status[];
}

export const LABEL_COLORS = [
  'gray',
  'red',
  'orange',
  'amber',
  'lime',
  'green',
  'teal',
  'blue',
  'indigo',
  'violet',
  'pink',
] as const;
export type LabelColor = (typeof LABEL_COLORS)[number];

export function isLabelColor(value: string): value is LabelColor {
  return (LABEL_COLORS as readonly string[]).includes(value);
}

export interface Label {
  id: string;
  workspaceId: string;
  name: string;
  color: LabelColor;
}

export type ProjectStatus = 'planned' | 'active' | 'paused' | 'completed' | 'canceled';

export interface Project {
  id: string;
  workspaceId: string;
  teamId: string;
  name: string;
  status: ProjectStatus;
  leadId: string | null;
  startDate: string | null;
  targetDate: string | null;
  sortKey: string;
  archivedAt: string | null;
  createdAt: string;
}

export interface Task {
  id: string;
  workspaceId: string;
  teamId: string;
  /** Null while an optimistic creation is pending (the server assigns it). */
  number: number | null;
  title: string;
  statusId: string;
  priority: Priority;
  projectId: string | null;
  parentId: string | null;
  creatorId: string | null;
  /** ISO calendar dates (YYYY-MM-DD). */
  startDate: string | null;
  dueDate: string | null;
  estimate: number | null;
  cycleId: string | null;
  milestoneId: string | null;
  sortKey: string;
  completedAt: string | null;
  canceledAt: string | null;
  createdAt: string;
  updatedAt: string;
  assigneeIds: string[];
  labelIds: string[];
}

export interface TaskDetail extends Task {
  description: RichDocument | null;
}

/** Fields a user can change on a task through a plain update. */
export type TaskPatch = Partial<
  Pick<
    TaskDetail,
    | 'title'
    | 'description'
    | 'statusId'
    | 'priority'
    | 'projectId'
    | 'parentId'
    | 'startDate'
    | 'dueDate'
    | 'estimate'
    | 'cycleId'
    | 'milestoneId'
    | 'sortKey'
  >
>;

export type RelationKind = 'blocks' | 'related' | 'duplicate';

export interface TaskRelation {
  id: string;
  taskId: string;
  relatedTaskId: string;
  kind: RelationKind;
}

export interface Comment {
  id: string;
  taskId: string;
  parentId: string | null;
  authorId: string | null;
  body: RichDocument;
  createdAt: string;
  editedAt: string | null;
  deletedAt: string | null;
  reactions: { emoji: string; userId: string }[];
}

export interface ActivityEntry {
  id: number;
  taskId: string | null;
  actorId: string | null;
  kind: string;
  data: Record<string, unknown>;
  createdAt: string;
}

export const NOTIFICATION_KINDS = [
  'assigned',
  'mention',
  'comment',
  'status',
  'unblocked',
] as const;
export type NotificationKind = (typeof NOTIFICATION_KINDS)[number];

export function isNotificationKind(value: string): value is NotificationKind {
  return (NOTIFICATION_KINDS as readonly string[]).includes(value);
}

export interface Notification {
  id: string;
  workspaceId: string;
  taskId: string | null;
  task: { title: string; number: number; teamId: string } | null;
  commentId: string | null;
  actorId: string | null;
  kind: NotificationKind;
  eventCount: number;
  readAt: string | null;
  snoozedUntil: string | null;
  archivedAt: string | null;
  createdAt: string;
}

export const SEARCH_RESULT_KINDS = ['task', 'project', 'person', 'label'] as const;
export type SearchResultKind = (typeof SEARCH_RESULT_KINDS)[number];

export function isSearchResultKind(value: string): value is SearchResultKind {
  return (SEARCH_RESULT_KINDS as readonly string[]).includes(value);
}

export interface SearchResult {
  kind: SearchResultKind;
  id: string;
  title: string;
  subtitle: string | null;
  rank: number;
}
