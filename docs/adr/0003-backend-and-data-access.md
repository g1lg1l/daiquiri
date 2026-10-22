# ADR-0003 — Backend architecture and database access model

- Status: Accepted · Date: 2026-10-22

## Context

Constraints:

- The public demo is **GitHub Pages + a hosted Supabase project** — no other server.
- Self-hosting must work with `docker compose up -d`, with the same application code.
- Multi-tenant security must not depend on the UI.
- Complex domain operations (create workspace, accept invitation, move task to another team, delete with undo) must be transactional.
- Every write must produce activity, notifications and realtime events — including writes that bypass the app (lesson from Linear's 2024 incident).

## Alternatives considered

| Option | Security | Pages-compatible | Self-host | Maintenance |
|---|---|---|---|---|
| A. Direct PostgREST only, RLS | Strong for reads; multi-row invariants hard | ✅ | ✅ | Low |
| B. RPC (Postgres functions) for everything | Strong; verbose for simple edits | ✅ | ✅ | Medium |
| C. Separate API service (Node/Hono) with service role | Strong if written well; RLS becomes optional (fail-open risk) | ❌ needs hosting | Extra container | High (two permission systems) |
| D. Edge Functions for domain ops | Strong | ✅ (hosted) | Self-hosted functions have no deploy command, weaker DX | Medium-high |
| **E. Hybrid: PostgREST + RLS for reads and single-row edits, RPC for multi-row operations, triggers for side effects** | Strong, one permission system (RLS) | ✅ | ✅ | Medium |

## Decision

**Option E — Postgres is the application server.**

1. **Reads** go through PostgREST with RLS. Embedded resources (`select=*,assignees:task_assignees(user_id)`) avoid N+1 queries.
2. **Single-row edits** (rename a task, change priority) go through PostgREST `PATCH` with RLS and **column-level `GRANT`s** that exclude immutable/sensitive columns.
3. **Multi-row or privileged operations** are `public` RPC functions (`create_workspace`, `accept_invitation`, `delete_tasks`, `restore_tasks`, `move_task_to_team`, `search`). They are `security invoker` by default; `security definer` only when they must read rows the caller cannot (e.g. invitation by token), always with `set search_path = ''` and an explicit access check first.
4. **Side effects are triggers**: identifiers, timestamps, status-category timestamps, activity, subscriptions, notifications, realtime broadcasts.
5. **Edge Functions** are reserved for optional integrations that need secrets or outbound HTTP beyond `pg_net` (e.g. transactional email) and are never required for core features.
6. Application code never talks to Supabase outside `packages/data`; the rest of the app sees typed hooks and domain types.

## Rationale

- RLS is the only permission system, enforced for every client (web, API users, future mobile). There is no service-role backend to fail open.
- Works identically on hosted Supabase and the self-hosted compose stack.
- SQL invariants (composite FKs, check constraints, triggers) protect data even from bugs in our own client.

## Consequences

- Domain logic is split between TypeScript (pure rules shared by the client: filters, ordering, validation) and SQL (authoritative invariants). Rules that must hold are always in SQL; TypeScript duplicates only what the UI needs to be optimistic, and pgTAP tests cover the SQL side.
- SQL migrations need the same review rigour as application code.
- Some operations require an RPC round-trip; they are still optimistic on the client.
- Portability: everything except Auth/Realtime/Storage APIs is plain Postgres; moving off Supabase would mean replacing those three services, not rewriting domain logic.
