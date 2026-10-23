-- Search must stay index-backed as the task table grows (implementation-priorities slice 9).
-- Sequential scans are disabled so the planner shows whether an index is usable at all,
-- regardless of how few rows the test database has.
begin;
select plan(3);

create function pg_temp.plan_of(query text) returns text language plpgsql as $$
declare
  line text;
  result text := '';
begin
  for line in execute 'explain ' || query loop
    result := result || line || E'\n';
  end loop;
  return result;
end $$;

set local enable_seqscan = off;

select matches(
  pg_temp.plan_of($$ select id from public.tasks where search @@ websearch_to_tsquery('simple', 'crash widget') $$),
  'tasks_search_idx',
  'full-text search uses the GIN index on tasks.search'
);
select matches(
  pg_temp.plan_of($$ select id from public.tasks where title ilike '%widget%' $$),
  'tasks_title_trgm_idx',
  'substring search uses the trigram index on tasks.title'
);
select matches(
  pg_temp.plan_of($$ select id from public.tasks where team_id = '00000000-0000-4000-8000-000000000000' and deleted_at is null order by sort_key $$),
  'Index (Only )?Scan using tasks_team_\w+_idx',
  'a team list is read through a team index (which one depends on table statistics)'
);

select * from finish();
rollback;
