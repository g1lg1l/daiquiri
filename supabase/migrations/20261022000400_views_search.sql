-- Daiq personalisation and search: saved views, favorites, global search RPC.

create table public.views (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces (id) on delete cascade,
  team_id uuid,
  owner_id uuid references public.profiles (id) on delete cascade,
  name text not null check (char_length(trim(name)) between 1 and 80),
  is_shared boolean not null default false,
  -- Validated by the ViewConfig Zod schema in @daiq/domain before writing.
  config jsonb not null default '{}'
    check (jsonb_typeof(config) = 'object' and pg_column_size(config) <= 16384),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  foreign key (workspace_id, team_id) references public.teams (workspace_id, id) on delete cascade
);

create index views_workspace_idx on public.views (workspace_id);
create index views_owner_idx on public.views (owner_id);
create index views_team_idx on public.views (team_id) where team_id is not null;

create trigger views_updated_at before update on public.views
  for each row execute function app.set_updated_at();

create function app.view_defaults() returns trigger
language plpgsql set search_path = '' as $$
begin
  new.owner_id := coalesce(auth.uid(), new.owner_id);
  return new;
end $$;

create trigger views_defaults before insert on public.views
  for each row execute function app.view_defaults();

create table public.favorites (
  user_id uuid not null,
  workspace_id uuid not null,
  entity_kind text not null check (entity_kind in ('project', 'view', 'task', 'team')),
  entity_id uuid not null,
  sort_key text collate "C" not null default 'a0',
  created_at timestamptz not null default now(),
  primary key (user_id, entity_kind, entity_id),
  foreign key (workspace_id, user_id)
    references public.workspace_members (workspace_id, user_id) on delete cascade
);

create index favorites_workspace_idx on public.favorites (workspace_id, user_id);

create function app.favorite_defaults() returns trigger
language plpgsql set search_path = '' as $$
begin
  new.user_id := coalesce(auth.uid(), new.user_id);
  return new;
end $$;

create trigger favorites_defaults before insert on public.favorites
  for each row execute function app.favorite_defaults();

alter table public.views enable row level security;
alter table public.favorites enable row level security;
alter table public.views force row level security;
alter table public.favorites force row level security;

create policy views_select on public.views for select to authenticated
  using (
    owner_id = (select auth.uid())
    or (
      is_shared
      and workspace_id in (select app.member_workspace_ids())
      and (team_id is null or team_id in (select app.accessible_team_ids()))
    )
  );
create policy views_insert on public.views for insert to authenticated
  with check (
    owner_id = (select auth.uid())
    and workspace_id in (select app.member_workspace_ids())
    and (team_id is null or team_id in (select app.accessible_team_ids()))
    and (not is_shared or workspace_id in (select app.full_member_workspace_ids()))
  );
create policy views_update on public.views for update to authenticated
  using (owner_id = (select auth.uid()) or (is_shared and workspace_id in (select app.admin_workspace_ids())))
  with check (
    (team_id is null or team_id in (select app.accessible_team_ids()))
    and (not is_shared or workspace_id in (select app.full_member_workspace_ids()))
  );
create policy views_delete on public.views for delete to authenticated
  using (owner_id = (select auth.uid()) or (is_shared and workspace_id in (select app.admin_workspace_ids())));

create policy favorites_all on public.favorites for all to authenticated
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()) and workspace_id in (select app.member_workspace_ids()));

revoke update on public.views, public.favorites from authenticated;
grant update (name, is_shared, config, team_id) on public.views to authenticated;
grant update (sort_key) on public.favorites to authenticated;
revoke insert on public.views from authenticated;
grant insert (id, workspace_id, team_id, name, is_shared, config) on public.views to authenticated;

-- ---------------------------------------------------------------------------
-- Search (ADR-0010). security invoker: RLS filters every result.
-- ---------------------------------------------------------------------------

create function public.search(workspace_id uuid, query text, max_results integer default 20)
returns table (kind text, id uuid, title text, subtitle text, rank real)
language sql stable security invoker set search_path = '' as $$
  with q as (
    select
      trim(search.query) as raw,
      websearch_to_tsquery('simple', search.query) as ts,
      '%' || replace(replace(replace(trim(search.query), '\', '\\'), '%', '\%'), '_', '\_') || '%' as pattern,
      least(greatest(search.max_results, 1), 50) as lim
  ),
  task_hits as (
    select 'task'::text as kind, t.id, t.title,
           tm.key || '-' || t.number as subtitle,
           (case when tm.key || '-' || t.number = upper(q.raw) then 100 else 0 end
            + case when t.title ilike q.raw || '%' then 5 else 0 end
            + ts_rank(t.search, q.ts) * 10
            + extensions.similarity(t.title, q.raw))::real as rank
    from public.tasks t
    join public.teams tm on tm.id = t.team_id
    cross join q
    where t.workspace_id = search.workspace_id
      and t.deleted_at is null
      and q.raw <> ''
      and (t.search @@ q.ts or t.title ilike q.pattern or tm.key || '-' || t.number = upper(q.raw))
    order by rank desc, t.updated_at desc
    limit (select lim from q)
  ),
  project_hits as (
    select 'project'::text, p.id, p.name, tm.name, (5 + extensions.similarity(p.name, q.raw))::real
    from public.projects p
    join public.teams tm on tm.id = p.team_id
    cross join q
    where p.workspace_id = search.workspace_id and q.raw <> '' and p.name ilike q.pattern
    limit 10
  ),
  people_hits as (
    select 'person'::text, pr.id, pr.display_name, null::text, (4 + extensions.similarity(pr.display_name, q.raw))::real
    from public.workspace_members m
    join public.profiles pr on pr.id = m.user_id
    cross join q
    where m.workspace_id = search.workspace_id and q.raw <> '' and pr.display_name ilike q.pattern
    limit 10
  ),
  label_hits as (
    select 'label'::text, l.id, l.name, null::text, (3 + extensions.similarity(l.name, q.raw))::real
    from public.labels l
    cross join q
    where l.workspace_id = search.workspace_id and q.raw <> '' and l.name ilike q.pattern
    limit 10
  )
  select * from task_hits
  union all select * from project_hits
  union all select * from people_hits
  union all select * from label_hits
  order by rank desc
  limit (select lim from q)
$$;

grant execute on function public.search(uuid, text, integer) to authenticated;
grant execute on function extensions.similarity(text, text) to authenticated;
