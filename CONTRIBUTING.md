# Contributing to Daiquiri

Thanks for helping. This guide covers how the codebase is organised and what a change needs before it is merged.

## Setup

```bash
pnpm install
pnpm db:start
pnpm dev
```

`pnpm db:start` runs the local Supabase stack in Docker, applies `supabase/migrations` and loads `supabase/seed.sql`. The dev server writes `apps/web/public/config.json` from it on first start.

## Principles that shape every change

Read [docs/product/product-principles.md](docs/product/product-principles.md) first. In code, that means:

- **Business rules never live in React components.** Pure rules go in `packages/domain` (with unit tests); data access goes in `packages/data` (hooks with optimistic updates); components compose them.
- **Security is enforced by the database.** Every table has forced RLS, composite foreign keys keep references inside a tenant, and every policy has pgTAP tests. The UI only hides what the database would refuse anyway.
- **Every write produces its side effects in SQL** (activity, notifications, realtime events) so no client can skip them.
- **No `any`, no unsafe casts.** Narrow with type guards (see `packages/domain/src/model.ts`) or validate with Zod.
- **Errors are typed and surfaced.** Throw `DaiqError` (or let `toDaiqError` map it); never swallow an exception silently.
- **Every visible string is translated.** Add it to `apps/web/src/i18n/en/<namespace>.ts` and the same key to `it/<namespace>.ts` (type checking fails until both exist), and read it as `m.<namespace>.<key>` at render time, never in a module-level constant. Sentences with values are functions; plurals use `count()`; dates and numbers use `Intl` with `locale`. See [ADR-0016](docs/adr/0016-ui-components-motion-i18n.md).
- **Keep it small.** Prefer the platform and existing code over new dependencies and abstractions. A package is extracted when a second consumer exists.

## Making a database change

1. Add a new file `supabase/migrations/<timestamp>_<name>.sql`. Migrations are forward-only: never edit one that has been merged; fix it with a new migration.
2. For every new table: `workspace_id`, composite FKs, `enable` + `force row level security`, policies, column-level grants, and the checklist in [docs/architecture/threat-model.md](docs/architecture/threat-model.md).
3. Every function exposed to clients must be granted explicitly (`grant execute … to authenticated`) and added to the allow-list in `supabase/tests/000_security_baseline.test.sql`.
4. Add pgTAP tests in `supabase/tests/` and run `pnpm db:test`.
5. Regenerate types: `pnpm db:types`.

## Before opening a pull request

```bash
pnpm format && pnpm lint && pnpm typecheck && pnpm test && pnpm db:test
pnpm build && pnpm --filter @daiq/web size
pnpm test:e2e
```

CI runs the same checks plus Docker image builds for amd64 and arm64.

## Commit style

Conventional prefixes (`feat:`, `fix:`, `perf:`, `docs:`, `chore:`, `refactor:`, `test:`), imperative mood, and a body that explains _why_ when it is not obvious.

## Decisions

Significant technical decisions are recorded as ADRs in [docs/adr](docs/adr/README.md). Propose a new ADR (or one that supersedes an existing one) in the same pull request as the change it justifies.
