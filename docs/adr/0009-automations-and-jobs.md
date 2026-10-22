# ADR-0009 — Automations and background jobs

- Status: Accepted · Date: 2026-10-22

## Context

Automations ("When task created / status changed / date reached… If filters… Then set status / assign / notify / webhook…"), recurring tasks, demo-sandbox cleanup, trash purge and webhook delivery all need background execution. The demo has no server of its own; self-hosting should stay lightweight.

## Alternatives considered

- Separate Node worker (`apps/worker`) consuming a queue — extra container, cannot run in the demo.
- Edge Functions + scheduled invocations — no deploy command for self-hosted, two runtimes.
- **Inside Postgres**: `pg_cron` (schedules), `pgmq` (queues), `pg_net` (outbound HTTP) — all packaged in `supabase/postgres` locally, hosted and self-hosted.

## Decision

- **Event capture**: the same triggers that write `activity` enqueue automation candidates (`pgmq.send('automation_events', …)`) only when the workspace has enabled automations for that trigger kind (cheap existence check).
- **Execution**: a `pg_cron` job (every 10 s) calls `app.run_automation_batch()`, which reads from the queue, evaluates conditions and applies actions in a transaction as the _Automation_ system actor, writing `automation_runs`.
- **Extensibility**: triggers, conditions and actions are a **registry**: each kind has a Zod schema in `packages/domain/automation` (for the builder UI) and a matching SQL handler `app.automation_action_<kind>(task, params)`. Adding a kind = one schema + one SQL function + tests; the engine does not change.
- **Loop protection**: events produced by an automation carry the chain depth; depth > 3 is dropped and logged.
- **Date-based triggers** and **recurring tasks**: `pg_cron` job every minute selects due rows with an index on `next_run_at`.
- **Webhooks**: `pg_net.http_post` with HMAC signature; responses polled from `net._http_response` by a cron job for retries with exponential backoff.
- **Maintenance jobs**: purge trash (> 30 days), delete demo sandboxes (> 24 h), prune old `automation_runs`.

## Consequences

- Zero extra services in demo and self-host; jobs are transactional with the data they touch.
- Throughput is bounded by `pg_cron` cadence (seconds), acceptable for team-scale automation. If needed later, the same queue can be consumed by an external worker without changing producers.
- SQL handlers must be tested with pgTAP like any other domain logic.
