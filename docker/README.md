# Self-hosting Daiquiri

Daiquiri runs on a trimmed copy of the official Supabase self-hosting stack plus two
Daiquiri containers. Everything is reachable through **one port**: the `web`
container serves the app and proxies the Supabase APIs on the same origin.

```
browser ──► web (nginx :8080) ──┬─ static app, /config.json
                                └─ /auth /rest /realtime /storage ──► api-gw (Envoy) ──► auth · rest · realtime · storage ──► db (Postgres 17)
migrate (one-shot) ──────────────────────────────────────────────────────────────────────────────────────────────────────┘
```

Requirements: Docker 24+ with Compose v2, 2 vCPU, 4 GB RAM, 10 GB disk.

## 1. Configure

```bash
cp docker/.env.example docker/.env
```

### Generate secrets

```bash
sh docker/supabase/utils/generate-keys.sh
```

Copy the printed `JWT_SECRET`, `ANON_KEY`, `SERVICE_ROLE_KEY`, `SECRET_KEY_BASE`,
`PG_META_CRYPTO_KEY`, `POSTGRES_PASSWORD` and `DASHBOARD_PASSWORD` into
`docker/.env`. `REALTIME_DB_ENC_KEY` must be exactly 16 characters
(`openssl rand -hex 8`). Never reuse the example values.

Set `DAIQ_PUBLIC_URL` to the URL people will open (for example
`https://daiq.example.com`). Put a TLS-terminating reverse proxy (Caddy, Traefik,
nginx) in front of port `DAIQ_HTTP_PORT` in production.

Without SMTP, set `ENABLE_EMAIL_AUTOCONFIRM=true` so new accounts can sign in
without confirming their email.

## 2. Start

```bash
pnpm docker:up            # or: docker compose -f docker/docker-compose.yml --env-file docker/.env up -d
```

The first start pulls images, initialises Postgres, applies migrations (`migrate`
exits when done) and starts the app at `DAIQ_PUBLIC_URL`. Sign up: the first
person creates a workspace and becomes its owner.

Optional admin UI (Supabase Studio, bound to localhost only):

```bash
docker compose -f docker/docker-compose.yml --env-file docker/.env --profile studio up -d
```

### Demo mode

`ENABLE_ANONYMOUS_USERS=true` enables **Try the demo** on the sign-in page:
visitors get a private sandbox workspace with sample data, deleted after 24 hours
by a database job.

## Health

```bash
docker compose -f docker/docker-compose.yml ps        # every service should be healthy
curl -fsS "$DAIQ_PUBLIC_URL/healthz"                  # ok
```

## Backups

All state lives in two named volumes: `daiq_db-data` (Postgres) and
`daiq_storage-data` (uploaded files).

```bash
# Logical backup (consistent, portable)
docker compose -f docker/docker-compose.yml exec -T db \
  pg_dump -U postgres -d postgres --format=custom > daiq-$(date +%F).dump

# Restore into a fresh stack (stop web first)
docker compose -f docker/docker-compose.yml exec -T db \
  pg_restore -U postgres -d postgres --clean --if-exists < daiq-YYYY-MM-DD.dump
```

Back up `daiq_storage-data` with your volume backup tool of choice, and keep a
copy of `docker/.env` (the JWT secret is needed to keep existing sessions valid).

## Upgrading

1. Back up (above).
2. `git pull` the new Daiquiri version.
3. `pnpm docker:up` rebuilds `web` and `migrate`; `migrate` applies only new
   migrations (tracked in `supabase_migrations.schema_migrations`).

Supabase service images are pinned in `docker/docker-compose.yml` and the
supporting files in `docker/supabase/` (see `docker/supabase/UPSTREAM`). Daiquiri
upgrades them together after testing; do not bump them independently.

## Images

`web` and `migrate` are multi-stage builds that contain no secrets: the web
container writes `config.json` at start from `DAIQ_PUBLIC_URL` and the anon key,
and refuses to start if it is given a service-role or secret key. Both build for
`linux/amd64` and `linux/arm64`.
