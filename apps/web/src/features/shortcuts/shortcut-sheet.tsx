import { Dialog, DialogContent, DialogTitle, Input, Shortcut } from '@daiq/ui';
import { useState } from 'react';
import { SHORTCUTS, type ShortcutGroup } from './registry';

const GROUPS: ShortcutGroup[] = ['General', 'Navigation', 'Lists', 'Task', 'Inbox'];

/** The searchable `?` sheet, generated from the shortcut registry. */
export function ShortcutSheet({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const [query, setQuery] = useState('');
  const term = query.trim().toLowerCase();
  const entries = Object.values(SHORTCUTS).filter(
    (s) => !term || s.label.toLowerCase().includes(term) || s.keys.toLowerCase().includes(term),
  );
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="top-[10vh] max-h-[80vh] w-[min(100%-2rem,36rem)] gap-3 overflow-hidden">
        <DialogTitle>Keyboard shortcuts</DialogTitle>
        <Input
          placeholder="Search shortcuts"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          autoFocus
        />
        <div className="-mx-1 overflow-y-auto px-1 scrollbar-thin">
          {GROUPS.map((group) => {
            const items = entries.filter((s) => s.group === group);
            if (items.length === 0) return null;
            return (
              <section key={group} className="mb-4">
                <h3 className="mb-1 text-xs font-medium text-fg-subtle">{group}</h3>
                <ul>
                  {items.map((s) => (
                    <li key={s.label} className="flex h-8 items-center justify-between text-[13px]">
                      {s.label}
                      <Shortcut keys={s.keys} />
                    </li>
                  ))}
                </ul>
              </section>
            );
          })}
        </div>
        <p className="text-xs text-fg-subtle">
          Single-key shortcuts never fire while you type. You can turn them off in Settings →
          Preferences.
        </p>
      </DialogContent>
    </Dialog>
  );
}
