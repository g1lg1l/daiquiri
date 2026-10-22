import type { AnyExtension } from '@tiptap/core';
import { CodeBlockLowlight } from '@tiptap/extension-code-block-lowlight';
import { TaskItem, TaskList } from '@tiptap/extension-list';
import { Mention } from '@tiptap/extension-mention';
import { TableKit } from '@tiptap/extension-table';
import { StarterKit } from '@tiptap/starter-kit';
import bash from 'highlight.js/lib/languages/bash';
import css from 'highlight.js/lib/languages/css';
import diff from 'highlight.js/lib/languages/diff';
import javascript from 'highlight.js/lib/languages/javascript';
import json from 'highlight.js/lib/languages/json';
import python from 'highlight.js/lib/languages/python';
import sql from 'highlight.js/lib/languages/sql';
import typescript from 'highlight.js/lib/languages/typescript';
import xml from 'highlight.js/lib/languages/xml';
import yaml from 'highlight.js/lib/languages/yaml';
import { createLowlight } from 'lowlight';

/*
 * The document schema shared by the interactive editor and the headless
 * renderers (ADR-0005). Adding a node here makes it valid everywhere at once.
 */

// A curated set keeps the editor chunk within budget (performance.md); other
// languages render as plain code.
export const lowlight = createLowlight({
  bash,
  css,
  diff,
  javascript,
  json,
  python,
  sql,
  typescript,
  xml,
  yaml,
});

const SAFE_PROTOCOLS = ['http', 'https', 'mailto'];

/** Links may only point to http(s), mailto, or same-app relative paths. */
export function isSafeHref(href: string): boolean {
  const trimmed = href.trim();
  if (trimmed.startsWith('/') && !trimmed.startsWith('//')) return true;
  try {
    return SAFE_PROTOCOLS.includes(new URL(trimmed).protocol.replace(':', ''));
  } catch {
    return false;
  }
}

export function schemaExtensions(): AnyExtension[] {
  return [
    StarterKit.configure({
      codeBlock: false,
      heading: { levels: [1, 2, 3] },
      link: {
        openOnClick: false,
        autolink: true,
        protocols: SAFE_PROTOCOLS,
        isAllowedUri: (url) => isSafeHref(url),
        HTMLAttributes: { rel: 'noopener noreferrer nofollow', target: '_blank' },
      },
    }),
    CodeBlockLowlight.configure({ lowlight, defaultLanguage: null }),
    TaskList,
    TaskItem.configure({ nested: true }),
    TableKit.configure({ table: { resizable: false } }),
    Mention.configure({
      HTMLAttributes: { class: 'mention' },
      renderText: ({ node }) => `@${String(node.attrs.label ?? node.attrs.id)}`,
      renderHTML: ({ node, options }) => [
        'span',
        { ...options.HTMLAttributes, 'data-type': 'mention', 'data-id': String(node.attrs.id) },
        `@${String(node.attrs.label ?? '')}`,
      ],
    }),
  ];
}
