# Daiq

**Everything your team needs. Nothing it doesn't.**

Daiq is an open-source, self-hostable work-management app for teams. It keeps the parts of ClickUp, Asana and Linear that people actually use — tasks, projects, boards, a fast keyboard-first workflow, comments, an inbox — and leaves out the configuration sprawl.

- **Fast.** Optimistic updates everywhere, a persisted cache that paints instantly on reload, realtime updates from teammates, virtualised lists.
- **Keyboard first.** `⌘K` reaches everything, `C` creates, `S` `P` `A` `L` `D` edit the focused task, `G` then `I`/`M`/`T` navigates, `?` lists every shortcut.
- **Simple model.** Workspace → Team → Project → Task. Every status belongs to one of five fixed categories, so reports and automations always mean the same thing.
- **Secure by construction.** Multi-tenant isolation is enforced in Postgres with Row Level Security and covered by automated tests.
- **Yours to run.** `docker compose up -d` on your own server, or try the hosted demo.

## Quick start (development)

Requirements: Node 24+, pnpm 12, Docker (for the local Supabase stack).

```bash
pnpm install
pnpm db:start       # local Supabase (Postgres, Auth, Realtime) with migrations and seed data
pnpm dev            # http://localhost:5173
```

Sign in with the seeded account `dev@daiq.local` / `daiq-dev-password`, or create your own account, or open **Try the demo** for a disposable sandbox.

## Commands

| Command                               | What it does                                                                         |
| ------------------------------------- | ------------------------------------------------------------------------------------ |
| `pnpm dev`                            | Run the web app (writes `apps/web/public/config.json` from the local Supabase stack) |
| `pnpm build`                          | Production build of every package                                                    |
| `pnpm lint`                           | Type-aware lint (oxlint)                                                             |
| `pnpm format` / `pnpm format:check`   | Prettier                                                                             |
| `pnpm typecheck`                      | TypeScript 7 across the monorepo                                                     |
| `pnpm test`                           | Unit and component tests (Vitest)                                                    |
| `pnpm test:e2e`                       | End-to-end tests (Playwright, needs `pnpm db:start`)                                 |
| `pnpm db:start` / `pnpm db:stop`      | Start/stop the local Supabase stack                                                  |
| `pnpm db:migrate`                     | Apply new migrations to the local database                                           |
| `pnpm db:seed`                        | Reset the local database and re-apply migrations and seed data                       |
| `pnpm db:test`                        | Database tests: RLS, triggers, RPCs (pgTAP)                                          |
| `pnpm db:types`                       | Regenerate `packages/data/src/database.types.ts`                                     |
| `pnpm docker:up` / `pnpm docker:down` | Self-hosted stack (see [docker/README.md](docker/README.md))                         |

## Repository layout

```
apps/web            React 19 SPA (TanStack Router + Query, Vite 8)
packages/domain     Pure domain rules and Zod schemas (no I/O)
packages/data       The only package that talks to Supabase: typed hooks, optimistic cache, realtime
packages/ui         Design system: tokens, theme, Base UI components
packages/editor     Tiptap editor, sanitising and Markdown/HTML conversion
supabase/           SQL migrations, seed, pgTAP tests
docker/             Self-hosting: compose stack, web and migrate images
docs/               Research, product spec, architecture, ADRs
```

Start with [ARCHITECTURE.md](ARCHITECTURE.md), then [docs/plan.md](docs/plan.md).

## Self-hosting

```bash
cp docker/.env.example docker/.env      # fill in secrets, see docker/README.md
pnpm docker:up                          # Daiq on http://localhost:3000
```

Full guide, backups and upgrades: [docker/README.md](docker/README.md).

## Public demo

The demo runs as a static site on GitHub Pages backed by a dedicated Supabase project. Each visitor gets a private sandbox workspace that is deleted after 24 hours. Setup for maintainers is in [docs/adr/0012-deployment.md](docs/adr/0012-deployment.md) and `.github/workflows/pages.yml`.

## Documentation

- Product: [principles](docs/product/product-principles.md), [feature spec](docs/product/daiq-feature-spec.md), [information architecture](docs/product/information-architecture.md), [keyboard](docs/product/keyboard-navigation.md)
- Research: [ClickUp](docs/research/clickup-analysis.md), [Asana](docs/research/asana-analysis.md), [Linear](docs/research/linear-analysis.md), [feature matrix](docs/research/competitor-feature-matrix.md), [tech stack](docs/research/tech-stack-research.md)
- Architecture: [database model](docs/architecture/database-model.md), [threat model](docs/architecture/threat-model.md), [performance](docs/architecture/performance.md), [testing](docs/architecture/testing.md), [ADRs](docs/adr/README.md)

## Contributing and security

See [CONTRIBUTING.md](CONTRIBUTING.md). Report vulnerabilities privately as described in [SECURITY.md](SECURITY.md).

## License

Daiq is free software under the [GNU Affero General Public License v3.0](LICENSE) (`AGPL-3.0-only`).

You can use, self-host, modify and redistribute it. If you run a modified version for other people over a network, the AGPL requires you to offer them the source code of your version.
