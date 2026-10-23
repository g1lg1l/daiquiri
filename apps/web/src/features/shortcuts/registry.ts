import { m } from '../../i18n';

/*
 * Single source of truth for keyboard shortcuts (docs/product/keyboard-navigation.md).
 * The `?` sheet, menus, tooltips and the command palette read their hints from here;
 * names live in the dictionary (`shortcutLabel`) so they follow the active language.
 */
export type ShortcutGroup = 'General' | 'Navigation' | 'Lists' | 'Task' | 'Inbox';

export interface ShortcutDefinition {
  keys: string;
  group: ShortcutGroup;
}

export const SHORTCUTS = {
  palette: { keys: 'Mod+K', group: 'General' },
  search: { keys: '/', group: 'General' },
  create: { keys: 'C', group: 'General' },
  help: { keys: '?', group: 'General' },
  toggleSidebar: { keys: '[', group: 'General' },
  undo: { keys: 'Mod+Z', group: 'General' },
  goInbox: { keys: 'G I', group: 'Navigation' },
  goMyTasks: { keys: 'G M', group: 'Navigation' },
  goTeam: { keys: 'G T', group: 'Navigation' },
  goProjects: { keys: 'G P', group: 'Navigation' },
  goSettings: { keys: 'G S', group: 'Navigation' },
  next: { keys: 'J', group: 'Lists' },
  previous: { keys: 'K', group: 'Lists' },
  open: { keys: 'Enter', group: 'Lists' },
  peek: { keys: 'Space', group: 'Lists' },
  select: { keys: 'X', group: 'Lists' },
  selectAll: { keys: 'Mod+A', group: 'Lists' },
  moveUp: { keys: 'Mod+ArrowUp', group: 'Lists' },
  moveDown: { keys: 'Mod+ArrowDown', group: 'Lists' },
  toggleLayout: { keys: 'Mod+B', group: 'Lists' },
  filter: { keys: 'F', group: 'Lists' },
  display: { keys: 'Shift+V', group: 'Lists' },
  status: { keys: 'S', group: 'Task' },
  priority: { keys: 'P', group: 'Task' },
  assignee: { keys: 'A', group: 'Task' },
  assignMe: { keys: 'I', group: 'Task' },
  labels: { keys: 'L', group: 'Task' },
  dueDate: { keys: 'D', group: 'Task' },
  project: { keys: 'Shift+P', group: 'Task' },
  estimate: { keys: 'Shift+E', group: 'Task' },
  cycle: { keys: 'Shift+C', group: 'Task' },
  rename: { keys: 'E', group: 'Task' },
  subtask: { keys: 'Mod+Shift+O', group: 'Task' },
  copyId: { keys: 'Mod+.', group: 'Task' },
  copyLink: { keys: 'Mod+Shift+L', group: 'Task' },
  remove: { keys: 'Mod+Backspace', group: 'Task' },
  comment: { keys: 'M', group: 'Task' },
  subscribe: { keys: 'Shift+S', group: 'Task' },
  toggleRead: { keys: 'U', group: 'Inbox' },
  archive: { keys: 'Backspace', group: 'Inbox' },
  snooze: { keys: 'H', group: 'Inbox' },
} as const satisfies Record<string, ShortcutDefinition>;

export type ShortcutId = keyof typeof SHORTCUTS;

export function shortcutLabel(id: ShortcutId): string {
  return m.shell.shortcuts.labels[id];
}

export function isShortcutId(id: string): id is ShortcutId {
  return Object.hasOwn(SHORTCUTS, id);
}
