import { computePosition, flip, offset, shift } from '@floating-ui/dom';
import type { Editor, Range } from '@tiptap/core';
import { ReactRenderer } from '@tiptap/react';
import type {
  SuggestionKeyDownProps,
  SuggestionOptions,
  SuggestionProps,
} from '@tiptap/suggestion';
import { cn } from '@daiq/ui';
import { forwardRef, useImperativeHandle, useState, type ReactNode } from 'react';

export interface SuggestionItem {
  id: string;
  title: string;
  hint?: string;
  icon?: ReactNode;
}

interface ListProps {
  items: SuggestionItem[];
  command: (item: SuggestionItem) => void;
  label: string;
}

export interface ListHandle {
  onKeyDown: (event: KeyboardEvent) => boolean;
}

const SuggestionList = forwardRef<ListHandle, ListProps>(function SuggestionList(
  { items, command, label },
  ref,
) {
  const [index, setIndex] = useState(0);
  const [shownItems, setShownItems] = useState(items);
  // A new result set starts at the top again (derived during render, no effect).
  if (items !== shownItems) {
    setShownItems(items);
    setIndex(0);
  }
  useImperativeHandle(ref, () => ({
    onKeyDown: (event) => {
      if (event.key === 'ArrowDown') {
        setIndex((i) => (i + 1) % Math.max(items.length, 1));
        return true;
      }
      if (event.key === 'ArrowUp') {
        setIndex((i) => (i - 1 + items.length) % Math.max(items.length, 1));
        return true;
      }
      if (event.key === 'Enter' || event.key === 'Tab') {
        const item = items[index];
        if (item) command(item);
        return Boolean(item);
      }
      return false;
    },
  }));
  if (items.length === 0) return null;
  return (
    <div
      role="listbox"
      aria-label={label}
      className="max-h-72 w-64 overflow-y-auto rounded-lg border border-border bg-overlay p-1 text-[13px] text-fg shadow-popover"
    >
      {items.map((item, i) => (
        <button
          type="button"
          role="option"
          aria-selected={i === index}
          key={item.id}
          onMouseDown={(event) => {
            event.preventDefault();
            command(item);
          }}
          onMouseEnter={() => setIndex(i)}
          className={cn(
            'flex h-8 w-full items-center gap-2 rounded-md px-2 text-left [&_svg]:size-4 [&_svg]:text-fg-muted',
            i === index && 'bg-surface-muted',
          )}
        >
          {item.icon}
          <span className="flex-1 truncate">{item.title}</span>
          {item.hint && <span className="text-xs text-fg-subtle">{item.hint}</span>}
        </button>
      ))}
    </div>
  );
});

/** Tiptap suggestion renderer: a floating React list positioned with floating-ui. */
export function suggestionRenderer<I extends SuggestionItem, S>(
  label: string,
  toSelected: (item: I) => S,
): SuggestionOptions<I, S>['render'] {
  // The list works on plain items; map the chosen one back to the typed item by id.
  const commandFor = (props: SuggestionProps<I, S>) => (item: SuggestionItem) => {
    const chosen = props.items.find((candidate) => candidate.id === item.id);
    if (chosen) props.command(toSelected(chosen));
  };
  return () => {
    let renderer: ReactRenderer<ListHandle, ListProps> | null = null;
    let element: HTMLElement | null = null;

    const position = (props: SuggestionProps<I, S>) => {
      const rect = props.clientRect?.();
      if (!element || !rect) return;
      const virtual = { getBoundingClientRect: () => rect };
      void computePosition(virtual, element, {
        placement: 'bottom-start',
        middleware: [offset(6), flip(), shift({ padding: 8 })],
      }).then(({ x, y }) =>
        element ? Object.assign(element.style, { left: `${x}px`, top: `${y}px` }) : null,
      );
    };

    return {
      onStart: (props) => {
        renderer = new ReactRenderer(SuggestionList, {
          props: { items: props.items, command: commandFor(props), label },
          editor: props.editor,
        });
        element = renderer.element;
        Object.assign(element.style, { position: 'fixed', zIndex: '60' });
        document.body.append(element);
        position(props);
      },
      onUpdate: (props) => {
        renderer?.updateProps({ items: props.items, command: commandFor(props), label });
        position(props);
      },
      onKeyDown: (props: SuggestionKeyDownProps) => {
        if (props.event.key === 'Escape') {
          element?.remove();
          return true;
        }
        return renderer?.ref?.onKeyDown(props.event) ?? false;
      },
      onExit: () => {
        element?.remove();
        renderer?.destroy();
        renderer = null;
        element = null;
      },
    };
  };
}

export type SlashCommand = SuggestionItem & {
  keywords: string[];
  run: (editor: Editor, range: Range) => void;
};
