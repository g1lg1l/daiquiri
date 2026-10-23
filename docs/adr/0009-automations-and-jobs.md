# ADR-0009 — Automations and background jobs

- Status: Accepted · Date: 2026-10-22

## Context

Automations ("When task created / status changed / date reached… If filters… Then set status / assign / notify / webhook…"), recurring tasks, demo-sandbox cleanup, trash purge and webhook delivery all need background execution. The demo has no server of its own; self-hosting should stay lightweight.

## Alternatives considered

- Separate Node worker (`apps/worker`) consuming a queue — extra container, cannot run in the demo.
- Edge Functions + scheduled invocations — no deploy command for self-hosted, two runtimes.
- **Inside Postgres**: `pg_cron` (schedules), `pgmq` (queues), `pg_net` (outbound HTTP) — all packaged in `supabase/postgres` locally, hosted and self-hosted.

## Decision

- **Event capture**: row triggers on `tasks`, `task_assignees` and `comments` insert into the `automation_events` queue table, only when the team has an enabled automation for that event kind (one indexed existence check). A plain table with `for update skip locked` gives the same transactional queue as `pgmq` without another extension; `pgmq` stays the upgrade path if an external worker ever consumes it.
- **Execution**: a `pg_cron` job every 10 s calls `app.run_automations()`, which drains the queue in up to four passes (so a chain finishes in one tick), checks each automation's trigger and conditions against the task as it is now, and runs its actions as the _Automation_ actor in a subtransaction: a failing action rolls back that run alone and is logged with its reason in `automation_runs` (last 100 per automation). Activity written during a run names the automation, and `app.notify` stays silent unless the action is _notify_. Date triggers (_due date approaching_) run hourly from `app.run_date_automations()`, once per task and due date.
- **Extensibility**: triggers, conditions and actions are a **registry**: each kind has a Zod schema in `packages/domain/src/automation.ts` (used by the builder) and a branch in `app.automation_action()` (plus a check in `app.validate_automation()`, which rejects ids from another team or workspace when an automation is saved). Adding a kind = one schema + one SQL branch + tests; the engine does not change.
- **Loop protection**: events produced during a run carry the chain depth and the automations already in the chain (transaction-local settings); an automation never runs twice in one chain, and events past depth 3 are not queued.
- **Date-based triggers** and **recurring tasks**: `pg_cron` job every minute selects due rows with an index on `next_run_at`.
- **Webhooks**: row triggers queue `webhook_deliveries`; a `pg_cron` job every 10 s records finished requests from `net._http_response`, then signs due deliveries (HMAC-SHA256 over `<t>.<body>`, secret in Vault) and posts them with `pg_net.http_post`, retrying failures six times with exponential backoff. Automations can queue one with the _call webhook_ action. SSRF rules are in the threat model (T11).
- **Maintenance jobs**: purge trash (> 30 days), delete demo sandboxes (> 24 h), prune old `automation_runs`.

## Consequences

- Zero extra services in demo and self-host; jobs are transactional with the data they touch.
- Throughput is bounded by `pg_cron` cadence (seconds), acceptable for team-scale automation. If needed later, the same queue can be consumed by an external worker without changing producers.
- SQL handlers must be tested with pgTAP like any other domain logic.
