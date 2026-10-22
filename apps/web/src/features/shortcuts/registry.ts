/*
 * Single source of truth for keyboard shortcuts (docs/product/keyboard-navigation.md).
 * The `?` sheet, menus, tooltips and the command palette read their hints from here.
 */
export type ShortcutGroup = 'General' | 'Navigation' | 'Lists' | 'Task' | 'Inbox';

export interface ShortcutDefinition {
  keys: string;
  label: string;
  group: ShortcutGroup;
}

export const SHORTCUTS = {
  palette: { keys: 'Mod+K', label: 'Open command palette', group: 'General' },
  search: { keys: '/', label: 'Search', group: 'General' },
  create: { keys: 'C', label: 'Create task', group: 'General' },
  help: { keys: '?', label: 'Keyboard shortcuts', group: 'General' },
  toggleSidebar: { keys: '[', label: 'Toggle sidebar', group: 'General' },
  undo: { keys: 'Mod+Z', label: 'Undo', group: 'General' },
  goInbox: { keys: 'G I', label: 'Go to inbox', group: 'Navigation' },
  goMyTasks: { keys: 'G M', label: 'Go to my tasks', group: 'Navigation' },
  goTeam: { keys: 'G T', label: 'Go to team tasks', group: 'Navigation' },
  goProjects: { keys: 'G P', label: 'Go to projects', group: 'Navigation' },
  goSettings: { keys: 'G S', label: 'Go to settings', group: 'Navigation' },
  next: { keys: 'J', label: 'Next item', group: 'Lists' },
  previous: { keys: 'K', label: 'Previous item', group: 'Lists' },
  open: { keys: 'Enter', label: 'Open', group: 'Lists' },
  peek: { keys: 'Space', label: 'Peek', group: 'Lists' },
  select: { keys: 'X', label: 'Select', group: 'Lists' },
  selectAll: { keys: 'Mod+A', label: 'Select all', group: 'Lists' },
  moveUp: { keys: 'Mod+ArrowUp', label: 'Move up', group: 'Lists' },
  moveDown: { keys: 'Mod+ArrowDown', label: 'Move down', group: 'Lists' },
  toggleLayout: { keys: 'Mod+B', label: 'Switch list / board', group: 'Lists' },
  filter: { keys: 'F', label: 'Add filter', group: 'Lists' },
  display: { keys: 'Shift+V', label: 'Display options', group: 'Lists' },
  status: { keys: 'S', label: 'Change status', group: 'Task' },
  priority: { keys: 'P', label: 'Change priority', group: 'Task' },
  assignee: { keys: 'A', label: 'Change assignees', group: 'Task' },
  assignMe: { keys: 'I', label: 'Assign to me', group: 'Task' },
  labels: { keys: 'L', label: 'Change labels', group: 'Task' },
  dueDate: { keys: 'D', label: 'Set due date', group: 'Task' },
  project: { keys: 'Shift+P', label: 'Move to project', group: 'Task' },
  rename: { keys: 'E', label: 'Edit title', group: 'Task' },
  subtask: { keys: 'Mod+Shift+O', label: 'Add sub-task', group: 'Task' },
  copyLink: { keys: 'Mod+.', label: 'Copy link', group: 'Task' },
  remove: { keys: 'Mod+Backspace', label: 'Delete', group: 'Task' },
  comment: { keys: 'M', label: 'Comment', group: 'Task' },
  subscribe: { keys: 'Shift+S', label: 'Subscribe / unsubscribe', group: 'Task' },
  toggleRead: { keys: 'U', label: 'Mark read / unread', group: 'Inbox' },
  archive: { keys: 'Backspace', label: 'Archive notification', group: 'Inbox' },
  snooze: { keys: 'H', label: 'Snooze', group: 'Inbox' },
} as const satisfies Record<string, ShortcutDefinition>;

export type ShortcutId = keyof typeof SHORTCUTS;

export function isShortcutId(id: string): id is ShortcutId {
  return Object.hasOwn(SHORTCUTS, id);
}
