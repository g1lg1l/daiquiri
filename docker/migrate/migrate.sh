#!/bin/sh
# Applies pending migrations in filename order, each in its own transaction.
# History is kept in supabase_migrations.schema_migrations, the same table the
# Supabase CLI uses, so `supabase migration list --db-url ...` keeps working.
set -eu

until pg_isready -q; do
  echo "Waiting for the database…"
  sleep 1
done

psql -v ON_ERROR_STOP=1 -q <<'SQL'
create schema if not exists supabase_migrations;
create table if not exists supabase_migrations.schema_migrations (
  version text primary key,
  statements text[],
  name text
);
SQL

applied=0
for file in /migrations/*.sql; do
  base=$(basename "$file" .sql)
  version=${base%%_*}
  name=${base#*_}
  if [ "$(psql -tAc "select 1 from supabase_migrations.schema_migrations where version = '$version'")" = "1" ]; then
    continue
  fi
  echo "Applying $base"
  psql -v ON_ERROR_STOP=1 -q --single-transaction \
    -f "$file" \
    -c "insert into supabase_migrations.schema_migrations (version, name) values ('$version', '$name')"
  applied=$((applied + 1))
done
echo "Migrations up to date ($applied applied)."
