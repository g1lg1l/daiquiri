import { toast } from '@daiq/ui';
import { logger } from '../../lib/logger';

/*
 * Global undo stack (ux-principles.md: destructive actions are undoable rather
 * than confirmed). Every optimistic mutation that changes user data pushes its
 * inverse here; Mod+Z pops it.
 */
interface UndoEntry {
  label: string;
  undo: () => Promise<unknown> | void;
}

const MAX_ENTRIES = 50;
const stack: UndoEntry[] = [];

export function pushUndo(entry: UndoEntry, options: { toast?: string } = {}): void {
  stack.push(entry);
  if (stack.length > MAX_ENTRIES) stack.shift();
  if (options.toast) {
    toast(options.toast, { action: { label: 'Undo', onClick: () => void runUndo(entry) } });
  }
}

async function runUndo(entry: UndoEntry): Promise<void> {
  const index = stack.lastIndexOf(entry);
  if (index >= 0) stack.splice(index, 1);
  try {
    await entry.undo();
    toast(`Undid: ${entry.label}`, { id: 'undo' });
  } catch (error) {
    logger.error('undo.failed', error, { label: entry.label });
    toast.error('That change could not be undone.');
  }
}

export function undoLast(): void {
  const entry = stack.at(-1);
  if (entry) void runUndo(entry);
  else toast('Nothing to undo', { id: 'undo' });
}
