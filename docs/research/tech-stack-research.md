# Daiq — Tech Stack Research

Research date: **2026-10-22**. Every version, date and licence in §1 was read from the npm registry on that date (`npm view <pkg> version|time|license|dist-tags|peerDependencies`). Repo activity comes from the GitHub REST API (`pushed_at`). Each package name links to its npm page. Other claims link to official docs or changelogs. Bundle sizes come from bundlephobia, measured on the whole package before tree-shaking, so treat them as upper bounds.

Legend for maintenance: **A** = active (release in the last ~30 days), **S** = steady (last release in the last ~90 days), **F** = frozen or stale (last release more than 6 months ago).

---

## 1. Version table

### 1.1 Runtime, monorepo, language, build

| Package | Latest stable | Released | Licence | Maint. | Notes |
|---|---|---|---|---|---|
| Node.js | **24.22.1** "Krypton" LTS / 26.12.1 Current | 2026-10-20 / 2026-10-21 | MIT | A | Node 24 moved to Maintenance LTS on 2026-10-20. **Node 26 becomes Active LTS on 2026-10-28** (EOL 2029-04-30). Sources: [dist index](https://nodejs.org/dist/index.json), [schedule.json](https://github.com/nodejs/Release/blob/main/schedule.json) |
| [pnpm](https://www.npmjs.com/package/pnpm) | 12.15.0 | 2026-10-21 | MIT | A | 12.0 shipped 2026-08-26 and 11.0 on 2026-04-28. Since 11: Node ≥22 is required, `allowBuilds` replaces `onlyBuiltDependencies`, `minimumReleaseAge` defaults to 1 day, and settings move from `.npmrc` to `pnpm-workspace.yaml` ([pnpm 11 blog](https://pnpm.io/blog/releases/11.0)) |
| [turbo](https://www.npmjs.com/package/turbo) | 2.11.10 | 2026-10-20 | MIT | A | 2.x has been stable since 2024-06 |
| [typescript](https://www.npmjs.com/package/typescript) | **7.0.2** (native Go compiler) | 2026-07-08 | Apache-2.0 | A | **TS 7 is GA.** The Go port ships in the regular `typescript` package and the binary is `tsc`. **7.0 has no programmatic API.** 7.1-beta (2026-10-20) adds the new API (`typescript/sync`, `typescript/async`), with RC expected in about a month ([7.0 post](https://devblogs.microsoft.com/typescript/announcing-typescript-7-0/), [7.1 beta](https://devblogs.microsoft.com/typescript/announcing-typescript-7-1-beta/)). `@typescript/native-preview` stopped at `7.0.0-dev.20260707.2` and is superseded |
| [@typescript/typescript6](https://www.npmjs.com/package/@typescript/typescript6) | 6.0.2 | 2026-07-06 | Apache-2.0 | S | Official 6.0 API compatibility package (binary `tsc6`), used in the alias setup below |
| [react](https://www.npmjs.com/package/react) / [react-dom](https://www.npmjs.com/package/react-dom) | 19.3.1 | 2026-10-14 | MIT | A | 19.3.0 shipped 2026-09-09 |
| [vite](https://www.npmjs.com/package/vite) | 8.3.5 | 2026-10-21 | MIT | A | 8.0 shipped 2026-03-12 with Rolldown as the only bundler. Requires Node 20.19+ / 22.12+ ([Vite 8](https://vite.dev/blog/announcing-vite8)) |
| [@vitejs/plugin-react](https://www.npmjs.com/package/@vitejs/plugin-react) | 6.1.2 | 2026-10-05 | MIT | A | v6 uses Oxc for Fast Refresh and **no longer depends on Babel**. React Compiler is opt-in via `@rolldown/plugin-babel` or the experimental Oxc compiler ([Vite 8 post](https://vite.dev/blog/announcing-vite8)) |
| [@vitejs/plugin-react-swc](https://www.npmjs.com/package/@vitejs/plugin-react-swc) | 4.3.3 | 2026-07-30 | MIT | S | Still published but no longer needed: plugin-react v6 is Babel-free. **Skip** |

### 1.2 TanStack, UI, styling

| Package | Latest | Released | Licence | Maint. | Notes |
|---|---|---|---|---|---|
| [@tanstack/react-router](https://www.npmjs.com/package/@tanstack/react-router) | 1.170.45 | 2026-10-16 | MIT | A | `basepath` option is supported ([RouterOptions](https://tanstack.com/router/latest/docs/framework/react/api/router/RouterOptionsType)) |
| [@tanstack/router-plugin](https://www.npmjs.com/package/@tanstack/router-plugin) | 1.168.47 | 2026-10-16 | MIT | A | Vite plugin for file-based routing. Depends on Babel and Zod, not on the TS API |
| [@tanstack/react-query](https://www.npmjs.com/package/@tanstack/react-query) | 5.104.5 | 2026-10-19 | MIT | A | About 13 kB gzip ([bundlephobia](https://bundlephobia.com/package/@tanstack/react-query)) |
| [@tanstack/react-table](https://www.npmjs.com/package/@tanstack/react-table) | **9.3.1** | 2026-10-12 | MIT | A | **v9.0.0 shipped 2026-08-04**: `useReactTable` becomes `useTable({ features })`, and v8 APIs live under `/legacy` ([migration](https://tanstack.com/table/latest/docs/framework/react/guide/migrating)). The shadcn Data Table already uses v9 ([docs](https://ui.shadcn.com/docs/components/data-table)) |
| [@tanstack/react-virtual](https://www.npmjs.com/package/@tanstack/react-virtual) | 3.14.22 | 2026-10-22 | MIT | A | |
| [@tanstack/react-form](https://www.npmjs.com/package/@tanstack/react-form) | 1.33.5 | 2026-08-11 | MIT | S | Accepts Standard Schema validators |
| [tailwindcss](https://www.npmjs.com/package/tailwindcss) / [@tailwindcss/vite](https://www.npmjs.com/package/@tailwindcss/vite) | 4.3.3 | 2026-07-16 | MIT | S | 4.3.0 shipped 2026-05-08 |
| [shadcn](https://www.npmjs.com/package/shadcn) (CLI) | 4.22.1 | 2026-10-18 | MIT | A | **Base UI has been the default since July 2026**. Radix is "not being deprecated", and `shadcn init -b radix` keeps Radix ([changelog](https://ui.shadcn.com/docs/changelog/2026-07-base-ui-default)) |
| [@base-ui/react](https://www.npmjs.com/package/@base-ui/react) | 1.9.0 | 2026-10-09 | MIT | A | **Current name.** `@base-ui-components/react` is deprecated ("renamed to @base-ui/react", last version 1.0.0-rc.0). 1.0 stable shipped 2025-12-11 and minors have come monthly since ([releases](https://base-ui.com/react/overview/releases)). Includes Autocomplete, Combobox, Menu, Toast and Drawer. `date-fns` peers are optional |
| [radix-ui](https://www.npmjs.com/package/radix-ui) | 1.8.1 | 2026-10-12 | MIT | A | Still releasing (1.7.0 on 10-05, 1.8.0 on 10-12). Repo pushed 2026-10-14 |
| [lucide-react](https://www.npmjs.com/package/lucide-react) | 1.61.0 | 2026-10-21 | **ISC** | A | 1.0 shipped 2026-03-23 |
| [motion](https://www.npmjs.com/package/motion) | 14.6.0 | 2026-10-22 | MIT | A | **Majors come fast: 13.0 on 2026-08-05 and 14.0 on 2026-10-02.** Pin the major. About 57 kB gzip for the whole package |
| [sonner](https://www.npmjs.com/package/sonner) | 2.0.8 | 2026-08-09 | MIT | S | |
| [cmdk](https://www.npmjs.com/package/cmdk) | 1.1.1 | **2025-03-14** | MIT | **F** | No release in about 19 months, and the repo was last pushed 2025-10-29 ([dip/cmdk](https://github.com/dip/cmdk)). Still what shadcn `Command` is built on ([docs](https://ui.shadcn.com/docs/components/command)). Peer range includes React 19 |
| [recharts](https://www.npmjs.com/package/recharts) | 3.10.1 | 2026-07-25 | MIT | S | shadcn Chart uses Recharts v3 ([docs](https://ui.shadcn.com/docs/components/chart)) |
| [@visx/visx](https://www.npmjs.com/package/@visx/visx) | 4.0.0 | 2026-06-11 | MIT | S | Lower-level option. Use only for custom Gantt or timeline views |

### 1.3 Drag and drop, editors, sanitising

| Package | Latest | Released | Licence | Maint. | Notes |
|---|---|---|---|---|---|
| [@dnd-kit/core](https://www.npmjs.com/package/@dnd-kit/core) / [sortable](https://www.npmjs.com/package/@dnd-kit/sortable) | 6.3.1 / 10.0.0 | 2024-12-05 / 2024-12-04 | MIT | **F** | The docs label this "the legacy version" and recommend the new one ([legacy docs](https://dndkit.com/legacy/introduction/installation)) |
| [@dnd-kit/react](https://www.npmjs.com/package/@dnd-kit/react) (+ `/dom`, `/helpers`) | 0.5.1 | 2026-10-15 | MIT | A | **Still 0.x**: 0.4 on 2026-04, 0.5 on 2026-06. Built-in keyboard support, ARIA, and screen-reader live regions ([README](https://github.com/clauderic/dnd-kit)). About 33 kB gzip |
| [@atlaskit/pragmatic-drag-and-drop](https://www.npmjs.com/package/@atlaskit/pragmatic-drag-and-drop) (+ hitbox 3.0.0) | 4.0.0 | 2026-09-24 | Apache-2.0 | A | 4.0 only removed deprecated re-export shims ([CHANGELOG](https://github.com/atlassian/pragmatic-drag-and-drop/blob/main/packages/core/CHANGELOG.md)). Core is about 4.7 kB, supports virtualization, and powers Trello, Jira and Confluence ([README](https://github.com/atlassian/pragmatic-drag-and-drop)) |
| [@blocknote/core](https://www.npmjs.com/package/@blocknote/core), react, mantine, shadcn, ariakit, server-util, code-block | 0.56.0 | 2026-10-14 | **MPL-2.0** | A | 0.x. Built on Tiptap 3. `@blocknote/shadcn` depends on `@base-ui/react ^1.6` and `lucide-react ^0.525` (that second one means a duplicate lucide copy). `server-util` depends on **jsdom**. Core is about 188 kB gzip |
| `@blocknote/xl-*` (multi-column, ai, docx/pdf/odt/email exporters) | 0.56.0 | 2026-10-14 | **GPL-3.0 OR PROPRIETARY** | A | GPL for open source, or a commercial licence from **$195/month** ([pricing](https://www.blocknotejs.org/pricing)) |
| [@tiptap/react](https://www.npmjs.com/package/@tiptap/react), starter-kit, core, markdown, html, static-renderer, extension-mention/table/code-block-lowlight, suggestion, drag-handle, unique-id | 3.32.0 | 2026-10-13 | MIT | A | Former Pro extensions (DragHandle, UniqueID, FileHandler, TableOfContents, Details, Emoji, Mathematics, InvisibleCharacters) were moved to MIT in June 2025 ([blog](https://tiptap.dev/blog/release-notes/were-open-sourcing-more-of-tiptap)), and npm confirms MIT for each. Paid: Cloud collaboration, comments, AI, DOCX/PDF conversion, Pages ([pricing](https://tiptap.dev/pricing)). `@tiptap/html` depends on happy-dom |
| [lexical](https://www.npmjs.com/package/lexical) / [@lexical/react](https://www.npmjs.com/package/@lexical/react) (+ markdown, html, headless, table, code-shiki) | 0.52.0 | 2026-09-28 | MIT | A | 0.x, with a minor release roughly every 2 weeks |
| [dompurify](https://www.npmjs.com/package/dompurify) | 3.4.17 | 2026-10-12 | MPL-2.0 OR Apache-2.0 | A | Pick Apache-2.0. [isomorphic-dompurify](https://www.npmjs.com/package/isomorphic-dompurify) 4.6.0 (MIT) covers server use |

### 1.4 Validation, data, Supabase

| Package | Latest | Released | Licence | Maint. | Notes |
|---|---|---|---|---|---|
| [zod](https://www.npmjs.com/package/zod) | 4.6.7 | 2026-10-12 | MIT | A | 4.0 shipped 2025-07-09. `zod/mini` is a subpath of the same package |
| [valibot](https://www.npmjs.com/package/valibot) | 1.5.0 | 2026-09-09 | MIT | S | |
| [arktype](https://www.npmjs.com/package/arktype) | 2.2.9 | 2026-10-20 | MIT | A | About 47 kB gzip for the whole package |
| [@standard-schema/spec](https://www.npmjs.com/package/@standard-schema/spec) | 1.1.0 | 2025-12-15 | MIT | S | Shared interface implemented by all three libraries above |
| [@supabase/supabase-js](https://www.npmjs.com/package/@supabase/supabase-js) | 2.118.0 | 2026-10-15 | MIT | A | **`3.0.0-next.29` is on the `next` tag** (no GA date found). About 56 kB gzip |
| [supabase](https://www.npmjs.com/package/supabase) (CLI) | 2.121.0 | 2026-10-14 | MIT | A | **`3.0.0-next.22` is on `next`.** Downloads a binary in postinstall, so pnpm 11+ needs it in `allowBuilds` |
| [fractional-indexing](https://www.npmjs.com/package/fractional-indexing) | 4.0.0 | 2026-06-25 | CC0-1.0 | S | 4.0 changes the default `intDigits` only when you pass custom `digits`; default output is unchanged ([release](https://github.com/rocicorp/fractional-indexing/releases/tag/v4.0.0)) |
| [fractional-indexing-jittered](https://www.npmjs.com/package/fractional-indexing-jittered) | 1.1.0 | 2026-09-08 | CC0-1.0 | S | Adds jitter to reduce collisions between concurrent clients inserting at the same spot |
| [date-fns](https://www.npmjs.com/package/date-fns) | 4.4.0 | 2026-05-29 | MIT | S | |
| [temporal-polyfill](https://www.npmjs.com/package/temporal-polyfill) | 1.0.6 | 2026-10-13 | MIT | A | Native Temporal exists in Chrome/Edge 144+ and Firefox 139+. I found no confirmed stable Safari release (secondary sources only), so a polyfill is needed |
| pgTAP | bundled | — | PostgreSQL | A | Shipped in the `supabase/postgres` image ([nix/ext/pgtap.nix](https://github.com/supabase/postgres/tree/develop/nix/ext)). `supabase test db` runs `pg_prove` on `supabase/tests/*.sql` ([CLI ref](https://supabase.com/docs/reference/cli/supabase-test-db)) |
| basejump `supabase_test_helpers` | 0.0.6 (dbdev) | — | MIT | **F** | Repo last pushed 2024-05-15 ([repo](https://github.com/usebasejump/supabase-test-helpers)) |

### 1.5 Test, lint, format, architecture rules

| Package | Latest | Released | Licence | Maint. | Notes |
|---|---|---|---|---|---|
| [vitest](https://www.npmjs.com/package/vitest) / @vitest/browser | 5.0.5 | 2026-10-15 | MIT | A | 5.0 shipped 2026-09-03. Peer: Vite 6–8 |
| [@playwright/test](https://www.npmjs.com/package/@playwright/test) | 1.64.1 | 2026-10-14 | Apache-2.0 | A | |
| [@testing-library/react](https://www.npmjs.com/package/@testing-library/react) | 16.3.3 | 2026-08-27 | MIT | S | Peer React 18/19 |
| [eslint](https://www.npmjs.com/package/eslint) | 10.13.0 | 2026-10-16 | MIT | A | 10.0 (2026-02-06) **removed eslintrc completely** ([release](https://eslint.org/blog/2026/02/eslint-v10.0.0-released/)) |
| [typescript-eslint](https://www.npmjs.com/package/typescript-eslint) | 8.72.0 | 2026-10-19 | MIT | A | **Peer `typescript >=4.8.4 <6.1.0`, so it does not support TS 7.** Use the TS team's alias workaround below |
| [@biomejs/biome](https://www.npmjs.com/package/@biomejs/biome) | 2.6.2 | 2026-10-21 | MIT OR Apache-2.0 | A | Type-aware rules come from Biome's own inference, without tsc. 2.6 promoted 59 rules to stable and added YAML formatting ([releases](https://github.com/biomejs/biome/releases)) |
| [oxlint](https://www.npmjs.com/package/oxlint) | 1.89.0 | 2026-10-19 | MIT | A | 1.0 shipped 2025-06. Built-in react (including hooks), jsx-a11y, import, vitest and promise plugins ([plugins](https://oxc.rs/docs/guide/usage/linter/plugins.html)) |
| [oxlint-tsgolint](https://www.npmjs.com/package/oxlint-tsgolint) | 7.0.2004 | 2026-10-10 | MIT | A | **Type-aware linting is stable** and tracks TS 7.0.2. It covers 59 of typescript-eslint's 61 type-aware rules and runs 12–18× faster ([oxc blog](https://oxc.rs/blog/2026-07-22-type-aware-linting-stable)) |
| [oxfmt](https://www.npmjs.com/package/oxfmt) | 0.74.0 | 2026-10-19 | MIT | A | **Beta, pre-1.0.** Passes 100% of Prettier's JS/TS conformance tests ([beta post](https://oxc.rs/blog/2026-02-24-oxfmt-beta)) |
| [prettier](https://www.npmjs.com/package/prettier) | 3.9.10 | 2026-10-10 | MIT | A | `4.0.0-alpha.13` is on `next`. [prettier-plugin-tailwindcss](https://www.npmjs.com/package/prettier-plugin-tailwindcss) is at 0.8.1 |
| [dependency-cruiser](https://www.npmjs.com/package/dependency-cruiser) | 18.7.0 | 2026-10-19 | MIT | A | Works with any linter |
| [eslint-plugin-boundaries](https://www.npmjs.com/package/eslint-plugin-boundaries) | 7.2.1 | 2026-10-21 | MIT | A | Requires ESLint |

---

## 2. Comparisons and recommendations

### 2a. Rich-text editor — **Tiptap 3**

| | **Tiptap 3.32** | BlockNote 0.56 | Lexical 0.52 |
|---|---|---|---|
| Canonical JSON | ProseMirror JSON (standard, schema-checked) | BlockNote block JSON (custom format on top of Tiptap). The docs recommend `JSON.stringify(editor.document)` as the only lossless format ([docs](https://www.blocknotejs.org/docs/features/export/html)) | Lexical `SerializedEditorState` |
| Markdown | `@tiptap/markdown` (MIT, marked-based, both directions). Labelled an "early release". No comments; table cells hold one child node ([docs](https://tiptap.dev/docs/editor/markdown)) | `blocksToMarkdownLossy` / `tryParseMarkdownToBlocks`, lossy by name | `@lexical/markdown` transformers. You maintain them per node, and they are lossy |
| HTML | `@tiptap/html` `generateHTML` (uses happy-dom) | `blocksToFullHTML` (lossless render), `blocksToHTMLLossy` | `$generateHtmlFromNodes`, which needs a DOM. On a server it runs inside `withDOM()` (happy-dom) ([headless](https://lexical.dev/docs/concepts/headless)) |
| Headless JSON→HTML (emails, exports) | **`@tiptap/static-renderer`: "doesn't require a browser, DOM or even an editor instance"**, outputs an HTML string, React or Markdown ([docs](https://tiptap.dev/docs/editor/api/utilities/static-renderer)). Should run in Deno Edge Functions (not tested) | `ServerBlockNoteEditor` in `@blocknote/server-util`, which pulls in **jsdom** (heavy; Deno/edge not verified) ([docs](https://www.blocknotejs.org/docs/features/server-processing)) | Headless editor plus happy-dom |
| Slash, mentions, tables, code | `@tiptap/suggestion` (slash and mentions), `extension-mention`, `extension-table`, `code-block-lowlight`, all MIT. You build the UI with shadcn | All built in (slash menu, tables, `@blocknote/code-block` with Shiki), plus a ready Notion-like UI. Multi-column is **GPL/paid** | Typeahead plugin and tables are built in. Mentions and slash menu are example-level code you write yourself |
| Paste handling | ProseMirror clipboard parser plus `transformPastedHTML` hooks | Inherits Tiptap's, plus block normalisation | Own `DOMImportExtension` |
| Size (gzip, whole package) | Core about 37 kB + `@tiptap/pm` | **About 188 kB** core, plus Mantine or shadcn UI | About 63 kB core |
| Licence | **MIT** (everything we need) | Core MPL-2.0. **xl-\* GPL-3.0 or $195/month** | MIT |
| React 19 | Peer ^19 | Peer ^19 | Peer >=18 |
| Maturity | 3.x stable, about 38.8k stars, weekly releases | 0.x | 0.x |

**Recommendation: Tiptap 3**, stored as ProseMirror JSON in `jsonb`. Render emails and exports with `@tiptap/static-renderer`, and use `@tiptap/markdown` only for import/export (it is lossy). Keep the editor schema in one shared package so the client and server renderer use the same schema. BlockNote would get us a Notion-like UI fastest, but it brings its own JSON format, jsdom for server rendering, MPL obligations on edits to its files, and a GPL trap if anyone adds an `xl-*` package to an MIT/Apache project. Lexical would mean building more ourselves for mentions and slash commands, and HTML export still needs a DOM.

### 2b. Drag and drop — **Pragmatic DnD, plus "Move to…" menus**

| | Pragmatic DnD 4.0 | @dnd-kit/react 0.5 | @dnd-kit/core 6.3 (classic) |
|---|---|---|---|
| Status | Stable, Atlassian, powers Trello/Jira | 0.x, active, API still changing | Legacy, last release 2024-12 |
| Keyboard / screen reader | **Not automatic.** Atlassian says to "always provide alternatives to dragging" (menu actions) and to announce moves via `@atlaskit/pragmatic-drag-and-drop-live-region` ([a11y](https://atlassian.design/components/pragmatic-drag-and-drop/accessibility-guidelines)) | Built-in keyboard sensor, ARIA, and live regions ([README](https://github.com/clauderic/dnd-kit)) | Built in |
| Virtualization | Supported, listed in the README | Not documented | Not documented. Unmounted droppables need workarounds (my assessment, not from the docs) |
| Cross-list boards | Yes (hitbox and auto-scroll packages) | Yes: `move()` from `@dnd-kit/helpers` ([guide](https://dndkit.com/react/guides/multiple-sortable-lists)) | Yes |
| Size | About 4.7 kB core | About 33 kB gzip | About 14 kB gzip |

**Recommendation: Pragmatic DnD** for board, list and tree views that run inside TanStack Virtual. WCAG 2.2 SC 2.5.7 (Dragging Movements) requires a non-drag alternative anyway, so a "Move to… / Move up/down" menu item on every card is needed whichever library we pick. Pragmatic's model fits that. Re-check `@dnd-kit/react` when it reaches 1.0. Do not start new code on classic `@dnd-kit/core`.

### 2c. Validation — **Zod 4**

| | Zod 4.6 | Valibot 1.5 | ArkType 2.2 |
|---|---|---|---|
| Size (docs' own login-form benchmark) | Zod 15–18 kB, **zod/mini about 4–7 kB** ([valibot comparison](https://valibot.dev/guides/comparison/)). Zod's docs: mini about 4.0 kB vs 13.1 kB for an object schema ([zod/mini](https://zod.dev/packages/mini)) | **About 1.4 kB** | About 47 kB whole package (not tree-shakeable in practice) |
| TanStack Router `validateSearch` | Used directly. "With Zod v4, we can use the schema without the adapter" ([docs](https://tanstack.com/router/latest/docs/framework/react/guide/search-params)) | Directly (Standard Schema) | Directly (Standard Schema) |
| TanStack Form | Standard Schema | Standard Schema | Standard Schema |
| Ecosystem / DX | Largest. Method chaining, plus JSON Schema output | Functional pipes, more verbose | TS-syntax strings, fastest runtime |

**Recommendation: Zod 4** for shared domain schemas, using full `zod` (familiar API, largest ecosystem, no adapters needed). If bundle size matters later, switch hot client paths to `zod/mini`. Write shared helpers against `StandardSchemaV1` so they don't depend on Zod.

### 2d. Lint and format — **oxlint + tsgolint, Prettier for now**

| | ESLint 10 + typescript-eslint 8 | Biome 2.6 | oxlint 1.89 + tsgolint 7 + oxfmt 0.74 |
|---|---|---|---|
| Maturity | Highest, largest plugin ecosystem | Stable 2.x, one tool for lint and format | Linter stable. **Formatter is beta** |
| Type-aware | Full, but **runs on the TS 6 API only** (peer <6.1) | Own inference (subset, no tsc) | **59/61 typescript-eslint rules, running on TS 7 (Go)** |
| Speed | Slowest | Fast | Fastest: 12–18× faster than typescript-eslint ([oxc](https://oxc.rs/blog/2026-07-22-type-aware-linting-stable)) |
| Monorepo | Flat config per package | Nested `biome.json` | Nested configs. `typeAware` is root-only |

**Recommendation:** `oxlint --type-aware` with `oxlint-tsgolint@7` (react, jsx-a11y, import and vitest plugins on) for linting, **Prettier 3.9** with `prettier-plugin-tailwindcss` for formatting, and **dependency-cruiser** for package and layer boundaries (it works without ESLint). Switch Prettier to oxfmt once oxfmt reaches 1.0; output should match because oxfmt passes 100% of Prettier's conformance tests. Only fall back to ESLint 10 if we need an ESLint-only plugin, and then use the TS 6 alias (§5).

### 2e. Primitives — **Base UI (`@base-ui/react`)**

- **Base UI:** 1.0 stable since 2025-12-11, monthly minors (1.9.0 on 2026-10-09), MUI-backed, and repo activity daily. It is **the shadcn default since July 2026**, and `@blocknote/shadcn` also uses it ([changelog](https://ui.shadcn.com/docs/changelog/2026-07-base-ui-default), [releases](https://base-ui.com/react/overview/releases)).
- **Radix:** Still maintained (1.8.1 on 2026-10-12). shadcn still ships every component for both libraries, "unless a component only exists in Base UI".
- **Recommendation:** Run `pnpm dlx shadcn@4 init` with the default Base UI. Expect an `asChild`→`render` idiom difference when copying older Radix snippets.

### 2f. Command palette — **cmdk behind our own component**

- cmdk 1.1.1 has had no release since 2025-03, but it works with React 19 and shadcn `Command` still uses it.
- Alternatives:
  - Base UI `Autocomplete`/`Combobox` (stable, actively maintained) for a palette built on primitives we already ship.
  - `kbar` 1.0.0 (2026-08) for an action-registry style palette.
- **Recommendation:** Use shadcn `Command` (cmdk) now, wrapped in a single `CommandPalette` component with our own action registry, so we can swap to Base UI Autocomplete if cmdk breaks on a future React version.

---

## 3. Supabase specifics

### 3.1 Self-hosting (Docker Compose)

- **Official path:** `github.com/supabase/supabase` → `docker/`. Steps:
  1. Copy `.env.example` to `.env`.
  2. Run `sh utils/generate-keys.sh` and `sh utils/add-new-auth-keys.sh`.
  3. Run `docker compose pull`, then `sh run.sh start` (same as `docker compose up -d --wait`).

  Source: [docs](https://supabase.com/docs/guides/self-hosting/docker).
- **Services in `docker-compose.yml`** (snapshot 2026-10-16, [versions.md](https://github.com/supabase/supabase/blob/master/docker/versions.md)):

  | Service | Image |
  |---|---|
  | `db` | `supabase/postgres:17.6.1.136` (**Postgres 17**) |
  | `auth` | `gotrue v2.197.0` |
  | `rest` | `postgrest v14.18` |
  | `realtime` | `v2.143.3` |
  | `storage` | `v1.81.0` |
  | `imgproxy` | — |
  | `meta` | — |
  | `functions` | `edge-runtime v1.77.4` |
  | `supavisor` | — |
  | `studio` | — |
  | `api-gw` | **Envoy is now the default gateway**. Kong, Caddy and nginx are available as override files |

  Logflare and Vector are opt-in (`run.sh config add logs`).
- **Minimum for Daiq:** `db`, `auth`, `rest`, `realtime`, `storage`, `api-gw`, plus our static SPA container. The docs say Realtime, Storage, imgproxy and functions can be removed. Studio and meta are useful for admins but optional. The full stack needs at least 4 GB RAM, 2 cores and 40 GB disk.
- **Keys:** New-style `SUPABASE_PUBLISHABLE_KEY` / `SUPABASE_SECRET_KEY` with asymmetric JWT signing. Legacy `ANON_KEY` / `SERVICE_ROLE_KEY` are still in `.env.example`.
- **Upgrades:** Snapshots come out about monthly. `update.sh` does a three-way merge against `self-hosted/v*`.

### 3.2 Realtime — **Broadcast from the database, private channels**

- The docs call Broadcast via triggers "the recommended method for scalability and security" ([docs](https://supabase.com/docs/guides/realtime/subscribing-to-database-changes)). There are two ways to send from the database:
  - `realtime.broadcast_changes(topic, event, op, table, schema, NEW, OLD)` inside an `AFTER` trigger.
  - `realtime.send(payload jsonb, event, topic, private => true)` for custom payloads ([broadcast](https://supabase.com/docs/guides/realtime/broadcast)).
- **Postgres Changes limits:** single-threaded, and every change is checked against every subscriber ("100 subscribers = 100 checks"). Use Broadcast above about 3,000 concurrent subscribers. `OR` filters are unsupported, `in` is capped at 100 values, and DELETE events can't be filtered without `REPLICA IDENTITY FULL` ([docs](https://supabase.com/docs/guides/realtime/postgres-changes)).
- **Authorization** ([docs](https://supabase.com/docs/guides/realtime/authorization)):
  - Clients join with `{ config: { private: true } }`.
  - RLS on `realtime.messages`: `select` controls receive and `insert` controls send. Policies can use `realtime.topic()` and the `extension` column.
  - Turn off "Allow public access".
  - Access is checked at join time and cached until the JWT is refreshed, so keep JWT lifetimes short.
  - **Don't** run `ALTER TABLE realtime.messages ENABLE ROW LEVEL SECURITY` in migrations: it errors.
- **Retention and replay:** messages live in daily partitions for about 3 days. Replay (`broadcast.replay: { since, limit ≤ 25 }`) works only on private channels and only for messages sent from the database (supabase-js ≥ 2.74).
- **Daiq design:**
  - Use one topic per permission boundary, e.g. `project:<id>`. The topic policy checks membership.
  - Broadcast **thin payloads** (`{table, id, op, version}`) via `realtime.send`, and have clients refetch rows through PostgREST. Row-level RLS then stays the only read gate (fails closed), even for rows with finer permissions than their topic.
  - On reconnect: try replay, then fall back to refetching queries.

### 3.3 Auth for a static SPA (GitHub Pages)

- supabase-js defaults to `flowType: 'implicit'` ([source](https://github.com/supabase/supabase-js/blob/master/packages/core/auth-js/src/GoTrueClient.ts)), so **set `flowType: 'pkce'`** explicitly.
  - With `detectSessionInUrl: true`, the client exchanges `?code=` automatically.
  - The code is valid for 5 minutes, can be used once, and must be exchanged **in the same browser** that started the flow. This matters for magic links ([PKCE](https://supabase.com/docs/guides/auth/sessions/pkce-flow)).
  - PKCE returns `?code=` in the query string, not tokens in the `#hash`, so it does not clash with routing.
- **Allow-list** ([docs](https://supabase.com/docs/guides/auth/redirect-urls)):
  - Set the Site URL to `https://<user>.github.io/daiquiri/`.
  - Redirect URLs use globs: `*` stops at `.` and `/`, `**` matches anything. Use exact URLs for production and `**` for previews.
  - Email templates must use `{{ .RedirectTo }}` when you pass `redirectTo`.
  - Self-hosted equivalents: `SITE_URL` and `ADDITIONAL_REDIRECT_URLS` (mapped to `GOTRUE_URI_ALLOW_LIST` in compose).
- **OAuth (GitHub):** the provider callback is Supabase's `/auth/v1/callback`, not the SPA. In self-hosted compose that is `${API_EXTERNAL_URL}/callback`. Set `redirectTo` to the SPA **base URL** (`…/daiquiri/`) so the callback lands on `index.html` (HTTP 200), then navigate in the client.
- **Demo risk:** hosted Free projects pause after 7 days of low activity ([docs](https://supabase.com/docs/guides/platform/free-project-pausing)). Schedule a keep-alive or use a paid org.

### 3.4 RLS testing

- **Runner:** `supabase test db` runs pgTAP files from `supabase/tests`, each in its own transaction that is rolled back. It accepts `--local`, `--linked` or `--db-url` ([CLI](https://supabase.com/docs/reference/cli/supabase-test-db), [guide](https://supabase.com/docs/guides/local-development/testing/overview)).
- **Helpers:** the docs point to basejump `supabase_test_helpers` (`tests.create_supabase_user`, `authenticate_as`, `rls_enabled`, `clear_authentication`), installed via dbdev, which requires `pg_tle` and `http` ([docs](https://supabase.com/docs/guides/local-development/testing/pgtap-extended)). The repo has been stale since 2024-05.
- **Recommendation:** copy about 4 equivalent plain-SQL helper functions into `supabase/tests/000-setup.sql`. They work by setting `role authenticated` and `request.jwt.claims`. Also add a `tests.rls_enabled('public')` check that fails CI for any table without RLS.
- **Second layer:** Vitest integration tests that use supabase-js as real users against the local stack.

### 3.5 Types, Edge Functions, Storage, jobs, search

- **Types:** `supabase gen types typescript --local | --project-id <ref> | --db-url <url>` produces `Database`, used as `createClient<Database>`, with helpers `Tables<>`, `Enums<>` and `QueryData<>` ([docs](https://supabase.com/docs/guides/api/rest/generating-types)). For self-hosted, use `--db-url`.
- **Edge Functions (self-hosted):**
  - Run in the `functions` service (edge-runtime). Code lives in `volumes/functions/<name>/index.ts`.
  - **There is no `supabase functions deploy` for self-hosted.** Deploying means copying files and running `run.sh restart functions`.
  - JWT checks are controlled by `FUNCTIONS_VERIFY_JWT`.
  - Limits: 150 MB memory per worker, 150 s request idle timeout ([docs](https://supabase.com/docs/guides/self-hosting/self-hosted-functions)).
  - **Keep core features in Postgres** (RLS, RPC, triggers). Use Functions only for optional integrations such as email.
- **Storage:** RLS on `storage.objects`:
  - Uploads need `INSERT`.
  - Upsert also needs `SELECT` and `UPDATE`.
  - Scope by folder, e.g. `(storage.foldername(name))[1] = <workspace_id>` ([docs](https://supabase.com/docs/guides/storage/security/access-control)).
- **Background jobs:** `pg_cron`, `pg_net`, `pgmq` and `pg_partman` are all packaged in the image ([nix/ext](https://github.com/supabase/postgres/tree/develop/nix/ext)).
  - Supabase Cron (pg_cron) schedules from every second up to yearly, and recommends at most 8 concurrent jobs, each under 10 minutes ([docs](https://supabase.com/docs/guides/cron)).
  - Queues (pgmq) give guaranteed, exactly-once delivery within a visibility window ([docs](https://supabase.com/docs/guides/queues)).
  - Automations pattern: trigger → `pgmq.send` → `pg_cron` worker function, with `pg_net` for webhooks.
- **Search:**
  - Postgres full-text search with a generated `tsvector` column plus a GIN index, queried with `websearch_to_tsquery` or supabase-js `.textSearch(col, q, { type: 'websearch' })` ([docs](https://supabase.com/docs/guides/database/full-text-search)).
  - Add `pg_trgm` (Postgres contrib, [docs](https://www.postgresql.org/docs/17/pgtrgm.html)) for fuzzy and typo-tolerant matching on titles.
  - `pgroonga` and `rum` are also packaged.

---

## 4. GitHub Pages SPA routing

| Option | How | Pros | Cons |
|---|---|---|---|
| **A. Copy `index.html` to `404.html`** | Post-build `cp dist/index.html dist/404.html`. GH Pages serves `404.html` for unknown paths ([GitHub docs](https://docs.github.com/en/pages/getting-started-with-github-pages/creating-a-custom-404-page-for-your-github-pages-site)) | Clean URLs, no script tricks, same routing code as Docker/nginx | Deep links return **HTTP 404 status** (body still works). Not SEO-friendly, which is irrelevant for an app |
| B. 404 redirect trick ([spa-github-pages](https://github.com/rafgraph/spa-github-pages)) | `404.html` rewrites the path into `/?/path` and `index.html` restores it with `history.replaceState`. Needs `pathSegmentsToKeep = 1` for project sites | Final response is 200 | Two scripts and an extra hop. Google stopped following it around 2019 |
| C. Hash history | `createHashHistory()` ([docs](https://tanstack.com/router/latest/docs/framework/react/guide/history-types)) | Never touches the server | `/#/` URLs, and different URLs between demo and self-host |

**Recommendation: A**, with browser history:

- Vite: `base: process.env.DAIQ_BASE ?? '/'`. The Pages build sets `/daiquiri/`; Docker uses `/`.
- Router: `createRouter({ routeTree, basepath: import.meta.env.BASE_URL })`. `basepath` mounts the router at a sub-path and composes with `rewrite` ([RouterOptions](https://tanstack.com/router/latest/docs/framework/react/api/router/RouterOptionsType)). Vite's `BASE_URL` keeps a trailing slash, so normalise it.
- Deploy with the official Pages workflow (`configure-pages`, `upload-pages-artifact`, `deploy-pages`) ([Vite guide](https://vite.dev/guide/static-deploy)).
- Self-host: nginx `try_files $uri /index.html`.
- **Runtime config:** load `config.json` (Supabase URL and publishable key) at boot rather than baking `VITE_*` values in at build time. Then one Docker image can serve any deployment, and the Pages build just writes the demo `config.json`.

---

## 5. Risk flags

1. **TypeScript 7 has no API until 7.1.** typescript-eslint (peer `<6.1.0`), and any tool that `require('typescript')`s (possibly dependency-cruiser's TS parsing; verify), will break on TS 7. Use the TS team's documented aliases ([TS 7 post](https://devblogs.microsoft.com/typescript/announcing-typescript-7-0/)):
   ```json
   "devDependencies": {
     "@typescript/native": "npm:typescript@^7.0.2",
     "typescript": "npm:@typescript/typescript6@^6.0.2"
   }
   ```
   With this, `tsc` runs TS 7 and API consumers get TS 6. Revisit when 7.1 is GA (RC expected about 2026-11).
2. **TS 7 config changes:**
   - `strict` is now on by default.
   - `types` defaults to `[]`, so list `vite/client` and similar explicitly.
   - `baseUrl` is removed.
   - `moduleResolution: node10` is removed; use `bundler`.
   - `noUncheckedSideEffectImports` is now on by default.
3. **BlockNote xl-\* packages are GPL-3.0 or commercial.** Block them in dependency-cruiser and CI if BlockNote is ever adopted.
4. **Upcoming majors on `next`:**
   - supabase-js `3.0.0-next.29`
   - Supabase CLI `3.0.0-next.22`
   - Prettier `4.0.0-alpha`
   - TanStack DB pre-1.0
   - `@dnd-kit/react` 0.x
   - Lexical and BlockNote are both 0.x
   - Motion ships about 2 majors a year (13 and 14 both in 2026)
5. **Deprecated or frozen packages:**
   - `@base-ui-components/react` (renamed)
   - `@dnd-kit/core`/`sortable` (legacy)
   - `@typescript/native-preview` (superseded)
   - `cmdk` (no release since 2025-03)
   - basejump test helpers (stale since 2024)
6. **pnpm 11+:**
   - `minimumReleaseAge` defaults to 1 day, so brand-new releases won't resolve.
   - Build scripts are blocked unless listed in `allowBuilds` (the `supabase` CLI, `esbuild`).
   - pnpm itself needs Node ≥22.
7. **TanStack Table v9 API break.** Use v9 from day one; shadcn already does.
8. **Fractional index ordering:** store keys as `text COLLATE "C"`. Non-C collations do not sort mixed-case ASCII byte-wise, and the library's base-62 keys rely on byte order.
9. **Hosted demo pauses** after 7 idle days (Free plan).
10. **Node:** Node 24 entered Maintenance LTS on 2026-10-20, and Node 26 becomes Active LTS on 2026-10-28. Set `engines.node: ">=24"`, run CI on 24 and 26, and default to 26 after Oct 28.

---

## 6. Client data / sync layer (Linear-style speed)

Linear-style speed rests on five pieces:

- an in-memory reactive store
- a persistent local cache
- an optimistic mutation queue
- a server-ordered change log
- pushed deltas

Hard constraint: **the public demo is GitHub Pages plus hosted Supabase, with no other server.**

| Option | Version / licence | Maturity | Extra server? | Self-host (Docker) | Read authZ (fail closed?) | Bundle |
|---|---|---|---|---|---|---|
| **(5) TanStack Query + Supabase Broadcast + optimistic updates** | react-query 5.104.5 MIT, supabase-js 2.118.0 MIT | Stable | **None** | Already in the Supabase compose stack | **PostgREST RLS on every read. Broadcast gated by `realtime.messages` RLS. Fails closed** | About 13 kB + 56 kB gzip |
| (1) TanStack DB ([overview](https://tanstack.com/db/latest/docs/overview)) | `@tanstack/db` **0.15.2**, `react-db` 0.5.12, `query-db-collection` 1.4.8, `offline-transactions` 1.1.4, `browser-db-sqlite-persistence` 0.2.37, all MIT (2026-10-21) | **Pre-1.0 core.** 10 minors since 0.5 (2025-11). Query-collection auto-refetch "slated for removal in v1.0" ([docs](https://tanstack.com/db/latest/docs/collections/query-collection)) | **None** with QueryCollection | Same as (5) | Same as (5) when backed by QueryCollection over PostgREST | About 106 kB gzip whole package (upper bound) |
| (2) ElectricSQL | `@electric-sql/client` 1.5.28, Apache-2.0. Sync service Apache-2.0 | Client 1.x | **Yes**: Electric service (Docker or Cloud) plus an **auth proxy**. On Supabase it needs the direct (IPv6) connection, not the pooler ([docs](https://electric.ax/docs/integrations/supabase)) | Extra container | **Not RLS.** "No need to use database rules"; you authorise shapes in a proxy ([auth](https://electric.ax/docs/guides/auth)). A second permission system that fails open if misconfigured | n/m |
| (3) PowerSync | `@powersync/web` 2.5.0 Apache-2.0. Service `@powersync/service-core` 1.27.1, **FSL-1.1-ALv2** ([LICENSE](https://github.com/powersync-ja/powersync-service/blob/main/LICENSE)) | Mature, with a first-class Supabase guide | **Yes**: PowerSync Service (Cloud, or self-hosted `journeyapps/powersync-service` plus MongoDB or Postgres bucket storage) | Extra containers. The Open Edition has no dashboard ([docs](https://docs.powersync.com/self-hosting/getting-started)) | Writes go through supabase-js, so **RLS applies**. Reads come from **Sync Streams that must mirror RLS** ([guide](https://docs.powersync.com/integration-guides/supabase-+-powersync)) | About 14 kB JS + wa-sqlite WASM |
| (4) Rocicorp Zero | `@rocicorp/zero` 1.11.2, Apache-2.0. 1.0 shipped 2026-03-24 (npm) | 1.x, active | **Yes**: `zero-cache` (SQLite replica via logical replication) **plus app endpoints** `ZERO_QUERY_URL` / `ZERO_MUTATE_URL` ([llms.txt](https://zero.rocicorp.dev/llms.txt)) | Extra containers | Permissions live in your query and mutator endpoints, **not RLS** | n/m |

**Recommendation: start with (5), then migrate to (1) when TanStack DB reaches 1.0. Keep PowerSync as an optional offline tier later. Reject Electric and Zero for the demo constraint.**

- **Phase 1 (now):** TanStack Query with normalised, entity-scoped keys.
  - Optimistic `onMutate`/rollback.
  - `updated_at`/`version` columns for last-write-wins detection.
  - Server-ordered `seq` (bigserial) on a per-project `changes` view, so reconnect can delta-fetch `seq > lastSeen`.
  - Broadcast thin events trigger `setQueryData`/invalidate in batches.
  - Persist the cache with TanStack Query's persister to IndexedDB.
  - All reads and writes go through one `data/` package with hooks only. **Components never import supabase-js.**
- **Phase 2 (TanStack DB ≥1.0):**
  - Swap the hooks' internals to `queryCollectionOptions` (same `queryFn`) plus `useLiveQuery`. This gives sub-ms incremental live queries (about 0.7 ms per row update on 100k rows) and transactional optimistic mutations with automatic rollback.
  - Pipe Broadcast events into `collection.utils.writeUpsert/writeDelete/writeBatch`, which skip a refetch.
  - Add SQLite persistence and `offline-transactions` for the persistent cache and offline queue.
  - No server change: RLS stays the only gate.
- **Phase 3 (only if true offline-first is required):** PowerSync collection (`@tanstack/powersync-db-collection` 0.2.13) behind the same `data/` API. Accept the extra service and keep Sync Streams in lockstep with RLS using pgTAP-style tests.

---

**Skipped:** bundle sizes for Electric and Zero (bundlephobia rate-limited), and live Deno tests of `@tiptap/static-renderer`. Measure them in a spike if either becomes a candidate.
