# Architecture Decision Records

Each ADR records one significant decision: context, alternatives, decision, rationale, consequences. ADRs are immutable once accepted; a later ADR *supersedes* an earlier one instead of editing it.

| # | Decision | Status |
|---|---|---|
| [0001](0001-frontend-framework.md) | React 19 + Vite 8 SPA with TanStack Router | Accepted |
| [0002](0002-monorepo-and-tooling.md) | pnpm + Turborepo monorepo, TypeScript 7, oxlint + Prettier | Accepted |
| [0003](0003-backend-and-data-access.md) | Postgres-centric backend on Supabase: PostgREST + RLS, RPC, triggers | Accepted |
| [0004](0004-client-state-and-sync.md) | TanStack Query data layer with optimistic mutations; TanStack DB later | Accepted |
| [0005](0005-editor.md) | Tiptap 3 with ProseMirror JSON as canonical content | Accepted |
| [0006](0006-auth-and-authorization.md) | Supabase Auth (PKCE) + workspace roles enforced by RLS | Accepted |
| [0007](0007-realtime.md) | Realtime via Broadcast-from-database on private channels | Accepted |
| [0008](0008-ui-system-and-motion.md) | Tailwind 4 + shadcn (Base UI) design system, Motion | Accepted |
| [0009](0009-automations-and-jobs.md) | Automations and background jobs inside Postgres (pg_cron, pgmq, pg_net) | Accepted |
| [0010](0010-search.md) | Postgres full-text search + pg_trgm | Accepted |
| [0011](0011-drag-and-drop.md) | Pragmatic drag and drop + keyboard move commands | Accepted |
| [0012](0012-deployment.md) | GitHub Pages demo + Docker Compose self-hosting, runtime config | Accepted |
| [0013](0013-validation.md) | Zod 4 schemas shared from the domain package | Accepted |
| [0014](0014-storage.md) | Supabase Storage with workspace-scoped policies | Accepted |
| [0015](0015-observability.md) | Structured logging with optional error reporting / OpenTelemetry | Accepted |
