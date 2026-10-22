# Competitor Feature Matrix

> Research date: 2026-10-22. Sources: [clickup-analysis.md](clickup-analysis.md), [asana-analysis.md](asana-analysis.md), [linear-analysis.md](linear-analysis.md).
> Objective: **maximum useful capability / minimum cognitive complexity.**

**Value** — how much users of these tools rely on it (H/M/L).
**Complexity** — cognitive + engineering cost of offering it the way competitors do (H/M/L).
**Decision** — `ADOPT` (as competitors do it), `ADAPT` (same job, Daiq-shaped), `SIMPLIFY` (keep the outcome, cut the surface), `DEFER` (architecture supports it, ships later), `REJECT` (deliberately out of scope).
**P** — priority bucket from [implementation-priorities.md](../product/implementation-priorities.md).

## 1. Structure and tenancy

| Feature | ClickUp | Asana | Linear | Value | Complexity | Daiq decision | P | Why |
|---|---|---|---|---|---|---|---|---|
| Tenant | Workspace | Organization / Workspace (domain-joined) | Workspace | H | L | **ADOPT** Workspace | P0 | Universal concept. Domain auto-join is DEFER (P3). |
| Hierarchy | Space → Folder → Subfolder → List (5 levels) | Team → Portfolio → Project → Section | Team → Project (+ Initiative) | H | H | **SIMPLIFY** Workspace → Team → Project → Task | P0 | ClickUp's depth is its #1 learning-curve complaint; Linear proves two levels suffice. |
| Teams | Spaces act as teams | Teams (departments) | Teams own workflow, IDs, cycles | H | M | **ADOPT** (Linear model) | P0 | One configuration scope below workspace. |
| Private teams | Private Spaces | Private teams | Business tier | H | M | **ADOPT**, free | P1 | Basic need; competitors gate it. |
| Sub-teams | — | Divisions (E) | Up to 5 levels (E) | L | H | **DEFER** | P3 | Enterprise-only demand. |
| Sections inside projects | Lists/Folders | Sections | — (grouping) | M | M | **SIMPLIFY** → grouping in views | P1 | A view grouped by status/label/milestone covers it without a new object. |
| Multi-homing (task in N projects) | Tasks in Multiple Lists (ClickApp) | Core feature | No | M | H | **REJECT** (v1) | — | Field pile-up and "where does it live?" confusion. Labels + saved views cover cross-cutting needs. |
| Initiatives / portfolios / goals | Goals | Portfolios + Goals (A+) | Initiatives | M | H | **SIMPLIFY** → one *Initiative* object (set of projects + owner + rollup) | P3 | Asana's portfolio/goal overhead is a top admin burden. |

## 2. Tasks

| Feature | ClickUp | Asana | Linear | Value | Complexity | Daiq decision | P | Why |
|---|---|---|---|---|---|---|---|---|
| Human IDs (`ENG-142`) | Custom IDs (Business) | ID custom field | Built in | H | L | **ADOPT**, always on | P1 | Linkable, speakable, keyboard-friendly. |
| Rich description | Quill delta, no Markdown write | Rich text | Markdown | H | M | **ADOPT** structured doc + Markdown/HTML interop | P1 | See ADR-0005. |
| Statuses | Per-location custom, 4 groups, inheritance | Boolean + sections/fields/custom types | Per-team, fixed categories | H | H/M | **ADOPT** Linear model: per-team names in fixed categories | P1 | Categories make reports, automations and team moves deterministic. |
| Triage status | — | — | Opt-in category | M | L | **ADOPT** as optional category | P2 | Intake from forms lands there. |
| Priority | 4 fixed + none | Custom field | 4 fixed + none | H | L | **ADOPT** fixed 5-level | P1 | All three converge; not customisable by design. |
| Assignees | Single or multiple (ClickApp), group assignees | Single | Single | H | L | **ADAPT**: multiple allowed, single by default in UI | P1 | Brief requires multi; non-software teams expect it. No group assignees. |
| Followers / subscribers | Auto-follow on almost any touch | Collaborators | Subscribers (create/assign/mention) | H | M | **ADAPT**: participation-based only | P1 | ClickUp/Asana noise complaints. Editing does not subscribe. |
| Start & due dates | Yes (+time) | Yes (start S+) | Due only (or SLA) | H | L | **ADOPT** dates (day granularity) | P1 | Calendar/timeline need start + due. Time-of-day DEFER. |
| Estimates | Time + points (+per assignee) | Time fields (A+) | Team scale | M | M | **SIMPLIFY**: one numeric estimate per team scale, off by default | P2 | One effort concept per team. |
| Time tracking | Timer + entries | A+ / add-on | — | M | M | **SIMPLIFY**: timer + manual entries, no timesheets/billing | P2 | |
| Labels / tags | Space tags + Labels field | Tags | Labels + label groups | H | L | **ADOPT** workspace labels | P1 | Label groups DEFER (P2). |
| Custom fields | 23 types, 4 scopes | Local + library, formulas | None | H | H | **SIMPLIFY**: 8 types, workspace-defined, enabled per team, capped | P2 | Linear's main gap for non-software teams; ClickUp's sprawl shows the cost of no cap. |
| Sub-tasks | 7 levels, default 3 | Any depth, features stop at L1 | Multi-level | H | M | **ADAPT**: max depth 3, consistent behaviour at every depth, inline in views | P1 | Avoid Asana's depth-dependent semantics. |
| Checklists | 250/task, nested 5 | — (subtasks) | — | M | M | **SIMPLIFY** → task-list items in the description | P1 | One primitive per job. |
| Dependencies | Blocks/waiting on + warnings + reschedule | Blocked by/blocking, notify once | Blocks/blocked/related/duplicate | H | M | **ADOPT** blocks/related/duplicate + close warning + notify-once | P1 | Converged model. Date auto-shift DEFER (P2). |
| Duplicate detection / merge | Merge tasks | — | Duplicate status | M | M | **ADAPT**: "mark duplicate" relation → cancels the task | P2 | |
| Recurring tasks | Rich options | Yes | Yes | M | M | **ADAPT**: on schedule / on completion, new instance each time | P2 | Reuse-same-task mode REJECTED (history confusion). |
| Task templates | Yes | Yes | Yes | M | L | **ADOPT** (one template concept, optional form fields) | P2 | |
| Duplicate task | Yes | Yes | Yes | M | L | **ADOPT** | P1 | |
| Milestone as task type | — | Task subtype | Project milestones | M | L | **ADAPT** → project milestones; tasks link to one | P2 | |
| Approvals | Assigned comments | Task type (A+) | — | L | M | **SIMPLIFY** → status in a "review" step + assigned comments | P3 | |
| Custom task types | Yes | Yes (S+) | — | L | H | **REJECT** | — | Labels + templates cover it; types fragment fields and statuses. |
| Activity history | Per task + Activity view | Stories | History, early-edit folding | H | M | **ADOPT** with Linear's 3-minute folding | P1 | |
| Trash / restore | Yes | 30 days | 30 days + undo | H | L | **ADOPT** soft delete + undo + 30-day purge | P1 | |

## 3. Collaboration

| Feature | ClickUp | Asana | Linear | Value | Complexity | Daiq decision | P | Why |
|---|---|---|---|---|---|---|---|---|
| Comments (rich) | Yes | Yes | Yes | H | M | **ADOPT** | P1 | |
| Threaded replies | ClickApp | Since Sep 2026 | Yes | M | L | **ADOPT** one level | P1 | |
| Mentions (people, tasks) | `@`, `@@`, `@@@` | `@` | `@` + issue refs | H | M | **ADOPT** `@` people, `#`/ID for tasks | P1 | Mentioning a task creates a "related" link (Linear). |
| Reactions | Yes | Likes | Yes | M | L | **ADOPT** | P1 | |
| Assigned comments | Distinctive | — | — | M | M | **DEFER** | P2 | Valuable but adds a second to-do primitive; revisit with My tasks. |
| Attachments | Yes (1 GB) | Yes | Yes | H | M | **ADOPT** via Storage, size/type limits | P2 | |
| Edit history | Activity | — | Description history | L | M | **DEFER** | P3 | |
| Presence | Yes | — | Limited | L | M | **DEFER** | P3 | Realtime channel supports it later. |
| Realtime updates | Yes | Yes | Sync engine | H | H | **ADOPT** scoped broadcast + optimistic UI | P1 | See ADR-0004/0007. |
| Collaborative editing | Docs | Since Jun 2026 | Docs | L | H | **DEFER** | P3 | Needs CRDT; LWW suffices for task fields. |

## 4. Views, filters and planning

| Feature | ClickUp | Asana | Linear | Value | Complexity | Daiq decision | P | Why |
|---|---|---|---|---|---|---|---|---|
| List | Yes | Yes (editor-like) | Yes | H | M | **ADOPT** with Asana's `Enter`/paste creation | P1 | |
| Board | Yes | Yes | Yes | H | M | **ADOPT**; dropping into a group writes the property | P1 | |
| Calendar | Yes | Yes | No | M | M | **ADOPT** (lazy-loaded) | P2 | |
| Timeline / Gantt | Both, metered | Timeline/Gantt (S+) | Projects only | M | H | **SIMPLIFY**: one timeline for projects *and* dated tasks, dependencies drawn | P2 | Merge Gantt + timeline into one lens. |
| Table / spreadsheet | Table view | List is spreadsheet-like | — | M | M | **SIMPLIFY** → list view with column layout | P2 | One list component with dense column mode. |
| Workload | Workload view | A+/E | — | M | H | **SIMPLIFY**: open tasks per person per week | P3 | |
| Mind map, map, whiteboard, doc views | Yes | — | — | L | H | **REJECT** | — | Sprawl. |
| My tasks | Me Mode + Home + Planner… | My Tasks (sections, auto-sort) | My issues tabs | H | M | **ADOPT** one page: assigned/created/subscribed, due buckets | P1 | One personal surface, not eight. |
| Filters | Rich, per view | Advanced search (S+) | Typed, AND/OR, URL-encoded | H | M | **ADOPT** Linear model, URL-encoded | P1 | Nested AND/OR DEFER (P2). |
| Group / sub-group / sort | Yes | Yes | Yes | H | M | **ADOPT** group + order; sub-group P2 | P1 | |
| Saved views (personal / shared) | Yes + many flags | Saved searches | Yes | H | M | **ADOPT** with explicit "modified" state | P1 | Fix Linear's hidden per-user state complaint. |
| Cycles / sprints | Sprint Folders | — | Cycles with rollover | M | M | **ADAPT**: optional team module, auto-schedule + rollover | P2 | No Scrum vocabulary required. |
| Projects (lead, status, dates) | Lists | Projects + status | Projects + health | H | M | **ADOPT** | P1 | |
| Project updates (health) | — | Status updates | Updates + reminders | M | L | **ADOPT** fixed health values | P2 | |
| Milestones | Milestone tasks | Milestone tasks | Project milestones | M | L | **ADOPT** project milestones | P2 | |
| Roadmap | Gantt | Portfolios | Timeline + initiatives | M | M | **SIMPLIFY** → project timeline | P2 | |
| Releases | — | — | CI pipelines | L | H | **REJECT** (core) | — | Software-only; webhooks enable integrations. |

## 5. Automation, templates, intake

| Feature | ClickUp | Asana | Linear | Value | Complexity | Daiq decision | P | Why |
|---|---|---|---|---|---|---|---|---|
| Rule engine | 1 trigger + 15 conditions + 6 actions, quotas | 20 triggers × branches × 20 actions | Minimal + AI Loops | H | H | **SIMPLIFY**: When 1 trigger · If filters · Then 1–3 actions; system actor; extensible registry | P2 | Asana's builder became a programming environment. |
| Automation quotas / metering | Yes | Yes | Credits | — | — | **REJECT** | — | Self-hosted, no metering. |
| Workflow automations (built-in) | ClickApps | — | Auto-close/archive, parent close | M | L | **ADOPT** as team settings: close parent when children done, auto-close stale | P2 | |
| Project templates | Yes | Yes | Yes | M | M | **ADOPT** | P2 | |
| Workflow/status templates | Status templates | — | Team templates | M | L | **ADOPT** team templates (Software, Marketing, Ops, Generic) | P1 | Avoid software-only defaults (Linear weakness). |
| Forms | Yes (1 on Free) | S+ | Business/E | M | M | **ADOPT**, free; submissions → triage | P2 | |
| Email-to-task | Yes | Yes | Yes | L | M | **DEFER** | P3 | Needs inbound mail infra. |
| SLAs | — | — | Business | L | M | **DEFER** (single rule type) | P3 | |

## 6. Communication and notifications

| Feature | ClickUp | Asana | Linear | Value | Complexity | Daiq decision | P | Why |
|---|---|---|---|---|---|---|---|---|
| Inbox | Primary/Other/Later/Cleared | Activity/Bookmarks/Archive | Subscription-based, snooze | H | M | **ADOPT** Inbox/Snoozed/Archived, keyboard triage | P1 | |
| Notification settings | ~75 triggers × 4 channels, some mandatory | Many channels | Simple | H | H | **SIMPLIFY**: All / Participating (default) / Mute per team + digest | P2 | Noise is a top complaint for ClickUp and Asana. |
| Email notifications | Yes | Superset of inbox | Only if still unread | M | M | **ADOPT** Linear rule: email only if unread after N minutes | P3 | Needs SMTP; optional in self-host. |
| Chat, clips, video calls | Yes | Meetings/Pages | — | L | H | **REJECT** | — | Anti-goal. |
| Slack integration | Yes | Yes | Yes | M | M | **DEFER** (via webhooks first) | P3 | |

## 7. Search, keyboard, speed

| Feature | ClickUp | Asana | Linear | Value | Complexity | Daiq decision | P | Why |
|---|---|---|---|---|---|---|---|---|
| Command palette | AI Command Bar | None | `⌘K` contextual | H | M | **ADOPT** Linear model | P0 | |
| Global search | Broad + AI | Quick + advanced | `/` full text | H | M | **ADOPT** Postgres FTS + trigram | P1 | |
| Keyboard shortcuts | Off by default | Tab-chords | Single keys + chords | H | M | **ADOPT** Linear grammar, on by default | P0 | |
| Space-to-peek | — | — | Yes | M | L | **ADOPT** | P1 | |
| Bulk edit | Toolbar | Multi-select | Selection + same shortcuts | H | M | **ADOPT** | P1 | |
| Optimistic, local-first UI | — | — | Sync engine | H | H | **ADAPT**: normalized client store + optimistic mutations + realtime | P0 | See ADR-0004. |
| Undo | Inbox only | Some | Deletes, moves | H | M | **ADOPT** for every mutation via inverse operations | P1 | |
| Prefill URLs (`/new?title=`) | Form URL prefill | — | `linear.new` | L | L | **ADOPT** | P2 | |

## 8. Reporting

| Feature | ClickUp | Asana | Linear | Value | Complexity | Daiq decision | P | Why |
|---|---|---|---|---|---|---|---|---|
| Dashboards (card canvas) | 60+ cards, 30-min refresh | Universal reporting (S+/A+) | Insights (Business), Dashboards (E) | M | H | **SIMPLIFY**: fixed live insights per team/project/view | P2 | Zero setup; no chart builder. |
| Burndown / burn-up | Sprint cards | — | Cycle graphs | M | M | **ADOPT** burn-up for cycles/projects | P2 | |
| Throughput, cycle time, time in status | Partial | E for time-to-complete | Insights | M | M | **ADOPT** as fixed charts | P2 | |
| Overdue, status distribution, workload | Cards | Charts | Insights | H | L | **ADOPT** | P2 | |
| CSV export | Yes | Yes | Yes | M | L | **ADOPT** | P2 | |

## 9. Platform and administration

| Feature | ClickUp | Asana | Linear | Value | Complexity | Daiq decision | P | Why |
|---|---|---|---|---|---|---|---|---|
| Roles | Owner/Admin/Member/Limited/3 guest types, custom roles | Member/Guest/Limited + project roles | Admin/Member/Guest (+Owner E) | H | H | **SIMPLIFY** Owner/Admin/Member/Guest + private teams | P0 | |
| Per-item permission overrides | Task > List > Folder… | Project roles | — | L | H | **REJECT** (v1) | — | Team privacy is the only boundary below workspace. |
| Guests | Yes | Free on S+ | Business | M | M | **ADOPT**: guests see only teams they are added to | P1 | |
| Invitations | Yes | Yes | Yes | H | L | **ADOPT** expiring single-use links | P0 | |
| Feature toggles ("ClickApps") | 38 admin toggles | Customize menu | Team modules | — | H | **REJECT** toggles; only 3 team modules (cycles, estimates, triage) | — | Features ship on with defaults. |
| Public API | REST v2/v3 | REST + events | GraphQL (same as app) | H | M | **ADOPT** PostgREST + RPC is the API the app uses | P2 | Same API for app and integrations. |
| Webhooks | Signed, before/after | Signed, at-most-once | Signed, previous values, retries | M | M | **ADOPT** signed, retried, before/after | P3 | |
| SSO / SCIM / audit export | E | E / add-on | E | L | H | **DEFER** | P3 | Supabase Auth supports SAML when needed. |
| AI agents / credits | Brain, Super Agents | AI Teammates, credits | Linear Agent, Loops | — | H | **REJECT** (core) | — | Expose API/webhooks/MCP; AI is a plugin concern. |
| Plan gating / seat blocks | Yes | Yes | Yes | — | — | **REJECT** | — | Open source and self-hosted. |
| Import (CSV, competitors) | Yes | Yes | Yes | M | M | **DEFER** | P3 | |

## Summary

- **Adopted almost verbatim**: Linear's team/status-category/priority/identifier model, its keyboard grammar and command palette; Asana's editor-like list and My Tasks vs Inbox split; ClickUp's multi-assignee option and "many layouts over one query".
- **Simplified**: hierarchy (2 containers), configuration scopes (3), custom fields (8 types, capped), automations (one sentence), reporting (fixed live charts), notifications (participation-based).
- **Rejected**: multi-homing, ClickApps-style toggles, custom task types, per-item permissions, chat/docs/whiteboards, metered AI and any plan gating.
