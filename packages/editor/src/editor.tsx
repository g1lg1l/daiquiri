import type { RichDocument } from '@daiq/domain';
import { isRichDocument } from '@daiq/domain';
import { Avatar, cn } from '@daiq/ui';
import { Placeholder } from '@tiptap/extensions';
import { Mention, type MentionNodeAttrs } from '@tiptap/extension-mention';
import { EditorContent, useEditor, type Editor } from '@tiptap/react';
import { useEffect, useLayoutEffect, useRef } from 'react';
import { toJsonContent } from './json';
import { schemaExtensions } from './schema';
import { SlashCommands } from './slash';
import { editorTexts } from './strings';
import { suggestionRenderer, type SuggestionItem } from './suggestion';
import './editor.css';

export interface Mentionable {
  id: string;
  name: string;
  avatarUrl?: string | null;
}

export interface RichTextEditorProps {
  value: RichDocument | null;
  onChange: (doc: RichDocument) => void;
  placeholder?: string;
  mentionables?: readonly Mentionable[];
  autoFocus?: boolean;
  /** Mod+Enter (comments). */
  onSubmit?: () => void;
  /** Esc while editing. */
  onEscape?: () => void;
  className?: string;
  ariaLabel: string;
  /** Debounce for onChange; 0 = every keystroke (controlled composers). */
  debounceMs?: number;
}

type MentionItem = SuggestionItem;

const NO_MENTIONABLES: readonly Mentionable[] = [];

export function RichTextEditor({
  value,
  onChange,
  placeholder = editorTexts.placeholder,
  mentionables = NO_MENTIONABLES,
  autoFocus = false,
  onSubmit,
  onEscape,
  className,
  ariaLabel,
  debounceMs = 400,
}: RichTextEditorProps) {
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  // Tiptap keeps the callbacks given at creation; they read the latest props from here.
  const latest = useRef({ mentionables, onChange, onSubmit, onEscape });
  useLayoutEffect(() => {
    latest.current = { mentionables, onChange, onSubmit, onEscape };
  });

  const emit = (instance: Editor) => {
    const json: unknown = instance.getJSON();
    if (isRichDocument(json)) latest.current.onChange(json);
  };

  const editor = useEditor({
    extensions: [
      ...schemaExtensions().filter((extension) => extension.name !== 'mention'),
      Mention.configure({
        HTMLAttributes: { class: 'mention' },
        renderText: ({ node }) => `@${String(node.attrs.label ?? node.attrs.id)}`,
        suggestion: {
          char: '@',
          items: ({ query }): MentionItem[] =>
            latest.current.mentionables
              .filter((p) => p.name.toLowerCase().includes(query.toLowerCase()))
              .slice(0, 8)
              .map((p) => ({
                id: p.id,
                title: p.name,
                icon: <Avatar name={p.name} src={p.avatarUrl} size="xs" />,
              })),
          command: ({ editor: instance, range, props }) =>
            instance
              .chain()
              .focus()
              .insertContentAt(range, [
                { type: 'mention', attrs: { id: props.id, label: props.label } },
                { type: 'text', text: ' ' },
              ])
              .run(),
          render: suggestionRenderer<MentionItem, MentionNodeAttrs>(
            editorTexts.mentionSomeone,
            (item) => ({
              id: item.id,
              label: item.title,
            }),
          ),
        },
      }),
      SlashCommands,
      Placeholder.configure({ placeholder }),
    ],
    content: value ? toJsonContent(value) : '',
    autofocus: autoFocus ? 'end' : false,
    immediatelyRender: true,
    shouldRerenderOnTransaction: false,
    editorProps: {
      attributes: {
        'aria-label': ariaLabel,
        'aria-multiline': 'true',
        role: 'textbox',
        class: 'daiq-prose',
      },
      handleKeyDown: (_view, event) => {
        if (event.key === 'Enter' && (event.metaKey || event.ctrlKey)) {
          latest.current.onSubmit?.();
          return true;
        }
        if (event.key === 'Escape') latest.current.onEscape?.();
        return false;
      },
    },
    onUpdate: ({ editor: current }) => {
      clearTimeout(timer.current);
      if (debounceMs === 0) emit(current);
      else timer.current = setTimeout(() => emit(current), debounceMs);
    },
    onBlur: ({ editor: current }) => {
      if (timer.current) {
        clearTimeout(timer.current);
        timer.current = undefined;
        emit(current);
      }
    },
  });

  // External updates (realtime, undo) replace the content when not editing.
  useEffect(() => {
    // StrictMode and fast refresh can hand us an instance that was already destroyed.
    if (!editor || editor.isDestroyed || editor.isFocused) return;
    const current = JSON.stringify(editor.getJSON());
    if (value && JSON.stringify(value) !== current)
      editor.commands.setContent(toJsonContent(value), { emitUpdate: false });
    if (!value && !editor.isEmpty) editor.commands.clearContent(false);
  }, [editor, value]);

  useEffect(() => () => clearTimeout(timer.current), []);

  return <EditorContent editor={editor} className={cn('daiq-editor', className)} />;
}

/** Imperative helper for composers that need to clear the editor after submit. */
export type { Editor };
export { RichTextView } from './view';

// Lint note: `react/refs` is disabled for this file (.oxlintrc.json). The editor
// configuration is created once, and its callbacks read `latest.current` only when
// Tiptap invokes them (typing, keydown), never during render.
