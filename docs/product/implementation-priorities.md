# Daiq — Implementation Priorities

Priorities describe **order**, not quality: everything that ships is production quality. The architecture supports every P2/P3 item without a rewrite (see [ARCHITECTURE.md](../../ARCHITECTURE.md)).

## Buckets

| Bucket | Meaning |
|---|---|
| **P0 — Foundation** | Platform pieces every feature depends on |
| **P1 — Core product** | What makes Daiq a usable daily task tool for a team |
| **P2 — Advanced productivity** | What makes it competitive with ClickUp / Asana / Linear for most teams |
| **P3 — Enterprise / advanced** | Large-organisation and ecosystem features |

## P0 — Foundation

- Monorepo, strict TypeScript, lint/format, CI, Turborepo pipelines
- Design tokens, light/dark/system theme, base components, motion presets, reduced-motion support
- App shell: sidebar, routing with base path, command palette, shortcut registry, toasts, focus management
- Supabase schema foundations: profiles, workspaces, memberships, invitations, RLS helpers, RLS test harness
- Auth: sign up / sign in / magic link / sign out / anonymous demo sandbox
- Client data layer: Supabase client, typed queries, optimistic mutation pattern, realtime subscription manager
- GitHub Pages build + Docker self-host skeleton

## P1 — Core product

- Teams (public/private), team templates, workflow statuses
- Projects (lead, status, dates, progress), favorites
- Tasks: identifiers, all core fields, sub-tasks, relations, multi-assignees, labels, soft delete + undo
- List view (editor-like creation), Board view with keyboard-accessible drag and drop
- Task detail (side peek + full page) with editor, comments, reactions, activity
- Filters, grouping, ordering, URL state, saved views (personal/shared)
- Search + palette integration
- My tasks, Inbox and notifications, realtime updates
- Members & invitations UI, settings (profile, theme, workspace, teams, labels)

## P2 — Advanced productivity

- Calendar and Timeline views (lazy-loaded)
- Cycles, milestones, project updates
- Custom fields, estimates, time tracking
- Automations (rule engine + run log), recurring tasks, templates, forms → triage
- Attachments (Supabase Storage)
- Insights (fixed charts), CSV/JSON export
- Notification preferences, OR filter groups, sub-grouping

## P3 — Enterprise / advanced

- Initiatives, workload view
- Webhooks, personal access tokens, public API docs, Slack integration
- Email notifications / digests, email-to-task
- SSO (SAML), audit log UI, sub-teams, importers (CSV, Linear, Asana, ClickUp)
- Presence, collaborative description editing, edit history

## Delivery plan: vertical slices

Each slice delivers schema → RLS → data access → UI → tests and leaves `main` deployable.

| # | Slice | Contents | Exit criteria |
|---|---|---|---|
| 0 | **Skeleton** | Monorepo, tooling, CI, tokens, shell, palette, Pages build | `pnpm build && pnpm test` green in CI; shell renders on Pages |
| 1 | **Identity & workspace** | profiles, workspaces, members, invitations, auth screens, onboarding, demo sandbox | RLS tests prove tenant isolation; E2E: sign up → create workspace |
| 2 | **Teams & workflow** | teams, team members, statuses, team templates, team settings | Private team invisible to non-members (RLS test) |
| 3 | **Tasks (list)** | tasks, assignees, labels, list view, composer, task detail, undo | E2E: create/edit/delete/undo; 5k-task list scrolls at 60 fps |
| 4 | **Board & ordering** | board view, drag and drop + keyboard moves, fractional ordering | E2E: drag between columns; keyboard move announced |
| 5 | **Collaboration** | comments, mentions, reactions, activity, editor | Sanitizer tests (XSS corpus); E2E comment flow |
| 6 | **Filters & views** | filter engine, display options, URL state, saved views | Domain unit tests for every operator; E2E filter + save view |
| 7 | **Projects** | projects, project page, progress, favorites | |
| 8 | **Realtime & inbox** | broadcast triggers, subscriptions, notifications, inbox | Two-browser E2E: change appears in the other session |
| 9 | **Search & My tasks** | FTS, search RPC, palette results, My tasks | Query plan uses GIN index (test) |
| 10 | **Self-host** | docker-compose with Supabase services, migrate job, health checks | `docker compose up -d` → working instance (CI smoke) |
| 11+ | **P2 slices** | calendar, timeline, cycles, custom fields, automations, forms, insights, attachments | Per slice |
