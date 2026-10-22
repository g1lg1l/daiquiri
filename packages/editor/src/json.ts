import type { RichDocument } from '@daiq/domain';
import type { JSONContent } from '@tiptap/core';

/** Structural check that a JSON value is a Tiptap/ProseMirror node tree. */
export function isJsonContent(value: unknown): value is JSONContent {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) return false;
  if ('type' in value && typeof value.type !== 'string') return false;
  if ('text' in value && typeof value.text !== 'string') return false;
  if ('content' in value && (!Array.isArray(value.content) || !value.content.every(isJsonContent)))
    return false;
  if (
    'marks' in value &&
    (!Array.isArray(value.marks) ||
      !value.marks.every(
        (mark: unknown) =>
          typeof mark === 'object' &&
          mark !== null &&
          'type' in mark &&
          typeof mark.type === 'string',
      ))
  ) {
    return false;
  }
  return true;
}

/** Domain document → Tiptap JSON, validated (stored data is never trusted blindly). */
export function toJsonContent(doc: RichDocument): JSONContent {
  if (!isJsonContent(doc)) throw new Error('Invalid rich text document');
  return doc;
}
