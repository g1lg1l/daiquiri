# ADR-0012 — Deployment: GitHub Pages demo and Docker self-hosting

- Status: Accepted · Date: 2026-10-22

## Context

The same code must run as (1) a public demo on GitHub Pages backed by a hosted Supabase test project and (2) a self-hosted instance started with `docker compose up -d`.

## Decision

### One build, runtime configuration

- The web app reads `config.json` at startup: `{ "supabaseUrl", "supabaseKey", "demo": boolean }`. Only the **publishable/anon key** may appear there; a startup check refuses keys whose JWT role is `service_role`.
- `vite build` uses `base` from `DAIQ_BASE` (`/daiquiri/` for Pages, `/` otherwise). Router `basepath` follows `import.meta.env.BASE_URL`.

### GitHub Pages

- Workflow: install → build with `DAIQ_BASE=/daiquiri/` → write `config.json` from repository variables (`DEMO_SUPABASE_URL`, `DEMO_SUPABASE_KEY`) → copy `index.html` to `404.html` → `actions/upload-pages-artifact` → `actions/deploy-pages`.
- SPA deep links work through `404.html` (status 404 is cosmetic for an app).
- Demo backend: migrations applied with `supabase db push` from CI (manual-dispatch workflow using `SUPABASE_ACCESS_TOKEN` + `SUPABASE_DB_PASSWORD` secrets); demo data lives in per-visitor sandboxes ([ADR-0006](0006-auth-and-authorization.md)). Note: hosted Free projects pause after 7 idle days — the workflow includes a weekly keep-alive ping.
- Pages on a private repository requires a paid GitHub plan; the workflow is ready and deploys once the repository is public or the plan allows it.

### Docker Compose (self-hosted)

- `docker/docker-compose.yml` = trimmed official Supabase self-host stack (`db`, `auth`, `rest`, `realtime`, `storage`, `meta`, API gateway) + Daiq services:
  - `migrate` — one-shot container that applies `supabase/migrations/*.sql` in order (tracked in a `schema_migrations` table) and optionally the demo seed (`DAIQ_SEED_DEMO=true`).
  - `web` — multi-stage image (`node` build → `nginx:alpine` runtime, non-root) serving the SPA with `try_files … /index.html`, security headers (CSP, `X-Content-Type-Options`, `Referrer-Policy`), gzip/brotli static assets, and an entrypoint that writes `config.json` from env.
  - Optional `studio` profile.
- Health checks on every service; `web` and `migrate` depend on `db` being healthy.
- Named volumes for database and storage; secrets only via `.env` (template `docker/.env.example`), never baked into images.
- Images built for `linux/amd64` and `linux/arm64` with Buildx in CI.

## Consequences

- No rebuild per environment; the Docker image is environment-agnostic.
- Self-hosters run ~8 containers (Supabase's minimum); documented hardware: 2 vCPU / 4 GB RAM.
- Supabase self-host compose evolves monthly; we track a pinned snapshot and document upgrades in `docker/README.md`.
