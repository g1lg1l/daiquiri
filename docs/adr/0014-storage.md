# ADR-0014 — File storage

- Status: Accepted · Date: 2026-10-22 · Applies from P2 (attachments)

## Decision

- Supabase Storage, private bucket `attachments`, object path `{workspace_id}/{task_id}/{uuid}-{sanitised-name}`.
- RLS on `storage.objects`: `select`/`insert`/`delete` allowed when `(storage.foldername(name))[1]::uuid` is a workspace the user belongs to **and** the task (second folder) is in `app.accessible_team_ids()`.
- Bucket limits: 25 MB per file, MIME allow-list (images, PDF, text, office documents, archives). The `attachments` table row is created in the same flow and checked by a constraint on size/MIME.
- Downloads via short-lived signed URLs; non-image types served with `Content-Disposition: attachment`; SVG always as attachment.
- Demo mode disables uploads.

## Consequences

- Same code on hosted and self-hosted Storage; self-hosted can switch Storage to S3 via its own configuration.
