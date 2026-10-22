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
import { suggestionRenderer, type SlashCommand } from './suggestion';

export const SLASH_COMMANDS: SlashCommand[] = [
  {
    id: 'h1',
    title: 'Heading 1',
    hint: '#',
    keywords: ['title', 'h1'],
    icon: <Heading1Icon />,
    run: (e, r) => e.chain().focus().deleteRange(r).setNode('heading', { level: 1 }).run(),
  },
  {
    id: 'h2',
    title: 'Heading 2',
    hint: '##',
    keywords: ['subtitle', 'h2'],
    icon: <Heading2Icon />,
    run: (e, r) => e.chain().focus().deleteRange(r).setNode('heading', { level: 2 }).run(),
  },
  {
    id: 'h3',
    title: 'Heading 3',
    hint: '###',
    keywords: ['h3'],
    icon: <Heading3Icon />,
    run: (e, r) => e.chain().focus().deleteRange(r).setNode('heading', { level: 3 }).run(),
  },
  {
    id: 'bullet',
    title: 'Bulleted list',
    hint: '-',
    keywords: ['unordered', 'ul'],
    icon: <ListIcon />,
    run: (e, r) => e.chain().focus().deleteRange(r).toggleBulletList().run(),
  },
  {
    id: 'ordered',
    title: 'Numbered list',
    hint: '1.',
    keywords: ['ordered', 'ol'],
    icon: <ListOrderedIcon />,
    run: (e, r) => e.chain().focus().deleteRange(r).toggleOrderedList().run(),
  },
  {
    id: 'task',
    title: 'Checklist',
    hint: '[]',
    keywords: ['todo', 'task', 'checkbox'],
    icon: <ListChecksIcon />,
    run: (e, r) => e.chain().focus().deleteRange(r).toggleTaskList().run(),
  },
  {
    id: 'quote',
    title: 'Quote',
    hint: '>',
    keywords: ['blockquote'],
    icon: <QuoteIcon />,
    run: (e, r) => e.chain().focus().deleteRange(r).toggleBlockquote().run(),
  },
  {
    id: 'code',
    title: 'Code block',
    hint: '```',
    keywords: ['snippet', 'pre'],
    icon: <CodeIcon />,
    run: (e, r) => e.chain().focus().deleteRange(r).toggleCodeBlock().run(),
  },
  {
    id: 'table',
    title: 'Table',
    keywords: ['grid'],
    icon: <TableIcon />,
    run: (e, r) =>
      e.chain().focus().deleteRange(r).insertTable({ rows: 3, cols: 3, withHeaderRow: true }).run(),
  },
  {
    id: 'divider',
    title: 'Divider',
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
          return SLASH_COMMANDS.filter(
            (c) => !q || c.title.toLowerCase().includes(q) || c.keywords.some((k) => k.includes(q)),
          );
        },
        command: ({ editor, range, props }) => props.run(editor, range),
        render: suggestionRenderer<SlashCommand, SlashCommand>(
          'Insert block',
          (command) => command,
        ),
      }),
    ];
  },
});
