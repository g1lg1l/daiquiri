import { isShortcutId, SHORTCUTS, type ShortcutId } from './registry';

/*
 * Global keyboard dispatcher. Screens register handler maps; the most recently
 * registered (innermost) handler for a shortcut wins. Single-key shortcuts never
 * fire while the user is typing; sequences ("G I") wait up to one second.
 */

export type Handlers = Partial<Record<ShortcutId, (event: KeyboardEvent) => void>>;

const SEQUENCE_TIMEOUT_MS = 1000;
const isApple =
  typeof navigator !== 'undefined' &&
  /Mac|iPhone|iPad/.test(navigator.platform || navigator.userAgent);

/** Normalises a keyboard event into the registry notation ("Mod+Shift+O", "G", "?"). */
export function eventToKeys(event: KeyboardEvent): string {
  const parts: string[] = [];
  if (isApple ? event.metaKey : event.ctrlKey) parts.push('Mod');
  if (event.altKey) parts.push('Alt');
  let key = event.key === ' ' ? 'Space' : event.key;
  if (key.length === 1) {
    key = key.toUpperCase();
    // Shift is implied by the character for symbols such as "?".
    if (event.shiftKey && /[A-Z]/.test(key)) parts.push('Shift');
  } else if (event.shiftKey) {
    parts.push('Shift');
  }
  parts.push(key);
  return parts.join('+');
}

export function isTypingTarget(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false;
  return (
    target.isContentEditable ||
    target.tagName === 'INPUT' ||
    target.tagName === 'TEXTAREA' ||
    target.tagName === 'SELECT' ||
    target.closest('[role="dialog"] [cmdk-input], [role="listbox"]') !== null
  );
}

export const SHORTCUTS_DISABLED_KEY = 'daiq-shortcuts-disabled';

function readEnabled(): boolean {
  try {
    return localStorage.getItem(SHORTCUTS_DISABLED_KEY) !== '1';
  } catch {
    return true;
  }
}

const registrations: Handlers[] = [];
let pendingPrefix: string | null = null;
let prefixTimer: ReturnType<typeof setTimeout> | undefined;
let enabled = typeof window === 'undefined' ? true : readEnabled();

const sequencePrefixes = new Set(
  Object.values(SHORTCUTS).flatMap((s) => (s.keys.includes(' ') ? [s.keys.split(' ')[0]!] : [])),
);
const byKeys = new Map<string, ShortcutId[]>();
for (const [id, definition] of Object.entries(SHORTCUTS)) {
  if (!isShortcutId(id)) continue;
  const ids = byKeys.get(definition.keys) ?? [];
  ids.push(id);
  byKeys.set(definition.keys, ids);
}

function dispatch(keys: string, event: KeyboardEvent): boolean {
  const ids = byKeys.get(keys);
  if (!ids) return false;
  for (let i = registrations.length - 1; i >= 0; i--) {
    for (const id of ids) {
      const handler = registrations[i]?.[id];
      if (handler) {
        event.preventDefault();
        handler(event);
        return true;
      }
    }
  }
  return false;
}

function onKeyDown(event: KeyboardEvent): void {
  if (event.defaultPrevented || event.isComposing) return;
  const keys = eventToKeys(event);
  const hasModifier = keys.includes('Mod+');
  // WCAG 2.1.4: when disabled, only modifier shortcuts remain active.
  if (!enabled && !hasModifier) return;
  if (isTypingTarget(event.target) && !hasModifier) return;

  if (pendingPrefix) {
    const sequence = `${pendingPrefix} ${keys}`;
    pendingPrefix = null;
    clearTimeout(prefixTimer);
    if (dispatch(sequence, event)) return;
  }
  if (dispatch(keys, event)) return;
  if (sequencePrefixes.has(keys)) {
    pendingPrefix = keys;
    prefixTimer = setTimeout(() => (pendingPrefix = null), SEQUENCE_TIMEOUT_MS);
  }
}

if (typeof window !== 'undefined') window.addEventListener('keydown', onKeyDown);

export function register(handlers: Handlers): () => void {
  registrations.push(handlers);
  return () => {
    const index = registrations.lastIndexOf(handlers);
    if (index >= 0) registrations.splice(index, 1);
  };
}

/** WCAG 2.1.4: users can turn single-key shortcuts off (Preferences → Keyboard). */
export function setShortcutsEnabled(value: boolean): void {
  enabled = value;
}
