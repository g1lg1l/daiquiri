import { useSetFieldValue } from '@daiq/data';
import {
  fieldKeys,
  formatFieldValue,
  type CustomField,
  type FieldValue,
  type Task,
} from '@daiq/domain';
import { Button, cn } from '@daiq/ui';
import { CircleDashedIcon, ExternalLinkIcon } from 'lucide-react';
import { useState } from 'react';
import { m } from '../../i18n';
import { memberOptions, NO_VALUE } from '../pickers/options';
import { PickerPopover } from '../pickers/picker-popover';
import { useWorkspace, useWorkspaceData } from '../workspace/workspace-context';
import { DateField } from './task-actions';

const ghost = 'h-7 w-full justify-start px-2 text-[13px] font-normal';
const input =
  'h-7 w-full rounded-md border border-transparent bg-transparent px-2 text-[13px] outline-none hover:border-border focus:border-focus';

/** A text-like value edited in place and saved on blur or Enter. */
function InlineInput({
  field,
  value,
  type,
  onCommit,
}: {
  field: CustomField;
  value: string;
  type: 'text' | 'number' | 'url';
  onCommit: (raw: string) => void;
}) {
  const [draft, setDraft] = useState(value);
  const [synced, setSynced] = useState(value);
  // Adopt remote changes without an effect.
  if (value !== synced) {
    setSynced(value);
    setDraft(value);
  }
  return (
    <input
      type={type}
      aria-label={field.name}
      value={draft}
      placeholder={m.task.fields.empty}
      onChange={(event) => setDraft(event.target.value)}
      onBlur={() => draft !== value && onCommit(draft.trim())}
      onKeyDown={(event) => {
        if (event.key === 'Enter') event.currentTarget.blur();
        if (event.key === 'Escape') setDraft(value);
      }}
      className={cn(input, 'placeholder:text-fg-subtle', type === 'number' && 'tabular')}
    />
  );
}

/** The editor for one custom field of a task, by kind (feature spec §3.9). */
export function FieldEditor({ field, task }: { field: CustomField; task: Task }) {
  const { userId } = useWorkspace();
  const data = useWorkspaceData();
  const setField = useSetFieldValue();
  const value = task.fields[field.id];
  const save = (next: FieldValue | null) =>
    setField.mutate({ task, fieldId: field.id, value: next });
  const text = formatFieldValue(field, value, data.membersById);
  const empty = <span className="text-fg-subtle">{m.task.fields.empty}</span>;

  switch (field.kind) {
    case 'text':
      return (
        <InlineInput
          field={field}
          type="text"
          value={typeof value === 'string' ? value : ''}
          onCommit={(raw) => save(raw || null)}
        />
      );
    case 'number':
      return (
        <InlineInput
          field={field}
          type="number"
          value={typeof value === 'number' ? String(value) : ''}
          onCommit={(raw) => {
            const number = Number(raw);
            save(raw === '' || !Number.isFinite(number) ? null : number);
          }}
        />
      );
    case 'url':
      return (
        <span className="flex w-full items-center gap-1">
          <InlineInput
            field={field}
            type="url"
            value={typeof value === 'string' ? value : ''}
            onCommit={(raw) => save(/^https?:\/\//i.test(raw) ? raw : null)}
          />
          {typeof value === 'string' && /^https?:\/\//i.test(value) && (
            <a
              href={value}
              target="_blank"
              rel="noreferrer noopener"
              aria-label={m.task.fields.open(field.name)}
              className="flex size-6 shrink-0 items-center justify-center rounded-md text-fg-muted hover:bg-surface-muted hover:text-fg"
            >
              <ExternalLinkIcon className="size-3.5" />
            </a>
          )}
        </span>
      );
    case 'date':
      return (
        <DateField
          label={field.name}
          value={typeof value === 'string' ? value : null}
          onChange={(date) => save(date)}
        />
      );
    case 'checkbox':
      return (
        <label className="flex h-7 items-center gap-2 px-2 text-[13px]">
          <input
            type="checkbox"
            checked={value === true}
            onChange={(event) => save(event.target.checked)}
            className="accent-(--accent)"
          />
          {value === true ? m.task.fields.yes : m.task.fields.no}
        </label>
      );
    case 'select':
    case 'multi_select':
    case 'person': {
      const options =
        field.kind === 'person'
          ? memberOptions(data.members, userId)
          : field.options.map((o) => ({ value: o.id, label: o.name }));
      const multiple = field.kind === 'multi_select';
      return (
        <PickerPopover
          trigger={
            <Button
              variant="ghost"
              size="sm"
              className={ghost}
              aria-label={`${field.name}: ${text || m.task.fields.emptyValue}`}
            >
              {text ? <span className="truncate">{text}</span> : empty}
            </Button>
          }
          multiple={multiple}
          options={
            multiple
              ? options
              : [
                  {
                    value: NO_VALUE,
                    label: m.task.fields.none(field.name),
                    icon: <CircleDashedIcon />,
                  },
                  ...options,
                ]
          }
          selected={multiple ? fieldKeys(value) : [fieldKeys(value)[0] ?? NO_VALUE]}
          placeholder={`${field.name}…`}
          onSelect={(ids) =>
            multiple ? save(ids) : save(ids[0] && ids[0] !== NO_VALUE ? ids[0] : null)
          }
        />
      );
    }
    default:
      return null;
  }
}
