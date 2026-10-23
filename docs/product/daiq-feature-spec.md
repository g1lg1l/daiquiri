# Daiq — Feature Specification

The functional source of truth. Each feature lists its behaviour, defaults and priority (P0–P3, see [implementation-priorities.md](implementation-priorities.md)). Decisions and their rationale are in [competitor-feature-matrix.md](../research/competitor-feature-matrix.md).

---

## 1. Accounts, workspaces and access

### 1.1 Authentication — P0

- Email + password and magic link (Supabase Auth, PKCE flow). OAuth providers (GitHub, Google) are configuration, not code.
- **Demo mode**: "Try the demo" signs the visitor in anonymously and provisions a private sandbox workspace seeded with realistic data. Sandboxes are deleted after 24 h.
- Sessions persist across reloads; sign-out clears the local cache.

### 1.2 Workspaces — P0

- Create with name + slug (slug auto-derived, editable, unique). Creator becomes **owner**.
- Creating a workspace also creates a first team chosen from a **team template** (Software, Marketing, Operations, Generic) which sets statuses and modules.
- A user can belong to many workspaces; the switcher remembers the last one.

### 1.3 Members, roles, invitations — P0 (roles), P1 (UI)

- Roles: **owner, admin, member, guest** (see [database-model.md §5](../architecture/database-model.md)).
- Invitations by email with a role; links are single-use, expire after 7 days, revocable. Accepting requires signing in with the invited address.
- Admins change roles and remove members; the last owner cannot be demoted or removed.

### 1.4 Teams — P1

- Name, key (`ENG`, 2–6 chars, used in identifiers), optional description, privacy (public / private).
- Members join public teams freely; private teams are invite-only and invisible to non-members.
- Modules (off by default except as set by template): **cycles**, **estimates**, **triage**.
- Workflow editor: add, rename, reorder statuses inside the fixed categories; delete with re-mapping.

## 2. Projects — P1 (core), P2 (milestones, updates)

- Belong to one team. Fields: name, description (rich), lead, status (planned / active / paused / completed / canceled), start date, target date.
- Project page: overview (description, progress by status category, lead, dates), tasks tab (any view), updates tab (P2).
- **Progress** = completed ÷ (all − canceled) tasks, sub-tasks included.
- **Milestones** (P2): ordered, optional date; tasks link to one milestone; progress per milestone.
- **Project updates** (P2): health (on track / at risk / off track) + rich text; latest update shown in project lists; optional weekly reminder to the lead.
- Archive hides a project from the sidebar and pickers; tasks remain searchable.
- Favorites and recently viewed apply to projects (and tasks, views).

## 3. Tasks — P1

### 3.1 Fields

| Field                                           | Behaviour                                                                                                     |
| ----------------------------------------------- | ------------------------------------------------------------------------------------------------------------- |
| Identifier                                      | `TEAMKEY-N`, sequential per team, immutable within the team                                                   |
| Title                                           | Required, single line, ≤ 500 chars                                                                            |
| Description                                     | Rich document (see §8); empty by default                                                                      |
| Status                                          | Required; defaults to the team's first _Unstarted_ status (or _Backlog_ when created from the backlog/triage) |
| Priority                                        | None / Urgent / High / Medium / Low                                                                           |
| Assignees                                       | 0..n workspace members (UI optimised for one; adding a second is explicit)                                    |
| Labels                                          | 0..n workspace labels                                                                                         |
| Project                                         | 0..1 project of the same team                                                                                 |
| Parent                                          | 0..1 task of the same team; depth ≤ 3                                                                         |
| Start / due date                                | Calendar days; due ≥ start                                                                                    |
| Estimate                                        | Only when the team enables estimates                                                                          |
| Creator, created/updated, completed/canceled at | System-managed                                                                                                |

Empty optional fields are hidden in the task view and reachable via the property bar, `⌘K`, or their shortcut.

### 3.2 Creation

- `C` anywhere opens the quick composer pre-filled from context (current team, project, view filters — e.g. creating from a board column sets that status).
- In list view, `Enter` on the last row of a group creates the next task inline; pasting multiple lines into the composer offers to create one task per line.
- `Mod Enter` saves and keeps the composer open ("create more").
- Composer state survives navigation (draft kept locally).

### 3.3 Editing

- Every property is editable inline, from the keyboard, with the shared picker.
- All edits are optimistic and undoable (`Mod Z`, toast _Undo_).
- **Bulk edit**: select with `X`/`Shift`-click/`Mod A`; the same shortcuts and pickers apply to the selection.

### 3.4 Sub-tasks

- Created from the task view (`Mod Shift O`) or by indenting in the composer.
- Shown inline under the parent in list views (collapsible) regardless of sorting; shown as a progress count on cards.
- Optional team setting: _close parent when all sub-tasks are completed_.

### 3.5 Relations

- _Blocks / blocked by_, _related_, _duplicate of_. Mentioning a task identifier in a description or comment creates a _related_ link.
- Completing a task that blocks others notifies the blocked tasks' assignees once all their blockers are done.
- Closing a task that is still blocked shows a non-modal warning with _Complete anyway_.
- Marking a task as duplicate moves it to the team's first _Canceled_ status and links it.

### 3.6 Deletion

- Delete is a soft delete with immediate undo; deleted tasks are restorable from _Settings → Trash_ for 30 days.

### 3.7 Recurring tasks — P2

- Rule: every N days/weeks/months (with weekday selection) **or** N days after completion.
- On trigger, a new task is created from the original's fields (title, description, assignees, labels, project, priority, relative dates); history stays on each instance.

### 3.8 Templates — P2

- Task templates (pre-filled fields and sub-tasks) and project templates (project + tasks + milestones). Applying a template remaps relative dates.

### 3.9 Custom fields — P2

- Types: text, number, date, select, multi-select, person, checkbox, URL.
- Defined at workspace level, enabled per team (max 12 per team). Filterable, sortable, groupable (select/person).

### 3.10 Time — P2

- Estimates (team scale: points 1/2/3/5/8 or hours) when enabled.
- Time log per task: start/stop timer (one running timer per user) and manual entries.

## 4. Collaboration — P1

- **Comments** with rich text, `@mentions`, task references, one level of replies, reactions, edit (marked _edited_) and delete.
- **Activity** feed interleaved with comments (toggle _Show activity_), with field changes rendered as sentences ("Ana changed priority from High to Urgent").
- **Subscriptions**: creator, assignees, commenters and mentioned users are subscribed automatically; anyone can subscribe/unsubscribe (`Shift S`).
- **Realtime**: changes made by others appear within ~1 s without reload; your own edits are instant.
- **Attachments** (P2): drag-and-drop or paste into description/comments; images preview inline; 25 MB default limit; allow-listed MIME types.

## 5. Notifications and Inbox — P1

- Events: assigned to you, mentioned, comment on a subscribed task, status change on a subscribed task, task you are blocked by completed, invitation accepted (for inviter).
- Never notified about your own actions. Bursts on the same task within 2 minutes collapse into one item.
- Inbox tabs: _Inbox_, _Snoozed_, _Archived_. Actions: open, mark read/unread, snooze (later today, tomorrow, next week, custom), archive, unsubscribe.
- Unread count in the sidebar and the document title.
- Settings (P2): per team _All / Participating / Mute_; email digest (P3, requires SMTP).

## 6. Views — P1 (list, board), P2 (calendar, timeline)

- **Layouts**: List (with optional columns), Board, Calendar, Timeline. All read the same filtered task set.
- **Display options**: group by (status, priority, assignee, project, label, due bucket, none), order by (manual, priority, due date, created, updated), shown properties, show sub-tasks, show completed (none / past week / all).
- **Board**: columns = groups; dragging a card into another column writes that property (status, priority, assignee…); manual order within a column.
- **Calendar**: tasks by due date (or span start→due); drag to reschedule.
- **Timeline**: projects and dated tasks as bars; drag edges to change dates; dependency arrows.
- **Saved views**: name + filters + display options + layout; personal or shared with the workspace/team; favoritable. A _Modified_ chip appears when the current state differs from the saved view, with _Save_ / _Reset_.
- **State in the URL**: any view (saved or ad-hoc) is reproducible from its URL.

## 7. Filtering — P1

- Filterable properties: status (and status category), priority, assignee (incl. _me_, _none_), creator, project, team, label, due date / start date (relative ranges: overdue, today, this week, next N days, none), created/updated date, parent/has sub-tasks, relations (blocked, blocking), text (title/description), custom fields (P2).
- Operators: is / is not / is any of / is none of / before / after / is empty.
- Filters combine with AND at top level; OR groups are P2.
- The filter engine lives in `packages/domain` and compiles to both a client-side predicate (instant filtering of cached data) and a server query (PostgREST filters) from one definition.

## 8. Editor — P1

- Used for task descriptions, comments and project descriptions; loaded lazily.
- Markdown shortcuts, slash menu, headings, bold/italic/strike/inline code, links, bullet/numbered/task lists, blockquote, code blocks with syntax highlighting, tables, images, mentions, task references, horizontal rule.
- Paste from Google Docs, Notion, Word, GitHub and plain Markdown keeps structure.
- Canonical storage: structured JSON document. Markdown and HTML import/export via the editor package; all HTML output passes through a sanitizer. See [ADR-0005](../adr/0005-editor.md).

## 9. Search and command palette — P0 (palette), P1 (search)

- `Mod K` palette: actions (contextual to the current screen and selection), navigation, recently viewed, and search results. Prefixes scope results: `>` actions, `#` tasks, `@` people, `p:` projects.
- Typing an identifier (`ENG-142`) + `Enter` opens it directly.
- `/` opens search: tasks (title, identifier, description), projects, people, labels; comments in P2. Results ranked by exact identifier, title prefix, full-text rank, recency.

## 10. My tasks — P1

- Assigned to me, grouped by _Overdue · Today · This week · Next week · Later · No date_; manual order within groups.
- Tabs: _Assigned_, _Created_, _Subscribed_.

## 11. Planning — P2

- **Cycles** (team module): length 1–4 weeks, start weekday, auto-created 3 cycles ahead; unfinished tasks roll over automatically; cycle page shows progress and burn-up.
- **Initiatives** (P3): named set of projects across teams, owner, target date, rollup progress and latest project health.

## 12. Automations — P2

- Sentence builder: **When** ⟨trigger⟩ **If** ⟨filters⟩ **Then** ⟨1–3 actions⟩.
- Triggers: task created, status changed (to category or status), field changed, assignee changed, moved to project, due date reached/approaching, comment added.
- Actions: set status, set priority, assign/unassign, add/remove label, set project, set due date (relative), create sub-task from template, notify user(s), call webhook.
- Runs as the _Automation_ system actor; never notifies by itself unless the action is _notify_; loop protection (an automation cannot re-trigger itself within the same chain, max depth 3).
- Run log per automation (last 100 runs, success/failure + reason).

## 13. Forms — P2

- Per team; fields map to task properties and custom fields; public link or workspace-only; submissions create tasks in _Triage_ (or a chosen status) with the submitter's email recorded.
- Abuse protection: rate limiting per IP, optional CAPTCHA on public forms, size limits.

## 14. Insights — P2

- Fixed, live charts available on any team, project, cycle or saved view: status distribution, created vs completed (throughput), cycle time, time in status, overdue count, open work by assignee, burn-up.
- Insights are a layout of every task view, so they always use the view's filters. Counts (status mix, throughput, burn-up, overdue, open work by assignee, lead time) come from the view's loaded tasks; time in status and cycle time come from `status_flow()`, which aggregates the activity log for the view's task ids under RLS. The chart code is lazily loaded.
- Every view exports its tasks as CSV (formula cells neutralised) or JSON.

## 15. Settings and administration — P1 (core), P3 (advanced)

- Personal: profile, theme (light / dark / system), density, keyboard shortcuts on/off, notification preferences.
- Workspace: general, members, invitations, teams, labels, custom fields, templates, automations, webhooks, trash, audit log (P3), export (P2: CSV/JSON).

## 16. Integrations and API — P2/P3

- The PostgREST + RPC API used by the web app is the public API (documented, with personal access tokens in P3).
- Webhooks (P3): signed (HMAC-SHA256), retried with backoff, payload includes previous values, per-event subscription, delivery log.

## 17. Non-functional requirements

- **Performance**: see [performance.md](../architecture/performance.md).
- **Accessibility**: WCAG 2.2 AA target; see [ux-principles.md](ux-principles.md).
- **Security**: see [SECURITY.md](../../SECURITY.md) and [ADR-0006](../adr/0006-auth-and-authorization.md).
- **Internationalisation**: English UI first; strings centralised; dates/numbers via `Intl`; week start configurable.
