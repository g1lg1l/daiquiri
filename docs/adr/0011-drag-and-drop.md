# ADR-0011 — Drag and drop

- Status: Accepted · Date: 2026-10-22

## Context

Boards and lists need smooth drag and drop across columns, compatible with virtualised lists, with an accessible alternative (WCAG 2.2 SC 2.5.7 requires a non-drag path regardless of library) and easy optimistic updates.

## Alternatives considered

- `@dnd-kit/core` 6 — legacy, no release since 2024-12.
- `@dnd-kit/react` 0.5 — built-in keyboard sensor and announcements, but pre-1.0 with a moving API; virtualisation undocumented.
- **Pragmatic drag and drop 4** (Atlassian, powers Trello/Jira) — ~5 kB core, native HTML5 DnD, works with virtualisation, cross-list support; accessibility via explicit alternatives + live region package.

## Decision

- **Pragmatic DnD** (`@atlaskit/pragmatic-drag-and-drop` + `-hitbox` + `-auto-scroll` + `-live-region`) wrapped in two small hooks in `packages/ui` (`useDraggableItem`, `useDropTarget`).
- **Keyboard path is first-class**, not a fallback: `Mod ↑/↓` reorders, `Mod Shift ↑/↓` moves to top/bottom, `S`/`P`/`A` move between board columns by changing the property, plus a _Move to…_ item in every item menu. Every move (drag or keyboard) is announced via the live region.
- A drop computes the new fractional `sort_key` with `fractional-indexing` (+ jitter) between neighbours and, when the target group differs, the property change; both are applied as one optimistic mutation.
- Motion's layout animations animate the reflow after drop; reduced motion disables them.

## Consequences

- We own the drag preview and drop indicator styling (small amount of code, matches the design system).
- Switch to `@dnd-kit/react` remains cheap because both are behind our hooks.
