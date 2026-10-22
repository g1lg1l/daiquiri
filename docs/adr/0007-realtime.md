# ADR-0007 — Realtime: Broadcast from the database on private channels

- Status: Accepted · Date: 2026-10-22

## Context

Other people's changes (task edits, board moves, comments, notifications) should appear within about a second. Subscriptions must be scoped, authorised, and cheap; duplicate events must not corrupt optimistic state.

## Alternatives considered

- **Postgres Changes**: simplest API, but every change is checked against every subscriber on a single thread; filters are limited; DELETE filtering needs `REPLICA IDENTITY FULL`. Supabase recommends Broadcast for scale and security.
- **Broadcast from database** (`realtime.send` / `realtime.broadcast_changes` in triggers) on **private channels** authorised by RLS on `realtime.messages`.
- Own WebSocket service: extra server, rejected ([ADR-0003](0003-backend-and-data-access.md)).

## Decision

- `AFTER` row triggers call `realtime.send(payload, event, topic, private => true)` with a **thin payload**: `{ entity, id, op, actor_id, at }` — never row contents.
- Topics:
  - `team:<team_id>` — tasks, assignees, labels on tasks, relations, comments of that team.
  - `workspace:<workspace_id>` — teams, members, labels, projects, views.
  - `user:<user_id>` — notifications for that user.
- RLS on `realtime.messages` allows `select` when the topic's id is in `app.accessible_team_ids()`, is a workspace the user belongs to, or equals the user's own id. Clients cannot send (`insert` denied).
- The client keeps **at most three channels** open: current workspace, current user, and teams the user is a member of or currently viewing (bounded, subscribed on navigation).
- On an event the data layer refetches the row by id through PostgREST (RLS-checked, so finer-grained rules still apply) and patches caches; events with `actor_id = me` that match a pending mutation are skipped; multiple events for the same id within 100 ms are coalesced.
- After reconnect: active queries refetch.

## Consequences

- Payloads never leak data; a misconfigured topic policy reveals only ids.
- Each remote change costs one small GET; acceptable for team-sized traffic and avoids a second data path.
- Access is evaluated at channel join and cached until JWT refresh (≤ 1 h).
- Migrations must not `alter table realtime.messages enable row level security` (already enabled; errors on hosted).
