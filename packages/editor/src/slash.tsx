import { Extension } from '@tiptap/core';
import { Suggestion } from '@tiptap/suggestion';
import {
  CodeIcon,
  Heading1Icon,
  Heading2Icon,
  Heading3Icon,
  ListChecksIcon,
  ListIcon,
  ListOrderedIcon,
  MinusIcon,
  QuoteIcon,
  TableIcon,
} from 'lucide-react';
import { editorTexts, type EditorTexts } from './strings';
import { suggestionRenderer, type SlashCommand } from './suggestion';

type SlashId = keyof EditorTexts['slash'];

/** Titles come from `editorTexts.slash` when the menu opens. */
export const SLASH_COMMANDS: (Omit<SlashCommand, 'id' | 'title'> & { id: SlashId })[] = [
  {
    id: 'h1',
    hint: '#',
    keywords: ['title', 'h1'],
    icon: <Heading1Icon />,
    run: (e, r) => e.chain().focus().deleteRange(r).setNode('heading', { level: 1 }).run(),
  },
  {
    id: 'h2',
    hint: '##',
    keywords: ['subtitle', 'h2'],
    icon: <Heading2Icon />,
    run: (e, r) => e.chain().focus().deleteRange(r).setNode('heading', { level: 2 }).run(),
  },
  {
    id: 'h3',
    hint: '###',
    keywords: ['h3'],
    icon: <Heading3Icon />,
    run: (e, r) => e.chain().focus().deleteRange(r).setNode('heading', { level: 3 }).run(),
  },
  {
    id: 'bullet',
    hint: '-',
    keywords: ['unordered', 'ul'],
    icon: <ListIcon />,
    run: (e, r) => e.chain().focus().deleteRange(r).toggleBulletList().run(),
  },
  {
    id: 'ordered',
    hint: '1.',
    keywords: ['ordered', 'ol'],
    icon: <ListOrderedIcon />,
    run: (e, r) => e.chain().focus().deleteRange(r).toggleOrderedList().run(),
  },
  {
    id: 'task',
    hint: '[]',
    keywords: ['todo', 'task', 'checkbox'],
    icon: <ListChecksIcon />,
    run: (e, r) => e.chain().focus().deleteRange(r).toggleTaskList().run(),
  },
  {
    id: 'quote',
    hint: '>',
    keywords: ['blockquote'],
    icon: <QuoteIcon />,
    run: (e, r) => e.chain().focus().deleteRange(r).toggleBlockquote().run(),
  },
  {
    id: 'code',
    hint: '```',
    keywords: ['snippet', 'pre'],
    icon: <CodeIcon />,
    run: (e, r) => e.chain().focus().deleteRange(r).toggleCodeBlock().run(),
  },
  {
    id: 'table',
    keywords: ['grid'],
    icon: <TableIcon />,
    run: (e, r) =>
      e.chain().focus().deleteRange(r).insertTable({ rows: 3, cols: 3, withHeaderRow: true }).run(),
  },
  {
    id: 'divider',
    hint: '---',
    keywords: ['hr', 'rule', 'separator'],
    icon: <MinusIcon />,
    run: (e, r) => e.chain().focus().deleteRange(r).setHorizontalRule().run(),
  },
];

/** "/" menu for block types. */
export const SlashCommands = Extension.create({
  name: 'slashCommands',
  addProseMirrorPlugins() {
    return [
      Suggestion<SlashCommand>({
        editor: this.editor,
        char: '/',
        startOfLine: false,
        items: ({ query }) => {
          const q = query.toLowerCase();
          return SLASH_COMMANDS.map((c) => ({ ...c, title: editorTexts.slash[c.id] })).filter(
            (c) => !q || c.title.toLowerCase().includes(q) || c.keywords.some((k) => k.includes(q)),
          );
        },
        command: ({ editor, range, props }) => props.run(editor, range),
        render: suggestionRenderer<SlashCommand, SlashCommand>(
          editorTexts.insertBlock,
          (command) => command,
        ),
      }),
    ];
  },
});
