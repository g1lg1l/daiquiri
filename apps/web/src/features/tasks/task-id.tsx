import { cn, Tooltip } from '@daiq/ui';
import { CheckIcon } from 'lucide-react';
import { useState } from 'react';
import { copyText } from '../../lib/clipboard';
import { SHORTCUTS } from '../shortcuts/registry';

/**
 * A task's identifier ("ENG-12"). Clicking it copies it; Mod+. does the same
 * for the focused task. Out of the tab order inside rows and cards, which
 * have their own keyboard model.
 */
export function TaskId({
  identifier,
  className,
  tabbable = false,
}: {
  identifier: string;
  className?: string;
  tabbable?: boolean;
}) {
  const [copied, setCopied] = useState(false);
  return (
    <Tooltip label="Copy ID" shortcut={SHORTCUTS.copyId.keys}>
      <button
        type="button"
        tabIndex={tabbable ? undefined : -1}
        aria-label={`Copy ${identifier}`}
        onClick={(event) => {
          event.stopPropagation();
          copyText(identifier, `Copied ${identifier}`);
          setCopied(true);
          setTimeout(() => setCopied(false), 1400);
        }}
        className={cn(
          'inline-flex shrink-0 items-center gap-1 rounded-sm font-mono text-xs text-fg-subtle tabular transition-colors hover:text-fg hover:underline hover:decoration-dotted hover:underline-offset-2',
          className,
        )}
      >
        {identifier}
        {copied && <CheckIcon aria-hidden className="size-3 animate-pop text-accent-text" />}
      </button>
    </Tooltip>
  );
}
