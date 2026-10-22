import type { RichDocument } from '@daiq/domain';
import { cn } from '@daiq/ui';
import { renderToReactElement } from '@tiptap/static-renderer';
import { useMemo } from 'react';
import { toJsonContent } from './json';
import { schemaExtensions } from './schema';
import './editor.css';

const extensions = schemaExtensions();

/**
 * Read-only document rendering as React elements: no editor instance and no
 * innerHTML, so stored content can never inject markup (threat model T6).
 */
export function RichTextView({ doc, className }: { doc: RichDocument | null; className?: string }) {
  const element = useMemo(
    () => (doc ? renderToReactElement({ content: toJsonContent(doc), extensions }) : null),
    [doc],
  );
  return <div className={cn('daiq-prose', className)}>{element}</div>;
}
