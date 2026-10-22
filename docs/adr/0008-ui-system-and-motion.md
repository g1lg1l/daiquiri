# ADR-0008 — UI system, theming and motion

- Status: Accepted · Date: 2026-10-22

## Context

Daiq needs an original, calm, dense, accessible design system with light/dark/system themes and a significant amount of subtle motion that never costs performance.

## Decision

- **Tailwind CSS 4.3** with CSS-first configuration (`@theme`) in `packages/ui/src/styles.css`.
- **Semantic tokens only**: colours defined in OKLCH as CSS variables (`--bg`, `--bg-subtle`, `--fg`, `--fg-muted`, `--border`, `--accent`, `--focus`, `--status-<category>`, `--priority-urgent`, …) with light and dark values; Tailwind utilities map to tokens. Components never use raw palette classes.
- Theme switching via `data-theme` on `<html>` (`light | dark | system`), set before first paint by an inline script to avoid a flash.
- **shadcn CLI 4 with Base UI** (`@base-ui/react` 1.x) as *copied, owned code* in `packages/ui`, restyled to Daiq tokens. Primitives handle focus, ARIA and keyboard behaviour.
- **Icons**: `lucide-react` (ISC), imported per icon.
- **Toasts**: `sonner`. **Command palette**: shadcn `Command` (cmdk) wrapped in our own `CommandPalette` so the engine can be swapped.
- **Motion**: CSS transitions/`@starting-style` for trivial effects (hover, focus, colour); **View Transitions API** for route and layout switches where supported; **Motion for React 14** (`motion/react`, pinned major, `LazyMotion` + `domAnimation` to keep it small) for layout animations (list mutations, board moves, completion), presence (dialogs, popovers, drawers) and springs (drag and drop).
- Motion tokens: `--duration-fast: 120ms`, `--duration-base: 180ms`, `--duration-slow: 240ms`, standard and emphasised easing curves; exported as JS constants for Motion.
- `prefers-reduced-motion: reduce` → `MotionConfig reducedMotion="user"` and CSS media queries replace movement with opacity.
- Typography: Inter Variable (self-hosted, `font-display: swap`) + JetBrains Mono for identifiers; tabular numerals.

## Consequences

- Owning component code means upgrades are manual, but no design-system lock-in.
- Motion adds ~20 kB gzip with `LazyMotion`; loaded with the app shell because most surfaces animate. Measured in the bundle budget.
