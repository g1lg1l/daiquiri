# ADR-0015 — Observability

- Status: Accepted · Date: 2026-10-22

## Context

We want actionable diagnostics without making the self-hosted default heavy.

## Decision

- **Client logging**: a tiny `logger` module in `apps/web/src/lib/logger.ts` emitting structured events (`{level, msg, event, ...context}`); in development it prints to the console, in production `warn`/`error` are forwarded to an optional reporter.
- **Error reporting (optional)**: if `config.json` contains `sentryDsn` (or any Sentry-compatible endpoint, e.g. self-hosted GlitchTip), the reporter is loaded lazily. Off by default; no third-party calls otherwise.
- **Web vitals**: `PerformanceObserver` for LCP, INP, CLS recorded by the same logger; budgets enforced in CI via Playwright traces ([performance.md](../architecture/performance.md)).
- **Server side**: Postgres + Supabase service logs (JSON) from the containers; `pg_stat_statements` enabled for query analysis; automation and webhook runs are recorded in tables visible to admins.
- **OpenTelemetry**: deferred. The logger's event shape maps onto OTel log records, so an OTLP exporter can be added without touching call sites.

## Consequences

- Default self-host has zero observability dependencies; teams opt in via configuration.
- Errors are never swallowed: every `catch` either handles the error meaningfully or logs it with context and re-surfaces it to the user.
