import { isRichDocument, type RichDocument } from '@daiq/domain';
import { getSchema } from '@tiptap/core';
import { MarkdownManager } from '@tiptap/markdown';
import { renderToHTMLString } from '@tiptap/static-renderer';
import { toJsonContent } from './json';
import { sanitizeHtml } from './sanitize';
import { schemaExtensions } from './schema';

let markdown: MarkdownManager | null = null;

function markdownManager(): MarkdownManager {
  markdown ??= new MarkdownManager({ extensions: schemaExtensions() });
  return markdown;
}

/** Interoperability export (lossy). */
export function documentToMarkdown(doc: RichDocument | null): string {
  return doc ? markdownManager().serialize(toJsonContent(doc)) : '';
}

/** Interoperability import: Markdown → validated document. */
export function markdownToDocument(text: string): RichDocument {
  const parsed = markdownManager().parse(text);
  const schema = getSchema(schemaExtensions());
  // nodeFromJSON throws on anything the schema does not allow.
  const json: unknown = schema
    .nodeFromJSON({ type: 'doc', content: parsed.content ?? [] })
    .toJSON();
  if (!isRichDocument(json)) throw new Error('Markdown did not produce a document');
  return json;
}

/** Sanitised HTML rendering without a browser editor instance (exports, email). */
export function documentToHtml(doc: RichDocument | null): string {
  if (!doc) return '';
  return sanitizeHtml(
    renderToHTMLString({ content: toJsonContent(doc), extensions: schemaExtensions() }),
  );
}

export function isEmptyDocument(doc: RichDocument | null | undefined): boolean {
  if (!doc?.content?.length) return true;
  return (
    JSON.stringify(doc.content).indexOf('"text"') === -1 &&
    !JSON.stringify(doc.content).includes('mention')
  );
}
