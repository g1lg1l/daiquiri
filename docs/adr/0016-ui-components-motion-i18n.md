# ADR-0016 — Form components, motion, toasts, avatars and languages

- Status: Accepted · Date: 2026-10-23 · Amends [ADR-0008](0008-ui-system-and-motion.md)

## Context

The first UI pass used native `<select>` and `<input type="date">` for speed. They look different in every browser, ignore the theme and break the keyboard model of the rest of the app. Popups had a single 120 ms fade, avatars were initials, toasts were stock, the importer was hidden in the team menu and every string was English.

Three component sources were evaluated for the shared basics:

| Source                               | License                            | Verdict                                                                                                                                                                                                   |
| ------------------------------------ | ---------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| [shadcn/ui](https://ui.shadcn.com)   | MIT                                | **Adopted.** Base UI is its default since July 2026, the same primitives we already use, so its Select, Combobox, Calendar and Context Menu patterns drop in.                                             |
| [React Bits](https://reactbits.dev)  | MIT + Commons Clause               | **Not copied.** The Commons Clause adds a restriction that the AGPL forbids (section 7), so its code cannot be redistributed in this repository. Used only as inspiration for effects we write ourselves. |
| [RareUI](https://www.rareui.com)     | MIT + Commons Clause + attribution | **Not copied**, same reason.                                                                                                                                                                              |
| [Sileo](https://sileo.aaryan.design) | MIT                                | **Adopted** for toasts.                                                                                                                                                                                   |
| [Blobatar](https://blobatar.dev)     | MIT                                | **Adopted** for avatars without a photo.                                                                                                                                                                  |

## Decision

- **Select**: Base UI `Select` wrapped in `@daiq/ui` (`Select`, with `items`, `value`, `onValueChange`, `name` for forms). Every native `<select>` goes.
- **Date picker**: `react-day-picker` 10 (MIT, the calendar behind shadcn's) in a popover, with the quick picks we already had (Today, Tomorrow, Next week…). The calendar is lazy-loaded the first time a picker opens, so it never weighs on the initial bundle.
- **Context menus**: Base UI `ContextMenu` on tasks in the list, board, calendar and timeline (right-click or long-press): open, the pickers, assign to me, copy ID or link, delete. In the list it acts on the selection when the task is part of it.
- **Motion** stays native first:
  - popovers, selects, tooltips and dialogs scale from their anchor on a spring written as CSS `linear()` easing; the month grid slides when the month changes;
  - menus grow less (from 97%) and without overshoot, and submenus only fade: an item moving under a resting pointer would hand its hover, and its submenu, to the item next to it;
  - menu items arrive in a short opacity stagger (`sibling-index()`, where supported);
  - completing a task, picking a date or option and copying an identifier get a small pop;
  - `prefers-reduced-motion` turns all of it into instant changes;
  - `motion` (Motion for React) is loaded only by the lazy toast chunk, which needs it. Animated list and board reordering (View Transitions) is left for later.
- **Toasts**: Sileo behind the same `toast()` facade (message, description, action, id), so call sites do not change. The toaster and Motion load after first paint; toasts raised before then are queued. Sileo 0.1.6 is patched (`patches/sileo@0.1.6.patch`) so the toast is not a `<button>` wrapping a link: its action is a real button, and an action toast stays open for its whole life so the action is reachable. Its title and button use the inverted ink for AA contrast.
- **Avatars**: Blobatar draws a deterministic blob from the person's name when there is no photo; it is decorative (`aria-hidden`), the name is always next to it or in its label.
- **Task identifiers**: identifiers are set in the monospace face everywhere; a `TaskId` button in list rows and the task header. Clicking it copies the identifier (inside rows and cards, which are themselves buttons, it stays text and the shortcut or context menu copies it); `Mod+.` copies the focused task's identifier (also from the command palette) and `Mod+Shift+L` its link. Right-clicking a task anywhere opens its actions, copy included.
- **Import** gets its own entry in the sidebar, settings and command palette, and a page that explains each source, what is carried over and what the token is used for.
- **Languages**: English and Italian, with typed dictionaries in `apps/web/src/i18n` rather than a compiler plugin:
  - components read `m.<namespace>.<key>` at render time (never at module scope: the language loads after the modules); sentences with values are functions, so word order is the translator's;
  - English for the app shell (`common`, `shell`, `tasks`, `task`) is in the initial bundle; `auth`, `importer`, `settings` and `team` ship with their screens' chunks (`provide`), and other languages are one chunk loaded before the first render;
  - every language must satisfy English's type, so a missing string fails type checking;
  - the shared packages keep English defaults and expose `localizeDomain`, `localizeEditor` (from `@daiq/editor/strings`, without Tiptap), `localizeUi` and `localizeErrors`, which the language chunk calls;
  - plurals use `Intl.PluralRules`, dates, relative times and numbers use `Intl` with the chosen language;
  - the language is a per-device preference (Settings → Preferences, browser language by default) and changing it reloads the page;
  - stored content stays as written: status and team names, imported comment headings, and server messages (Supabase Auth, SQL errors) are not translated.

## Alternatives

- **Paraglide JS 2** (MIT): compiles messages into tree-shakable functions, but every message function carries all languages, which would add the Italian strings to the initial bundle (~10 kB gzip at 248/250 kB). Revisit if we add many languages and want its tooling.
- **react-i18next / FormatJS**: runtime parsers and 15–40 kB for features we do not use.
- **Writing our own calendar**: a correct, accessible grid (roving focus, Page Up/Down, Home/End, right-to-left, screen-reader labels) is exactly what react-day-picker already tests.

## Consequences

- The initial bundle went from 248 to 244 kB gzip: sonner left, Blobatar (~4 kB) and the shell's English strings (~6 kB) came in; the date picker (~22 kB), toasts (~50 kB with Motion) and Italian (~16 kB) are lazy chunks inside the 90 kB budget.
- Server-generated text (emails, webhook payloads) stays English; the language preference is per device, not stored on the profile, until there is a reason to sync it.
- New UI strings must be added to both dictionaries; type checking enforces it.
