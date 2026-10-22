# ADR-0001 — Frontend framework: React 19 + Vite 8 SPA with TanStack Router

- Status: Accepted · Date: 2026-10-22

## Context

The web app must (a) build to static files for the GitHub Pages demo, (b) run behind nginx in Docker with the same build, (c) feel instant (route preloading, code splitting, optimistic UI), and (d) keep URL state (filters, layout, open task) shareable. No SEO requirement: everything is behind sign-in.

## Alternatives considered

| Option | Verdict |
|---|---|
| **React 19.3 + Vite 8.3 + TanStack Router 1.170 (SPA)** | Static output, type-safe routes and search params, built-in preloading and loaders, file-based routes with automatic code splitting. |
| Next.js / TanStack Start (SSR) | SSR adds a server we do not need and cannot host on Pages; static export loses most of the value. |
| React Router 7 (framework mode) | Comparable, but weaker typed search-param story; framework mode leans on a server. |
| SolidJS / Svelte 5 | Excellent performance, but smaller ecosystem for editor (Tiptap React bindings), DnD and accessible primitives. |

## Decision

- **React 19.3** with **Vite 8** (Rolldown) and `@vitejs/plugin-react` 6 (Oxc, Babel-free).
- **TanStack Router** with the Vite plugin, file-based routes under `apps/web/src/routes`, `autoCodeSplitting: true`, `defaultPreload: 'intent'`.
- Search params validated by Zod schemas from `@daiq/domain` (`validateSearch`), so filters and layout are typed URL state.
- `basepath` derived from `import.meta.env.BASE_URL` (Pages: `/daiquiri/`, Docker: `/`).
- React Compiler: not enabled initially; re-evaluate once the Oxc compiler path is stable (measured, not assumed).

## Consequences

- One static bundle serves both deployment targets ([ADR-0012](0012-deployment.md)).
- Heavy surfaces (editor, timeline, charts) are separate route/component chunks loaded on demand.
- Initial render is client-side; we compensate with a small shell bundle and a persisted query cache ([ADR-0004](0004-client-state-and-sync.md)).
