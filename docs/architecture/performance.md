# Daiq — Performance Budgets and Strategy

Performance is a product feature. Budgets are measured, enforced in CI where feasible, and regressions are bugs.

## Budgets

| Metric                                      | Budget                               | How it is measured                                             |
| ------------------------------------------- | ------------------------------------ | -------------------------------------------------------------- |
| Initial JS (shell + first route), gzip      | ≤ 200 kB                             | `pnpm --filter web size` (script over `dist/assets`, fails CI) |
| Any lazily loaded route chunk, gzip         | ≤ 90 kB                              | same script                                                    |
| Editor chunk, gzip                          | ≤ 140 kB                             | same script                                                    |
| LCP, signed-in task list, desktop broadband | ≤ 1.5 s                              | Playwright trace on `vite preview`                             |
| INP p75                                     | ≤ 100 ms (hard limit 200 ms)         | Web-vitals in the logger; Playwright interaction timings       |
| CLS                                         | ≤ 0.05                               | Web-vitals                                                     |
| Optimistic mutation visible                 | next frame (≤ 16 ms after input)     | Component test with fake timers + Playwright                   |
| Open task from list (cached)                | ≤ 100 ms                             | Playwright                                                     |
| Team list with 5,000 tasks                  | first render ≤ 150 ms; 60 fps scroll | Playwright with seeded data; DevTools profile on regressions   |
| Board with 2,000 cards                      | drag at 60 fps                       | Manual profile per release                                     |
| PostgREST team task list (5k rows)          | p95 ≤ 150 ms server time             | `explain analyze` pgTAP plan checks; `pg_stat_statements`      |
| RPC (create workspace, search)              | p95 ≤ 100 ms                         | pgTAP timing smoke + `pg_stat_statements`                      |
| Realtime propagation                        | p95 ≤ 1 s                            | Two-browser E2E                                                |

## Techniques

**Loading**

- Route-level code splitting (`autoCodeSplitting`), `defaultPreload: 'intent'` (hover/focus preloads route code _and_ loader data).
- Editor, calendar, timeline and charts are lazy chunks; read-only rich text uses the static renderer, not the editor.
- Self-hosted Inter Variable subset, `preload` for the main weight; no third-party requests on load.
- Long-cache hashed assets; `config.json` is `no-cache`.

**Data**

- Persisted TanStack Query cache (IndexedDB) → instant paint on reload, background refresh.
- One request per screen: PostgREST resource embedding for tasks + assignees + labels; no N+1.
- Server-side pagination beyond 2,000 rows per list; filters pushed to the server when the cached set is incomplete.
- Indexes designed per access pattern ([database-model.md §6](database-model.md)); hot queries have plan tests asserting index usage.
- Realtime thin events, coalesced (100 ms), bounded channel count.

**Rendering**

- TanStack Virtual for lists > 100 rows and board columns > 50 cards.
- Row components are memoised and receive primitive props; selection/focus state lives in a per-view store with selector subscriptions so moving focus re-renders two rows, not the list.
- Filtering, grouping and sorting of cached data are pure functions in `@daiq/domain`, memoised per input.
- Animations use `transform`/`opacity` only; layout animations limited to the items that changed.

**Process**

- Profile before optimising: React Profiler and Chrome performance traces attached to performance PRs.
- Bundle report (`rollup-plugin-visualizer` output not committed) on demand via `pnpm --filter web analyze`.
