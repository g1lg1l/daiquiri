import { z } from 'zod';
import { statusCategorySchema } from './status';

/*
 * Automations (feature spec §12, ADR-0009). The JSON stored in the database
 * uses these shapes as they are; each action kind has a matching branch in
 * app.automation_action().
 */

const priority = z.number().int().min(0).max(4);

export const automationTriggerSchema = z.discriminatedUnion('kind', [
  z.object({ kind: z.literal('task_created') }),
  z.object({
    kind: z.literal('status_changed'),
    category: statusCategorySchema.optional(),
    status_id: z.uuid().optional(),
  }),
  z.object({ kind: z.literal('priority_changed'), priority: priority.optional() }),
  z.object({ kind: z.literal('assignee_added'), user_id: z.uuid().optional() }),
  z.object({ kind: z.literal('moved_to_project'), project_id: z.uuid().optional() }),
  z.object({ kind: z.literal('comment_added') }),
  z.object({ kind: z.literal('due_approaching'), days: z.number().int().min(0).max(30) }),
]);
export type AutomationTrigger = z.infer<typeof automationTriggerSchema>;
export type AutomationTriggerKind = AutomationTrigger['kind'];

export const automationConditionsSchema = z.object({
  priorities: z.array(priority).optional(),
  categories: z.array(statusCategorySchema).optional(),
  label_ids: z.array(z.uuid()).optional(),
  project_ids: z.array(z.union([z.uuid(), z.literal('none')])).optional(),
  assignee: z.enum(['any', 'none']).optional(),
});
export type AutomationConditions = z.infer<typeof automationConditionsSchema>;

export const automationActionSchema = z.discriminatedUnion('kind', [
  z.object({ kind: z.literal('set_status'), status_id: z.uuid() }),
  z.object({ kind: z.literal('set_priority'), priority }),
  z.object({ kind: z.literal('assign'), user_id: z.uuid() }),
  z.object({ kind: z.literal('unassign') }),
  z.object({ kind: z.literal('add_label'), label_id: z.uuid() }),
  z.object({ kind: z.literal('remove_label'), label_id: z.uuid() }),
  z.object({ kind: z.literal('set_project'), project_id: z.uuid().nullable() }),
  z.object({ kind: z.literal('set_due_date'), days: z.number().int().min(0).max(365) }),
  z.object({ kind: z.literal('create_subtask'), template_id: z.uuid() }),
  z.object({ kind: z.literal('notify'), user_ids: z.array(z.uuid()).min(1).max(20) }),
  z.object({ kind: z.literal('call_webhook'), webhook_id: z.uuid() }),
]);
export type AutomationAction = z.infer<typeof automationActionSchema>;
export type AutomationActionKind = AutomationAction['kind'];

export const automationInputSchema = z.object({
  name: z.string().trim().min(1).max(80),
  trigger: automationTriggerSchema,
  conditions: automationConditionsSchema,
  actions: z.array(automationActionSchema).min(1).max(3),
});
export type AutomationInput = z.infer<typeof automationInputSchema>;

export interface Automation extends AutomationInput {
  id: string;
  workspaceId: string;
  teamId: string;
  enabled: boolean;
  createdAt: string;
}

export interface AutomationRun {
  id: number;
  automationId: string;
  taskId: string | null;
  event: AutomationTriggerKind;
  status: 'succeeded' | 'failed';
  error: string | null;
  createdAt: string;
}

export const TRIGGER_LABEL: Record<AutomationTriggerKind, string> = {
  task_created: 'A task is created',
  status_changed: 'The status changes',
  priority_changed: 'The priority changes',
  assignee_added: 'Someone is assigned',
  moved_to_project: 'A task moves to a project',
  comment_added: 'Someone comments',
  due_approaching: 'A due date is near',
};

export const ACTION_LABEL: Record<AutomationActionKind, string> = {
  set_status: 'Set status',
  set_priority: 'Set priority',
  assign: 'Assign',
  unassign: 'Remove assignees',
  add_label: 'Add label',
  remove_label: 'Remove label',
  set_project: 'Move to project',
  set_due_date: 'Set due date',
  create_subtask: 'Add sub-tasks from template',
  notify: 'Notify',
  call_webhook: 'Call a webhook',
};

/** A blank action of the given kind, for the builder. */
export function emptyAction(kind: AutomationActionKind): Partial<AutomationAction> {
  switch (kind) {
    case 'set_priority':
      return { kind, priority: 2 };
    case 'set_due_date':
      return { kind, days: 3 };
    case 'set_project':
      return { kind, project_id: null };
    case 'notify':
      return { kind, user_ids: [] };
    case 'set_status':
    case 'assign':
    case 'unassign':
    case 'add_label':
    case 'remove_label':
    case 'create_subtask':
    case 'call_webhook':
      return { kind };
    default:
      return kind satisfies never;
  }
}

export const isAutomationTriggerKind = (value: string): value is AutomationTriggerKind =>
  Object.hasOwn(TRIGGER_LABEL, value);
