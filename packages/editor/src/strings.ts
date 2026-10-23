/*
 * The editor's words, read at render time. English by default. Apps load them
 * from "@daiq/editor/strings", which pulls in no Tiptap code.
 */
export const editorTexts = {
  placeholder: 'Write something, or press / for commands…',
  insertBlock: 'Insert block',
  mentionSomeone: 'Mention someone',
  /** Slash menu entries, by command id. */
  slash: {
    h1: 'Heading 1',
    h2: 'Heading 2',
    h3: 'Heading 3',
    bullet: 'Bulleted list',
    ordered: 'Numbered list',
    task: 'Checklist',
    quote: 'Quote',
    code: 'Code block',
    table: 'Table',
    divider: 'Divider',
  },
};

export type EditorTexts = typeof editorTexts;

export function localizeEditor(texts: EditorTexts): void {
  Object.assign(editorTexts, texts);
}
