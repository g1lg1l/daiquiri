# ADR-0005 — Rich-text editor: Tiptap 3, ProseMirror JSON as canonical content

- Status: Accepted · Date: 2026-10-22

## Context

Task descriptions, comments and project descriptions need a high-quality editor: Markdown shortcuts, slash commands, mentions, task references, tables, code blocks with highlighting, task lists, images, good paste behaviour, Markdown/HTML import and export. Stored content must never become an XSS vector, and we want to render content outside the browser (emails, exports) later.

## Alternatives considered (details: [tech-stack-research.md §2a](../research/tech-stack-research.md))

|                            | Tiptap 3.32                       | BlockNote 0.56                              | Lexical 0.52             |
| -------------------------- | --------------------------------- | ------------------------------------------- | ------------------------ |
| Canonical format           | ProseMirror JSON (schema-checked) | BlockNote block JSON                        | Lexical serialized state |
| Headless JSON → HTML       | `@tiptap/static-renderer`, no DOM | `server-util` needs jsdom                   | needs happy-dom          |
| Slash/mentions/tables/code | MIT extensions, our own UI        | Built-in Notion-like UI                     | Mostly DIY               |
| Licence                    | MIT                               | MPL-2.0 core, **GPL-3.0/commercial `xl-*`** | MIT                      |
| Maturity                   | 3.x stable                        | 0.x                                         | 0.x                      |
| Size (gzip)                | ~37 kB core + pm                  | ~188 kB core                                | ~63 kB core              |

## Decision

- **Tiptap 3** in `packages/editor`, with our own UI (slash menu, mention list, bubble menu) built on `packages/ui` components.
- **Canonical storage: ProseMirror JSON** in `jsonb` columns (`tasks.description`, `comments.body`, `projects.description`), plus a derived plain-text column for search and previews.
- One **schema definition** (the extension list) is shared by the interactive editor and the headless renderer so both always agree.
- **Markdown** via `@tiptap/markdown` for import (paste, API) and export (copy as Markdown, CSV/JSON export). Treated as lossy interoperability format.
- **HTML** via `@tiptap/static-renderer` for export/email; output always passes through **DOMPurify** with a strict allow-list. Pasted HTML is parsed by the ProseMirror schema (unknown nodes and attributes dropped) — raw HTML is never stored.
- Links are restricted to `http:`, `https:`, `mailto:` (and relative app links); images to `https:` and our Storage origin.
- The editor chunk is loaded lazily the first time a description/comment field gains focus; read-only content renders through the lightweight static renderer.
- The database validates the top level of documents (`type = 'doc'`, size ≤ 256 KB) with a check constraint.

## Consequences

- More UI work than BlockNote, but full control over look, keyboard behaviour, and bundle size; no GPL trap.
- Collaborative editing (Yjs) remains possible later via Tiptap's collaboration extension.
- Sanitiser behaviour is covered by tests with an XSS payload corpus.
