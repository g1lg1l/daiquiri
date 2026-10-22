# ADR-0013 — Validation

- Status: Accepted · Date: 2026-10-22

## Context

Schemas are needed for URL search params, forms, data crossing the database boundary (JSON columns, RPC inputs), view configurations, automation definitions and runtime config.

## Alternatives considered

Zod 4.6 (largest ecosystem, JSON Schema output, direct TanStack Router support), Valibot 1.5 (smallest), ArkType 2.2 (fastest, larger bundle). All implement Standard Schema.

## Decision

- **Zod 4** in `packages/domain`; one schema per concept (`TaskInput`, `ViewConfig`, `FilterSet`, `AutomationRule`, `RuntimeConfig`…), with types inferred via `z.infer` — no hand-written duplicate types.
- JSON columns validated twice: by Zod on the client before writing and by a database check (`pg_jsonschema` using JSON Schema generated from the same Zod schema with `z.toJSONSchema`, committed as part of the migration).
- Generic helpers accept `StandardSchemaV1` so a hot path can switch to `zod/mini` without API churn.

## Consequences

- One source of truth for shapes across UI, URL, data layer and database.
- Generated JSON Schemas must be regenerated when a Zod schema changes; a unit test fails if the committed schema drifts.
