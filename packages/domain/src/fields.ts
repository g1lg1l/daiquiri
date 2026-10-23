import { parseIsoDate } from './dates';
import type { CustomField, CustomFieldKind, FieldValue, Task } from './model';

/*
 * Custom fields (feature spec §3.9): value checks, display, filtering and grouping.
 * The database validates values too; these checks keep the client honest and
 * let the view engine work on cached tasks.
 */

export const FIELD_KIND_LABEL: Record<CustomFieldKind, string> = {
  text: 'Text',
  number: 'Number',
  date: 'Date',
  select: 'Select',
  multi_select: 'Multi-select',
  person: 'Person',
  checkbox: 'Checkbox',
  url: 'URL',
};

/** Fields whose values make groups and filters: a small, closed set of values. */
export function isGroupableField(field: Pick<CustomField, 'kind'>): boolean {
  return ['select', 'multi_select', 'person', 'checkbox'].includes(field.kind);
}

export function isFieldValue(kind: CustomFieldKind, value: unknown): value is FieldValue {
  switch (kind) {
    case 'text':
    case 'url':
    case 'select':
    case 'person':
      return typeof value === 'string';
    case 'date':
      return typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value);
    case 'number':
      return typeof value === 'number' && Number.isFinite(value);
    case 'checkbox':
      return typeof value === 'boolean';
    case 'multi_select':
      return Array.isArray(value) && value.every((item) => typeof item === 'string');
    default:
      return false;
  }
}

/** A value's text for lists and chips; option and member ids become names. */
export function formatFieldValue(
  field: CustomField,
  value: FieldValue | undefined,
  members: ReadonlyMap<string, { displayName: string }>,
): string {
  if (value === undefined || value === '' || (Array.isArray(value) && value.length === 0))
    return '';
  const option = (id: string) => field.options.find((o) => o.id === id)?.name ?? '…';
  switch (field.kind) {
    case 'select':
      return typeof value === 'string' ? option(value) : '';
    case 'multi_select':
      return Array.isArray(value) ? value.map(option).join(', ') : '';
    case 'person':
      return typeof value === 'string' ? (members.get(value)?.displayName ?? 'Former member') : '';
    case 'checkbox':
      return value === true ? 'Yes' : 'No';
    case 'date':
      return typeof value === 'string'
        ? parseIsoDate(value).toLocaleDateString(undefined, {
            day: 'numeric',
            month: 'short',
            year: 'numeric',
          })
        : '';
    case 'text':
    case 'number':
    case 'url':
      return String(value);
    default:
      return field.kind satisfies never;
  }
}

/** The comparable keys of a value: option ids, member id, "true"/"false". */
export function fieldKeys(value: FieldValue | undefined): string[] {
  if (value === undefined) return [];
  if (Array.isArray(value)) return value;
  return [String(value)];
}

/** Filter entries are "fieldId:value"; the value "none" matches tasks without one. */
export function parseFieldFilter(entries: readonly string[]): Map<string, string[]> {
  const byField = new Map<string, string[]>();
  for (const entry of entries) {
    const separator = entry.indexOf(':');
    if (separator <= 0) continue;
    const field = entry.slice(0, separator);
    byField.set(field, [...(byField.get(field) ?? []), entry.slice(separator + 1)]);
  }
  return byField;
}

/** Any of the wanted values (OR within a field); every field must match (AND across fields). */
export function matchesFieldFilters(
  task: Pick<Task, 'fields'>,
  filters: ReadonlyMap<string, readonly string[]>,
  userId: string,
): boolean {
  for (const [field, wanted] of filters) {
    const keys = fieldKeys(task.fields[field]);
    const ok = wanted.some((want) =>
      want === 'none' ? keys.length === 0 : keys.includes(want === 'me' ? userId : want),
    );
    if (!ok) return false;
  }
  return true;
}
