# Security Policy

## Reporting a vulnerability

Please **do not open a public issue** for security problems. Use GitHub's private vulnerability reporting ("Report a vulnerability" under the repository's _Security_ tab). You will get an acknowledgement within 72 hours and a status update at least weekly until the issue is resolved.

Include: affected version/commit, deployment type (hosted demo or self-hosted), reproduction steps, and impact.

## Supported versions

Daiquiri is pre-1.0. Only the latest commit on `main` receives security fixes.

## Security model in brief

- Multi-tenant isolation is enforced in PostgreSQL with Row Level Security and composite foreign keys, and covered by automated pgTAP tests (`supabase/tests`).
- Browsers only ever receive the Supabase **anon/publishable key** and the user's own session. The service-role key must never be configured in the web app.
- Rich text is stored as structured JSON and sanitised when rendered to HTML.
- See [docs/architecture/threat-model.md](docs/architecture/threat-model.md) for the full threat model.

## Self-hosting checklist

- Generate unique values for `POSTGRES_PASSWORD`, `JWT_SECRET`, `ANON_KEY`, `SERVICE_ROLE_KEY` (see `docker/README.md`). Never reuse the example values.
- Serve Daiquiri over HTTPS behind a reverse proxy.
- Configure the Auth `SITE_URL` and redirect allow-list to your domain only.
- Keep the Postgres port closed to the internet.
- Back up the database volume regularly (see `docker/README.md`).
