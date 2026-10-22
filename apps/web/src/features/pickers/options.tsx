import {
  PRIORITY_LABEL,
  sortStatuses,
  type Label,
  type Member,
  type Priority,
  type Project,
  type Status,
} from '@daiq/domain';
import { Avatar } from '@daiq/ui';
import { CircleDashedIcon, FolderIcon } from 'lucide-react';
import { PriorityIcon, StatusIcon } from '../tasks/icons';
import { LABEL_COLOR } from '../tasks/label-colors';
import type { PickerOption } from './picker-list';

export const NO_VALUE = '__none__';

export function statusOptions(statuses: readonly Status[]): PickerOption[] {
  return sortStatuses(statuses).map((status) => ({
    value: status.id,
    label: status.name,
    icon: <StatusIcon category={status.category} />,
    keywords: [status.category],
  }));
}

const PRIORITY_ORDER: Priority[] = [1, 2, 3, 4, 0];

export function priorityOptions(): PickerOption[] {
  return PRIORITY_ORDER.map((priority) => ({
    value: String(priority),
    label: PRIORITY_LABEL[priority],
    icon: <PriorityIcon priority={priority} />,
    hint: String(priority),
  }));
}

export function memberOptions(members: readonly Member[], userId: string): PickerOption[] {
  const me = members.filter((m) => m.id === userId);
  const others = members.filter((m) => m.id !== userId && m.role !== 'guest');
  const guests = members.filter((m) => m.id !== userId && m.role === 'guest');
  return [...me, ...others, ...guests].map((member) => ({
    value: member.id,
    label: member.id === userId ? `${member.displayName} (you)` : member.displayName,
    icon: <Avatar name={member.displayName} src={member.avatarUrl} size="sm" />,
    keywords: member.id === userId ? ['me'] : [],
  }));
}

export function labelOptions(labels: readonly Label[]): PickerOption[] {
  return labels.map((label) => ({
    value: label.id,
    label: label.name,
    icon: (
      <span className="size-2.5 rounded-full" style={{ background: LABEL_COLOR[label.color] }} />
    ),
  }));
}

export function projectOptions(projects: readonly Project[]): PickerOption[] {
  return [
    { value: NO_VALUE, label: 'No project', icon: <CircleDashedIcon /> },
    ...projects
      .filter((project) => !project.archivedAt)
      .map((project) => ({ value: project.id, label: project.name, icon: <FolderIcon /> })),
  ];
}
