# Daiq — Keyboard Navigation

Keyboard support is a product feature, not an accessibility afterthought. This spec is the source of truth for shortcuts; the in-app `?` sheet and the command palette are generated from the same registry (`apps/web/src/features/shortcuts/registry.ts`).

Research basis: [linear-analysis.md §5](../research/linear-analysis.md), [clickup-analysis.md](../research/clickup-analysis.md), [asana-analysis.md](../research/asana-analysis.md).

## Grammar

Daiq shortcuts follow four rules so users can predict them:

1. **One verb, any target.** A property shortcut acts on the _target_: the multi-selection if any, otherwise the focused row/card, otherwise the open task. Bulk edits behave exactly like single edits.
2. **Three layers.**
   - _Single keys_ for frequent verbs (`S` status, `A` assignee…).
   - _Sequences_ for navigation (`G` then a letter) and relations (`R` then a letter). The second key must arrive within 1 s; a hint overlay appears after 400 ms.
   - _Command palette_ (`⌘K` / `Ctrl K`) for everything, including rarely used actions.
3. **Teach in place.** Every menu item, tooltip and palette entry shows its shortcut. Right-click menus mirror the same commands.
4. **Never steal typing.** Single-key shortcuts are disabled while focus is inside an input, textarea, contenteditable or open picker. Modifier shortcuts (`⌘…`) still work where it is safe.

`Mod` = `⌘` on macOS, `Ctrl` elsewhere.

## Global

| Keys                    | Action                                                    |
| ----------------------- | --------------------------------------------------------- |
| `Mod K`                 | Command palette                                           |
| `/`                     | Search                                                    |
| `C`                     | Create task (in current team/project context)             |
| `Mod Shift C`           | Create task in a full-page composer                       |
| `?`                     | Shortcut sheet (searchable)                               |
| `[`                     | Toggle sidebar                                            |
| `Mod Z` / `Mod Shift Z` | Undo / redo last mutation                                 |
| `Mod ,`                 | Settings                                                  |
| `Esc`                   | Close the top-most layer, then clear selection, then blur |

## Go to (`G` then…)

| Keys  | Destination        |
| ----- | ------------------ |
| `G I` | Inbox              |
| `G M` | My tasks           |
| `G P` | Projects           |
| `G T` | Current team tasks |
| `G V` | Views              |
| `G S` | Settings           |

`O` then `T` / `P` / `U` / `V` opens the palette pre-scoped to teams, projects, people or views.

## Lists and boards

| Keys                          | Action                                                                |
| ----------------------------- | --------------------------------------------------------------------- |
| `J` / `K` or `↓` / `↑`        | Move focus (board: within column)                                     |
| `H` / `L` or `←` / `→`        | Board: move focus between columns                                     |
| `Enter`                       | Open focused task                                                     |
| `Space`                       | Peek focused task (side preview)                                      |
| `X`                           | Toggle selection of focused row                                       |
| `Shift J/K` / `Shift ↑↓`      | Extend selection                                                      |
| `Mod A`                       | Select all in view                                                    |
| `Mod ↑` / `Mod ↓`             | Move focused task(s) up/down in manual order (keyboard drag-and-drop) |
| `Mod Shift ↑` / `Mod Shift ↓` | Move to top/bottom                                                    |
| `Mod B`                       | Toggle list ↔ board                                                   |
| `F`                           | Add filter                                                            |
| `Shift F`                     | Clear filters                                                         |
| `Shift V`                     | Display options (grouping, ordering, properties)                      |

## Task properties (on target)

| Keys            | Action                                                             |
| --------------- | ------------------------------------------------------------------ |
| `S`             | Status                                                             |
| `P`             | Priority (`0`–`4` inside the picker for no/urgent/high/medium/low) |
| `A`             | Assignees                                                          |
| `I`             | Assign to me (toggle)                                              |
| `L`             | Labels                                                             |
| `D`             | Due date                                                           |
| `Shift D`       | Start date                                                         |
| `Shift P`       | Move to project                                                    |
| `Shift E`       | Estimate (when enabled for the team)                               |
| `E`             | Edit title (open task)                                             |
| `Mod D`         | Duplicate                                                          |
| `Mod Backspace` | Delete (undoable)                                                  |
| `Mod Shift O`   | Add subtask                                                        |
| `Mod .`         | Copy task link; `Mod Shift .` copies identifier                    |

## Relations (`R` then…)

| Keys  | Action                |
| ----- | --------------------- |
| `R B` | Blocked by…           |
| `R X` | Blocks…               |
| `R R` | Related to…           |
| `R D` | Mark as duplicate of… |
| `R P` | Set parent…           |

## Task detail

| Keys              | Action                                       |
| ----------------- | -------------------------------------------- |
| `Mod Enter`       | Submit comment / save composer               |
| `Shift S`         | Subscribe / unsubscribe                      |
| `M`               | Focus comment box                            |
| `Alt ↑` / `Alt ↓` | Previous / next task in the originating list |

## Inbox

| Keys        | Action               |
| ----------- | -------------------- |
| `J` / `K`   | Move                 |
| `U`         | Toggle read          |
| `Alt U`     | Mark all read        |
| `H`         | Snooze               |
| `Backspace` | Archive notification |

## Pickers

Every property picker is a type-to-filter listbox: type to narrow, `↑/↓` to move, `Enter` to apply and close, `Mod Enter` to apply and keep open (multi-select), `Esc` to cancel. Selected values are listed first.

## Accessibility contract

- Focus is always visible (`:focus-visible` ring using `--color-focus`).
- Lists use roving `tabindex`; `Tab` moves between regions (sidebar → header → list → detail), not between rows.
- Opening a dialog/drawer traps focus; closing restores focus to the invoker.
- Keyboard reordering announces the new position via an `aria-live="polite"` region.
- All shortcuts can be disabled in _Preferences → Keyboard_ (WCAG 2.1.4 Character Key Shortcuts).
