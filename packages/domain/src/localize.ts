import {
  ACTION_LABEL,
  TRIGGER_LABEL,
  type AutomationActionKind,
  type AutomationTriggerKind,
} from './automation';
import { DUE_BUCKET_LABEL, type DueBucket } from './dates';
import { FIELD_KIND_LABEL } from './fields';
import { IMPORT_TARGET_LABEL, type ImportTarget } from './import';
import { PROJECT_HEALTH_LABEL, type CustomFieldKind, type ProjectHealth } from './model';
import { PRIORITY_LABEL, type Priority } from './priority';
import { shortWeekdays, WEEKDAY_SHORT } from './recurrence';
import { STATUS_CATEGORY_LABEL, type StatusCategory } from './status';
import { words, type DomainWords } from './text';
import { WEBHOOK_EVENT_LABEL, type WebhookEvent } from './webhooks';

/** Everything the domain shows to people, in one language. */
export interface DomainTexts extends DomainWords {
  priority: Record<Priority, string>;
  statusCategory: Record<StatusCategory, string>;
  projectHealth: Record<ProjectHealth, string>;
  dueBucket: Record<DueBucket, string>;
  fieldKind: Record<CustomFieldKind, string>;
  trigger: Record<AutomationTriggerKind, string>;
  action: Record<AutomationActionKind, string>;
  webhookEvent: Record<WebhookEvent, string>;
  importTarget: Record<ImportTarget, string>;
}

/**
 * Switches the domain's labels and words to another language. The label maps
 * change in place, so every import stays valid; call it before the first render.
 */
export function localizeDomain(texts: DomainTexts, locale: string): void {
  const {
    priority,
    statusCategory,
    projectHealth,
    dueBucket,
    fieldKind,
    trigger,
    action,
    webhookEvent,
    importTarget,
    ...rest
  } = texts;
  Object.assign(PRIORITY_LABEL, priority);
  Object.assign(STATUS_CATEGORY_LABEL, statusCategory);
  Object.assign(PROJECT_HEALTH_LABEL, projectHealth);
  Object.assign(DUE_BUCKET_LABEL, dueBucket);
  Object.assign(FIELD_KIND_LABEL, fieldKind);
  Object.assign(TRIGGER_LABEL, trigger);
  Object.assign(ACTION_LABEL, action);
  Object.assign(WEBHOOK_EVENT_LABEL, webhookEvent);
  Object.assign(IMPORT_TARGET_LABEL, importTarget);
  Object.assign(words, rest, { locale });
  WEEKDAY_SHORT.splice(0, WEEKDAY_SHORT.length, ...shortWeekdays(locale));
}
