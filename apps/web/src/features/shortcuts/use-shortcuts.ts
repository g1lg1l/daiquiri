import { useEffect, useEffectEvent } from 'react';
import { register, type Handlers } from './keyboard';
import { isShortcutId, type ShortcutId } from './registry';

/**
 * Registers shortcut handlers while the component is mounted. Handlers always
 * see the latest props/state without re-registering.
 */
export function useShortcuts(handlers: Handlers, active = true): void {
  const ids = Object.keys(handlers).sort().join(',');
  const call = useEffectEvent((id: ShortcutId, event: KeyboardEvent) => handlers[id]?.(event));
  useEffect(() => {
    if (!active) return;
    const stable: Handlers = {};
    for (const id of ids.split(',')) {
      if (isShortcutId(id)) stable[id] = (event) => call(id, event);
    }
    return register(stable);
  }, [ids, active]);
}
