# Daiq — Product Principles

> **Everything your team needs. Nothing it doesn't.**

These principles are the tie-breakers for every product, design and engineering decision.
When two good options conflict, the one that better serves the principle higher in this list wins.

## 1. Clarity beats configurability

A new member must understand a Daiq workspace within minutes.

- One obvious way to do common things. Two ways only when one is a keyboard accelerator.
- Sensible defaults ship enabled. Nothing important hides behind a feature toggle ("ClickApps"-style switches are explicitly rejected).
- Hierarchy is shallow: **Workspace → Team → Project → Task**. No spaces/folders/lists maze.
- Vocabulary is plain: _task_, _project_, _team_, _status_. Scrum words (sprint, story points) are optional labels, never required concepts.

## 2. Speed is a feature

The product must feel instant. Users should never wait for something the app could have predicted.

- Every safe mutation is optimistic; spinners are a bug report.
- Data the user is likely to need next is prefetched (hover, focus, route intent).
- Long lists are virtualized. Heavy surfaces (editor, charts, timeline) load on demand.
- We publish measurable budgets (see `docs/architecture/performance.md`) and enforce them in CI.

## 3. Keyboard first, mouse friendly

A power user can run Daiq without touching the mouse; a casual user never needs to know that.

- `⌘K` reaches everything. `C` creates. `/` searches. `?` shows shortcuts.
- Shortcuts are discoverable in-context (tooltips, menus, palette) rather than memorised from docs.
- Every mouse interaction has a keyboard equivalent, including drag and drop.

## 4. Progressive disclosure

Power exists, but it appears when it is needed.

- Empty fields stay hidden on a task until set (or until the user asks via `⌘K`/the "+" field menu).
- Advanced configuration (automations, custom fields, workflows) lives one level deeper than daily work.
- Views start as a clean list; grouping, sub-grouping, filters and display options are one keystroke away, not permanently on screen.

## 5. One model, many views

List, board, calendar, timeline and table are _lenses_ over the same task model and the same filter engine. Business logic never lives in a view.

## 6. Calm, not loud

- Notifications are opt-out of noise, not opt-in to silence: you hear about what you are assigned, mentioned in or subscribed to — nothing else by default.
- Color carries meaning (status category, priority urgency), never decoration.
- Motion explains cause and effect, then gets out of the way. It respects `prefers-reduced-motion`.

## 7. Trustworthy by construction

- Tenant isolation is enforced by the database (RLS + composite foreign keys), not by hiding UI.
- Content is stored as structured documents and rendered through a sanitizer; raw user HTML is never trusted.
- Self-hosting is first-class: the same code runs on the hosted demo and on `docker compose up -d`.

## 8. Built to last

- Boring, well-supported technology over novelty.
- Small modules with clear owners; domain rules live in one place and are unit tested.
- Every shipped feature is production quality. "MVP" is a scope decision, never a quality excuse.

## Anti-goals

Daiq deliberately does **not** try to be:

- a document wiki, chat app, whiteboard or email client;
- an infinitely configurable "everything app";
- a tool that requires an administrator to set up before a team can start working.
