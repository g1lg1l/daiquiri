# ADR-0002 — Monorepo and tooling

- Status: Accepted · Date: 2026-10-22

## Context

Daiq has one web app, a database project, Docker assets and a few shared libraries (domain rules, data access, UI, editor). We want fast CI, enforced boundaries, strict types and as few moving parts as possible.

## Alternatives considered

- **Package manager**: pnpm 12 (strict `node_modules`, workspaces, catalogs) vs npm/yarn/bun workspaces. pnpm's strictness doubles as a dependency-boundary check: a package cannot import what it does not declare.
- **Task runner**: Turborepo 2 vs Nx vs plain `pnpm -r`. Turborepo gives caching and topological pipelines with one small config file; Nx is heavier than we need.
- **Linting**: ESLint 10 + typescript-eslint (does not support TypeScript 7 yet), Biome 2.6 (own type inference, subset), **oxlint 1.89 + oxlint-tsgolint 7** (59/61 type-aware typescript-eslint rules on the native TS 7 compiler, 12–18× faster).
- **Formatting**: Prettier 3.9 vs oxfmt (beta) vs Biome. Prettier until oxfmt is 1.0 (output-compatible).
- **Boundaries**: dependency-cruiser vs oxlint `no-restricted-imports` + pnpm strictness.

## Decision

- **pnpm 12 workspaces** with a version **catalog** in `pnpm-workspace.yaml`; **Turborepo 2** for `build`, `typecheck`, `lint`, `test`.
- **TypeScript 7** (`tsc` native), `strict` plus `noUncheckedIndexedAccess`, `exactOptionalPropertyTypes`, `verbatimModuleSyntax`. If a tool needs the TS compiler API before TS 7.1, use the documented alias (`typescript` → `@typescript/typescript6`).
- **Internal packages are source-only** (`exports` point at `.ts`), consumed by Vite and Vitest directly: no per-package build step, no stale `dist`.
- **oxlint** (type-aware, react, jsx-a11y, import, vitest plugins) + **Prettier** (+ Tailwind class sorting).
- Boundaries: pnpm strictness for package direction; `no-restricted-imports` rules forbid `@supabase/supabase-js` outside `packages/data` and keep `packages/domain` free of I/O (only `zod` and `fractional-indexing`).

### Layout

```
apps/web           React SPA (routes, features, app shell)
packages/domain    Pure TypeScript: types, Zod schemas, rules (filters, ordering, identifiers, permissions)
packages/data      Supabase client, typed queries/mutations as TanStack Query hooks, realtime
packages/ui        Design system: tokens, primitives (shadcn on Base UI), motion presets
packages/editor    Tiptap editor (lazy), schema, JSON↔Markdown/HTML, sanitiser
supabase/          Migrations, seed, pgTAP tests, config
docker/            Self-hosting compose, nginx image, migrate job
docs/              Research, product, architecture, ADRs
```

Dependency direction: `web → ui, editor, data, domain`; `data → domain`; `editor → ui`; `ui`, `domain` depend on no internal package.

Rejected from the initial proposal (premature): `apps/api` (no separate API, see [ADR-0003](0003-backend-and-data-access.md)), `apps/worker` (jobs run in Postgres, [ADR-0009](0009-automations-and-jobs.md)), `packages/auth`, `realtime`, `validation`, `api-client`, `logger`, `observability`, `testing`, `config`, `eslint-config`, `typescript-config` — each would hold a handful of lines today. Auth and realtime live in `packages/data`, validation in `packages/domain`, shared TS config in a root `tsconfig.base.json`. A package is extracted when a second consumer appears.

## Consequences

- One `pnpm install` and no build step before `pnpm dev`.
- Type-aware lint runs in seconds; CI stays fast.
- Reversible: adding a package later is cheap; merging premature packages is not.
