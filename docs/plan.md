# Daiq — Research-Backed Plan

> Status: approved for implementation · 2026-10-22
> This document is the entry point. Each section summarises a decision and links to the detailed source of truth.

## A. Executive product summary

**Daiq** is an open-source, self-hostable work-management platform for teams. Tagline: _Everything your team needs. Nothing it doesn't._

ClickUp, Asana and Linear have each proven a different part of the market. ClickUp offers breadth, Asana approachability, and Linear speed and focus. Each pays for it: ClickUp with configuration sprawl, Asana with tier-gated primitives and object overload, Linear with software-only opinions. Daiq combines Linear's speed and keyboard grammar, Asana's editor-like list and My Tasks/Inbox split, and the flexibility non-software teams need: custom fields, multiple assignees, calendar and timeline. It does this on a deliberately shallow model with no feature toggles or plan gating. It runs as a public demo on GitHub Pages + Supabase, and self-hosted with `docker compose up -d`.

## B. Competitor findings — the strongest parts

| From        | Keep                                                                                                                                                                                                                                                                                  |
| ----------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Linear**  | Team-scoped identifiers (`ENG-142`). Fixed status categories with custom names. Fixed priorities. Keyboard grammar: single-key verbs on the focused item, `G`-chords, `⌘K`, `?`. Type-to-filter pickers. Space-to-peek. Optimistic, local-first feel. Triage. Calm design discipline. |
| **Asana**   | The list behaves like a text editor (`Enter`, paste lines). My Tasks (actions) is kept separate from the Inbox (information). Dependencies notify the next assignee once. Forms that create tasks. Fixed project status values. Approachable UI.                                      |
| **ClickUp** | Many layouts over one query. Multiple assignees. Assigned comments (deferred). Rich custom fields (capped in Daiq). Automations with a visible run log. Signed webhooks with before/after values. Bulk action bar.                                                                    |

Details: [clickup-analysis.md](research/clickup-analysis.md), [asana-analysis.md](research/asana-analysis.md), [linear-analysis.md](research/linear-analysis.md).

## C. Complexity findings — what Daiq avoids

- **Deep hierarchies.** ClickUp has 5 container levels plus 7 subtask levels.
- **Configuration at every level with inheritance rules.**
- **Admin feature toggles.** ClickUp has 38 ClickApps.
- **Multi-homing.** Fields pile up on tasks that live in several projects (Asana).
- **Three competing ways to express status** (Asana).
- **Behaviour that changes with subtask depth** (Asana).
- **Notification floods.** ClickUp's auto-follow and mandatory triggers; Asana sends email as a superset of the Inbox.
- **Rule builders that became programming environments** (Asana).
- **Metered "uses", seat blocks, plan-gated basics** (all three).
- **AI agents and chat creeping into the core** (all three in 2026).
- **Hidden per-user view state on shared links** (Linear).
- **Hard caps forced by full-client sync.** Linear caps teams at 60k issues.
- **Performance treated as a later problem.** ClickUp's top complaint has been open for six years.

## D. Complete feature inventory

Grouped by domain in [competitor-feature-matrix.md](research/competitor-feature-matrix.md) (≈ 90 features across structure, tasks, collaboration, views, automation, communication, search/keyboard, reporting, platform) and specified in [daiq-feature-spec.md](product/daiq-feature-spec.md).

## E. Daiq feature decisions

Every feature carries an ADOPT / ADAPT / SIMPLIFY / DEFER / REJECT decision with reasoning in the [feature matrix](research/competitor-feature-matrix.md). Headline decisions:

- **ADOPT:** identifiers, status categories, fixed priority, keyboard grammar, command palette, editor-like list, board, saved views in the URL, inbox, dependencies, forms, project updates.
- **ADAPT:** multiple assignees (single by default), participation-based subscriptions, cycles as an optional team module, recurring tasks.
- **SIMPLIFY:**
  - Hierarchy: Workspace → Team → Project → Task.
  - Custom fields: 8 types, capped.
  - Automations: one sentence (When / If / Then).
  - Reporting: fixed live insights.
  - Notifications: three levels.
  - Timeline: merges timeline and Gantt.
  - Initiatives: replace portfolios and goals.
- **DEFER:** assigned comments, presence, collaborative editing, SSO, importers, email features.
- **REJECT:** multi-homing, ClickApps-style toggles, custom task types, per-item permissions, chat/docs/whiteboards, metered AI, plan gating.

## F. Information architecture

Workspace → Team → Project → Task → Sub-task (depth ≤ 3).

- Configuration lives in three scopes: workspace, team and personal.
- The sidebar has: workspace switcher, New task, Search, Inbox, My tasks, Favorites, Teams (Tasks / Projects / Cycles), Views, Settings.
- Every screen has a stable URL, and view state lives in search params.

Details: [information-architecture.md](product/information-architecture.md), [keyboard-navigation.md](product/keyboard-navigation.md), [ux-principles.md](product/ux-principles.md).

## G. Technical stack (versions verified 2026-10-22)

| Concern                           | Choice                                                   | Alternatives considered                | ADR                                         |
| --------------------------------- | -------------------------------------------------------- | -------------------------------------- | ------------------------------------------- |
| Runtime / package manager / tasks | Node 24 LTS (CI also on 26), pnpm 12, Turborepo 2        | npm, yarn, bun; Nx                     | [0002](adr/0002-monorepo-and-tooling.md)    |
| Language                          | TypeScript 7 (strict)                                    | TS 6                                   | 0002                                        |
| UI framework                      | React 19.3, Vite 8, TanStack Router                      | Next.js, React Router 7, Solid, Svelte | [0001](adr/0001-frontend-framework.md)      |
| Data                              | TanStack Query 5 (later TanStack DB), supabase-js 2      | Electric, PowerSync, Zero, Redux       | [0004](adr/0004-client-state-and-sync.md)   |
| Backend                           | Supabase: Postgres 17 + PostgREST + RLS + RPC + triggers | Separate API, Edge Functions           | [0003](adr/0003-backend-and-data-access.md) |
| UI system                         | Tailwind 4, shadcn (Base UI), lucide, sonner, cmdk       | Radix, Mantine                         | [0008](adr/0008-ui-system-and-motion.md)    |
| Motion                            | CSS + View Transitions + Motion 14                       | GSAP, react-spring                     | 0008                                        |
| Editor                            | Tiptap 3 (ProseMirror JSON) + DOMPurify                  | BlockNote, Lexical                     | [0005](adr/0005-editor.md)                  |
| Drag and drop                     | Pragmatic DnD 4 + keyboard moves                         | dnd-kit (classic and react)            | [0011](adr/0011-drag-and-drop.md)           |
| Validation                        | Zod 4 (Standard Schema at the boundaries)                | Valibot, ArkType                       | [0013](adr/0013-validation.md)              |
| Tables / virtualisation           | TanStack Table 9, TanStack Virtual 3                     | AG Grid                                | —                                           |
| Lint / format                     | oxlint + tsgolint, Prettier                              | ESLint 10, Biome                       | 0002                                        |
| Tests                             | Vitest 5, Testing Library, Playwright 1.64, pgTAP        | Jest, Cypress                          | [testing.md](architecture/testing.md)       |

Full research: [tech-stack-research.md](research/tech-stack-research.md).

## H. Monorepo layout

`apps/web`, `packages/{domain,data,ui,editor}`, `supabase/`, `docker/`, `docs/`. Responsibilities and the dependency direction are in [ARCHITECTURE.md](../ARCHITECTURE.md) and [ADR-0002](adr/0002-monorepo-and-tooling.md).

Ten packages from the initial proposal were rejected as premature: api, worker, auth, realtime, validation, api-client, logger, observability, testing, and the config packages.

## I. Database model

The entities are: profiles, workspaces, workspace_members, invitations, teams, team_members, statuses, projects, tasks, task_assignees, task_subscribers, labels, task_labels, task_relations, comments, comment_reactions, activity, notifications, views and favorites. P2/P3 adds cycles, milestones, project updates, custom fields, attachments, time entries, templates, forms, automations, webhooks and recurrences.

- Composite foreign keys guarantee same-tenant and same-team references.
- Indexes follow the access patterns.
- Tasks use soft delete with a 30-day purge.

Details, including the ER diagram: [database-model.md](architecture/database-model.md).

## J. Authentication and authorisation

- Supabase Auth with PKCE: password, magic link and OAuth.
- The anonymous demo creates a sandbox workspace.
- Roles are owner, admin, member and guest, plus private teams.
- RLS is the only enforcement layer. Helpers are set-returning `security definer` functions, and the policies fail closed.

See [ADR-0006](adr/0006-auth-and-authorization.md) and [threat-model.md](architecture/threat-model.md).

## K. Supabase architecture (hosted demo + self-hosted)

The same migrations, RPCs and policies run everywhere. The demo is GitHub Pages plus a hosted Supabase project, with migrations pushed from CI.

The self-hosted setup is a trimmed official compose stack:

- Supabase services: db, auth, rest, realtime, storage, meta and the gateway.
- Daiq services: a `migrate` job and the nginx `web` container.

The web app reads `config.json` at runtime, so one image serves every environment. See [ADR-0003](adr/0003-backend-and-data-access.md) and [ADR-0012](adr/0012-deployment.md).

## L. Realtime strategy

Triggers broadcast thin `{entity, id, op}` events on private topics: `team:<id>`, `workspace:<id>` and `user:<id>`. Topics are authorised by RLS on `realtime.messages`.

- Clients refetch the row through PostgREST, so RLS stays the only read gate.
- Events caused by the client's own pending mutations are skipped, and bursts are coalesced.
- On reconnect, clients refetch their active queries.

See [ADR-0007](adr/0007-realtime.md).

## M. Editor choice

Tiptap 3 was chosen over BlockNote (custom JSON, jsdom for server rendering, GPL `xl-*` packages, 188 kB) and Lexical (DIY mentions and slash commands; HTML export needs a DOM).

- ProseMirror JSON is canonical and stored in `jsonb`.
- Markdown and HTML are interoperability formats only.
- The static renderer produces HTML without a DOM, and DOMPurify sanitises every HTML output.

See [ADR-0005](adr/0005-editor.md).

## N. Performance strategy

Budgets:

- ≤ 250 kB gzip of initial JS (measured 241 kB; see performance.md for the breakdown).
- INP ≤ 100 ms.
- 5k-row lists at 60 fps.
- Optimistic changes visible within one frame.

Techniques: route splitting, intent preloading, a persisted query cache, virtualisation, lazy editor and charts, plan-tested indexes, and coalesced realtime. See [performance.md](architecture/performance.md).

## O. Testing strategy

- Unit tests (domain) and component tests (keyboard, focus).
- pgTAP tests for RLS, triggers and RPCs, including a meta-test that every table has RLS.
- Integration tests of the data layer against local Supabase.
- Playwright E2E for 12 critical flows, with axe checks.

See [testing.md](architecture/testing.md).

## P. Docker / self-hosting strategy

- Multi-stage images, built for amd64 and arm64.
- No secrets in images; `.env.example` holds placeholders only.
- Health checks, named volumes, and a migration job with an optional demo seed.
- Upgrade and backup notes in `docker/README.md`.

See [ADR-0012](adr/0012-deployment.md).

## Q. GitHub Pages demo strategy

- Static build with `DAIQ_BASE=/daiquiri/`, `404.html` copied from `index.html`, and `config.json` generated from repository variables.
- Visitors get an anonymous sandbox workspace seeded with realistic data and deleted after 24 h.
- Sandbox creation is rate-limited.
- A weekly keep-alive prevents the Free-tier project from pausing.

Pages needs the repository to be public, or a paid plan.

## R. Implementation phases

Vertical slices 0–10 (skeleton → identity → teams → tasks/list → board → collaboration → filters/views → projects → realtime/inbox → search/My tasks → self-host), then P2 slices. Each slice delivers schema, RLS, data layer, UI and tests, and leaves `main` deployable. See [implementation-priorities.md](product/implementation-priorities.md).

## S. Risks

| Risk                                                        | Impact                           | Mitigation                                                                                                      |
| ----------------------------------------------------------- | -------------------------------- | --------------------------------------------------------------------------------------------------------------- |
| TypeScript 7 has no compiler API until 7.1                  | Tools that need the TS API break | Our toolchain (oxlint-tsgolint, Vite/Oxc, Vitest, Prettier) does not need it; documented alias fallback to TS 6 |
| Pre-1.0 dependencies (TanStack DB, `@dnd-kit/react`, oxfmt) | API churn                        | Not adopted yet; isolated behind our own hooks/components                                                       |
| cmdk unmaintained since 2025-03                             | Breakage on a future React       | Wrapped in `CommandPalette`; Base UI Autocomplete fallback                                                      |
| Supabase self-host compose changes monthly                  | Upgrade friction                 | Pinned snapshot, documented upgrade path                                                                        |
| RLS mistakes                                                | Data leak                        | Set-returning helpers, column grants, pgTAP suite plus meta-test, threat model checklist                        |
| Realtime refetch-per-event cost under heavy activity        | Load                             | Coalescing; thin events; move to TanStack DB direct writes later                                                |
| Free-tier demo pause / abuse                                | Demo outage                      | Keep-alive workflow, sandbox limits, 24 h cleanup, uploads disabled in demo                                     |
| Scope creep toward "everything app"                         | Complexity                       | Principles + REJECT list; every new feature needs a matrix entry                                                |
| Motion majors twice a year                                  | Upgrade churn                    | Pinned major; motion used through `packages/ui` presets                                                         |

## T. Open architectural questions

Resolved through research (no user input needed): editor, DnD, realtime mode, sync layer, validation, linting, SPA routing, demo strategy, background jobs, search.

Still open:

1. **Licence.** AGPL-3.0 is recommended so hosted forks contribute back; MIT would maximise adoption. **Owner decision needed** before the repository goes public. No `LICENSE` file has been added yet.
2. **Demo Supabase project.** The hosted project and its keys must be created by the owner. CI uses repository variables and secrets that are not yet set.
3. **Email delivery for self-hosters.** SMTP is optional. Without it, magic links and invitations fall back to copyable links. This is acceptable and documented.
4. **TanStack DB adoption point.** Re-evaluate when the core reaches 1.0.
5. **Multiple assignees in reporting.** Workload counts a task once for each assignee. This is to be confirmed with real usage.

## Plan review (§32 checklist)

1. **Contradictions checked:**
   - Assignee cardinality is consistently "multiple, single by default".
   - Custom fields are consistently "8 types".
   - Subtask depth is consistently 3.
   - Projects belong to one team throughout.
   - ADR numbers referenced from other docs exist.
2. **Unnecessary complexity removed:**
   - 10 proposed packages collapsed into 4.
   - No API or worker services.
   - No sync server.
   - No feature toggles.
3. **Competitor coverage.** Every ADOPT/ADAPT/SIMPLIFY feature in the matrix maps to a table or RPC in the data model (P2/P3 tables are listed).
4. **GitHub Pages:** static build, base path, `404.html`, runtime config, PKCE.
5. **Docker:** same build, runtime config, migrate job, all services from the official stack.
6. **Multi-tenant security:**
   - `workspace_id` everywhere, composite FKs, forced RLS, column grants.
   - Realtime topics behind RLS; storage paths scoped per workspace.
7. **Editor interoperability:** JSON canonical, Markdown/HTML in and out, sanitised.
8. **Performance:** budgets defined, with enforcement in CI.
9. **Accessibility:**
   - Keyboard grammar, roving focus, and DnD alternatives with live regions.
   - Reduced motion and WCAG 2.2 AA tokens.
   - axe checks in E2E.
