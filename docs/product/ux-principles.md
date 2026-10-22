# Daiq — UX Principles

Companion to [product-principles.md](product-principles.md). This document turns principles into rules a designer or engineer can check a screen against.

## Layout

- **Three zones**: sidebar (navigation), main (the current view), detail (task drawer / side peek). Never more than three simultaneous columns.
- Sidebar ≤ 240 px, collapsible (`[`), and lists only things the user chose to see: Inbox, My tasks, favourites, teams they belong to.
- The main view header holds the view title, view switcher and a single "Display" control. Filters render as removable chips *only when active*.
- Detail opens as a side peek on wide screens and full page on narrow ones; `Esc` always returns focus to the row it came from.

## Density and typography

- Default row height 36 px (compact 32 px). Information density comes from alignment and typography, not from boxes.
- Separate by whitespace and a single hairline divider; avoid nested cards, heavy borders and drop shadows on in-flow content.
- One sans-serif family (Inter-like grotesk, variable weight) plus a monospace for identifiers (`DAQ-142`). Tabular numerals for dates and counts.

## Color

- Semantic tokens only (`--color-fg`, `--color-bg-subtle`, `--color-accent`, `--color-status-started`, …). Components never reference raw palette values.
- Status colors derive from the **status category** (backlog, unstarted, started, done, canceled) — five hues, not a rainbow per status.
- Priority uses shape + one warm hue for *urgent* only. Color is never the only signal (WCAG 1.4.1).
- Light and dark themes are designed together; contrast targets WCAG 2.2 AA (4.5:1 text, 3:1 UI).

## Controls

- Rarely used actions appear on hover/focus or inside the `…` menu and the command palette — not as permanent buttons.
- Every property on a task is editable in place, from the keyboard, with the same picker component (status, priority, assignee, labels, dates, project).
- Pickers are type-to-filter lists with the selected value first and a shortcut hint on the right.
- Destructive actions are undoable (toast with *Undo*, `⌘Z`) rather than confirmed with a modal, except for irreversible ones (deleting a workspace).

## Feedback and motion

- Optimistic first: the UI changes on input; reconciliation with the server is invisible unless it fails, in which case the change is reverted with an explanatory toast.
- Durations: 120–180 ms for most transitions, ≤ 240 ms for panels and dialogs, spring-based for drag and drop. Exit animations are faster than entry.
- Motion communicates *where something went* (a completed task slides into its new group, a created task grows from the composer).
- `prefers-reduced-motion: reduce` replaces movement with opacity changes and disables layout animations.

## Empty, loading and error states

- Empty states teach one action, with its shortcut (e.g. "Press **C** to create your first task").
- Skeletons only on first load of a surface; subsequent navigations render cached data instantly and refresh in the background.
- Errors say what happened and what to do next, never just "Something went wrong".

## Accessibility (non-negotiable)

- Full keyboard operability, visible focus ring (`:focus-visible`), logical tab order, focus restored after dialogs close.
- Lists and boards use roving tabindex with `aria-activedescendant`-free, real focus on rows.
- Drag and drop always has a keyboard path (move via `⌘⇧↑/↓`, status change via `S`) and screen-reader announcements.
- Hit targets ≥ 24 × 24 px (WCAG 2.5.8).

## Responsiveness

- ≥ 1280 px: sidebar + main + side peek.
- 768–1279 px: collapsible sidebar, detail replaces main.
- < 768 px: single column, bottom sheet pickers, board scrolls horizontally per column. Desktop density is never sacrificed to fit mobile.
