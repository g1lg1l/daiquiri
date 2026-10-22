# ADR-0004 — Client state and synchronisation

- Status: Accepted · Date: 2026-10-22

## Context

Linear's perceived speed comes from a local-first sync engine: in-memory reactive store, persistent local cache, optimistic mutation queue, server-ordered change log, pushed deltas ([linear-analysis.md §6](../research/linear-analysis.md)). Daiq must feel close to that, but the demo cannot run an extra sync server and RLS must remain the only read gate ([tech-stack-research.md §6](../research/tech-stack-research.md)).

## Alternatives considered

| Option                                                         | Extra server                 | RLS as read gate                 | Maturity (Oct 2026)         |
| -------------------------------------------------------------- | ---------------------------- | -------------------------------- | --------------------------- |
| **TanStack Query 5 + Supabase Broadcast + optimistic updates** | No                           | Yes                              | Stable                      |
| TanStack DB (QueryCollection)                                  | No                           | Yes                              | Core 0.15 (pre-1.0)         |
| ElectricSQL                                                    | Yes (+ auth proxy)           | No (shape proxy)                 | 1.x                         |
| PowerSync                                                      | Yes (service + storage)      | Partly (sync streams mirror RLS) | Mature, FSL service licence |
| Rocicorp Zero                                                  | Yes (zero-cache + endpoints) | No                               | 1.x                         |
| Redux/Zustand global store                                     | No                           | n/a                              | Not a sync solution         |

## Decision

**Phase 1 (now): TanStack Query as the client store, behind `packages/data`.**

- Query keys are entity-scoped and hierarchical (`['tasks', 'team', teamId]`, `['task', taskId]`), defined in one module.
- Every mutation is optimistic: `onMutate` patches all affected cached queries through shared _cache patchers_ (one per entity), `onError` rolls back and shows a toast, `onSettled` reconciles with the server row.
- Client-generated UUIDs make creation optimistic without temporary ids.
- Realtime events ([ADR-0007](0007-realtime.md)) carry `{entity, id, op}`; the data layer refetches the row through PostgREST (RLS-checked) and applies it with the same cache patchers. Events caused by the local user's own pending mutation are ignored.
- On reconnect / tab focus, active queries refetch (TanStack defaults), which closes gaps without a change-log protocol.
- Undo is implemented as inverse mutations recorded by the mutation helpers (`Mod Z`).
- UI-only state (open dialogs, focus, selection) lives in React state/context per feature; view state lives in the URL. No global client store.
- The cache is persisted to IndexedDB (TanStack Query persister) so reloads paint instantly.

**Phase 2 (when `@tanstack/db` reaches 1.0):** swap hook internals to `queryCollectionOptions` + `useLiveQuery` (normalised collections, sub-millisecond live queries, transactional optimistic mutations). Components do not change because they only use `packages/data` hooks.

**Phase 3 (only if true offline-first becomes a requirement):** PowerSync collection behind the same API, with tests that keep sync rules in lockstep with RLS.

## Consequences

- No extra infrastructure; RLS fails closed for every read.
- Cache patching must be written carefully per entity — centralised in `packages/data/src/cache`, covered by unit tests.
- Large lists are fetched per team/project with pagination where needed; full workspace sync is deliberately avoided (no Linear-style 60k cap).
