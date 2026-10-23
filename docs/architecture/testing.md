# Daiq — Testing Strategy

## Pyramid

| Layer          | Tool                                     | Location                                                  | Runs in CI                         | What it proves                                                                                                                                            |
| -------------- | ---------------------------------------- | --------------------------------------------------------- | ---------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Unit           | Vitest 5                                 | `packages/*/src/**/*.test.ts`                             | every push                         | Domain rules: filters, ordering keys, identifiers, permissions matrix, date buckets, schema validation, cache patchers, sanitiser                         |
| Component      | Vitest + Testing Library (jsdom)         | `apps/web/src/**/*.test.tsx`, `packages/ui/**/*.test.tsx` | every push                         | Keyboard behaviour, focus management, pickers, palette, optimistic state transitions                                                                      |
| Database / RLS | pgTAP via `supabase test db`             | `supabase/tests/*.test.sql`                               | every push (local Supabase in CI)  | Tenant isolation, role permissions, private teams, constraints, triggers (activity, notifications, identifiers), RPC behaviour, query plans for hot paths |
| Integration    | Vitest + supabase-js against local stack | `packages/data/test/*.int.test.ts`                        | every push                         | Data layer queries/mutations as real users through PostgREST + RLS                                                                                        |
| E2E            | Playwright 1.64                          | `apps/web/e2e/*.spec.ts`                                  | every push (smoke), nightly (full) | Critical user flows in a real browser                                                                                                                     |
| Accessibility  | `@axe-core/playwright`                   | inside E2E                                                | every push                         | No serious/critical axe violations on key screens                                                                                                         |

## Critical E2E flows

1. Sign up → create workspace → land on team tasks.
2. Sign in / sign out; magic link (via local Mailpit).
3. Create project.
4. Create task (composer, inline `Enter`, paste multiple lines); edit fields with keyboard shortcuts; undo.
5. Comment with mention; reaction.
6. Board: drag card between columns; keyboard move; announcement present.
7. Filter + group + save view; reload restores from URL.
8. Search via `/` and command palette (`Mod K`), open by identifier.
9. Permissions: guest cannot see a private team; non-member gets 404.
10. Notifications: assignment in browser A appears in inbox of browser B.
11. Editor: Markdown shortcuts, slash command, code block, paste HTML.
12. Command palette keyboard navigation.

## Running the suites

| Suite            | Command                                 | Current size                                                                                       |
| ---------------- | --------------------------------------- | -------------------------------------------------------------------------------------------------- |
| Unit + component | `pnpm test`                             | 195 tests (domain 118, ui 35, editor 26, data 7, web 9)                                            |
| Database         | `pnpm db:test`                          | 292 pgTAP assertions in 23 files                                                                   |
| E2E              | `pnpm test:e2e` (needs `pnpm db:start`) | 36 Playwright flows incl. axe on every layout, realtime between two sessions and a 5,000-task list |

## Rules

- E2E specs import `test` from `e2e/fixtures.ts`: every `goto`/`reload` first waits for writes still pending (`<html data-saving>`), as a person would before leaving the page, and names the open requests if they never finish.
- Before calling a flaky test fixed, run the whole suite with `--repeat-each=3 --retries=0`.

- Every bug fix adds the test that would have caught it.
- RLS: every table has at least _non-member denied_, _member allowed_, _cross-workspace insert denied_ tests. A meta-test fails if any `public` table has RLS disabled.
- No test depends on another test's data; database tests run inside transactions that roll back; E2E tests create their own workspace via RPC.
- Tests use the same Zod schemas and factories (`packages/domain/src/testing`) to build data.
- Flaky tests are fixed or deleted within a day, never retried silently.
