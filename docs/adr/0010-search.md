# ADR-0010 — Search

- Status: Accepted · Date: 2026-10-22

## Context

Search must be instant in the command palette and cover tasks, projects, people and labels (comments later), respecting permissions.

## Alternatives considered

- External engine (Meilisearch, Typesense, Elastic): excellent relevance, but another service, another permission model, and an indexing pipeline.
- **Postgres FTS (`tsvector` + GIN) + `pg_trgm`** for fuzzy/prefix title matching: built in everywhere we deploy, RLS applies automatically.
- `pgroonga` / `rum`: packaged in Supabase, better ranking for some languages; unnecessary at our scale today.

## Decision

- `tasks.search` is a generated `tsvector` (`simple` config so identifiers and mixed languages work) from title (A) and description text (B); GIN index. `gin_trgm_ops` index on `title` for typo-tolerant prefix search.
- `public.search(workspace_id, query, limit)` RPC (`security invoker`, so RLS filters results) returns a ranked union of tasks, projects, people and labels with a `kind` discriminator. Exact identifier match (`ENG-142`) ranks first.
- The palette first filters cached data client-side (instant), then merges RPC results (debounced 120 ms).

## Consequences

- No extra infrastructure; permissions are correct by construction.
- Relevance is good, not great; revisit with `pgroonga` or an external engine if large workspaces need it.
