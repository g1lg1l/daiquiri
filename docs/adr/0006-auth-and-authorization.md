# ADR-0006 — Authentication and authorisation

- Status: Accepted · Date: 2026-10-22

## Context

We need sign-up/sign-in that works from a static SPA, invitations, a safe public demo, and authorisation that holds for every client.

## Decision

### Authentication

- **Supabase Auth (GoTrue)** for email + password, magic link and optional OAuth providers.
- `flowType: 'pkce'` set explicitly (supabase-js defaults to implicit). `detectSessionInUrl: true` exchanges `?code=` on load; redirect targets are the app base URL.
- Redirect allow-list per environment (Pages URL, `localhost`, self-hosted domain). After sign-in the app only navigates to **same-origin relative** paths stored before the redirect.
- **Demo**: Supabase **anonymous sign-in** creates a real (anonymous) user; the `create_demo_workspace()` RPC clones the demo seed into a private sandbox workspace owned by that user. `pg_cron` deletes sandboxes older than 24 h. Rate limits: per anonymous user (1 sandbox) and global per hour.
- Profiles are created by an `auth.users` insert trigger.

### Authorisation

- Workspace roles: `owner`, `admin`, `member`, `guest`; team membership + team privacy. No per-item overrides ([competitor-feature-matrix.md §9](../research/competitor-feature-matrix.md)).
- **RLS is the only enforcement layer** ([ADR-0003](0003-backend-and-data-access.md)). Helpers in schema `app` (`accessible_team_ids()`, `workspace_role()`, `can_admin_workspace()`) are `security definer`, `stable`, `search_path = ''`, and read `auth.uid()` once per statement.
- The UI mirrors permissions only to hide impossible actions; the domain package exposes `can(role, action)` for that purpose and pgTAP tests assert the database agrees.

| Action                                        | owner     | admin           | member    | guest             |
| --------------------------------------------- | --------- | --------------- | --------- | ----------------- |
| Read public team content                      | ✅        | ✅              | ✅        | only teams joined |
| Read private team content                     | if member | if member       | if member | if member         |
| Create/edit tasks, comments                   | ✅        | ✅              | ✅        | in joined teams   |
| Create teams, projects                        | ✅        | ✅              | ✅        | ❌                |
| Manage labels, fields, templates, automations | ✅        | ✅              | ❌        | ❌                |
| Invite members / change roles                 | ✅        | ✅ (not owners) | ❌        | ❌                |
| Delete workspace, manage owners               | ✅        | ❌              | ❌        | ❌                |

## Consequences

- No CSRF surface: credentials travel as bearer tokens, not cookies.
- Short JWT lifetime (1 h default) bounds how long a removed member keeps realtime channel access ([ADR-0007](0007-realtime.md)).
- Anonymous demo users are real `auth.users` rows; they are excluded from invitations and cannot be upgraded into an owner of a non-demo workspace without linking an email.
