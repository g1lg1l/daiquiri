-- Saved views and favorites: private by default, shared on request, never writable by others.
begin;
\ir _helpers.psql
select plan(14);

select tests.create_user('alice');
select tests.create_user('bob');
select tests.create_user('gina');
select tests.create_user('eve');

select tests.authenticate_as('alice');
select public.create_workspace('Views', 't-views', 'General', 'GEN');
select tests.clear_authentication();
insert into public.workspace_members (workspace_id, user_id, role)
select id, tests.uid('bob'), 'member'::public.workspace_role from public.workspaces where slug = 't-views'
union all
select id, tests.uid('gina'), 'guest'::public.workspace_role from public.workspaces where slug = 't-views';
create temp table ws on commit drop as
  select w.id as workspace_id, t.id as team_id
  from public.workspaces w join public.teams t on t.workspace_id = w.id
  where w.slug = 't-views';
grant select on ws to authenticated;

-- Private by default -----------------------------------------------------------
select tests.authenticate_as('alice');
insert into public.views (workspace_id, team_id, name, config)
select workspace_id, team_id, 'Alice bugs', '{"label": ["bug"]}' from ws;
select is((select owner_id from public.views where name = 'Alice bugs'), tests.uid('alice'), 'the creator owns the view');

select tests.authenticate_as('bob');
select is((select count(*)::int from public.views), 0, 'members do not see private views of others');

select tests.authenticate_as('alice');
update public.views set is_shared = true where name = 'Alice bugs';
select tests.authenticate_as('bob');
select is((select count(*)::int from public.views where name = 'Alice bugs'), 1, 'shared views are visible to members');

update public.views set name = 'Hijacked' where name = 'Alice bugs';
select is((select count(*)::int from public.views where name = 'Hijacked'), 0, 'members cannot edit a view they do not own');

select throws_ok(
  $$ insert into public.views (workspace_id, owner_id, name) select workspace_id, tests.uid('alice'), 'Forged' from ws $$,
  '42501', null, 'owner_id cannot be set by the client'
);

insert into public.views (workspace_id, team_id, name) select workspace_id, team_id, 'Bob board' from ws;
select throws_ok(
  $$ update public.views set workspace_id = gen_random_uuid() where name = 'Bob board' $$,
  '42501', null, 'a view cannot move to another workspace'
);

-- Guests and outsiders -----------------------------------------------------------
select tests.authenticate_as('gina');
select throws_ok(
  $$ insert into public.views (workspace_id, name, is_shared) select workspace_id, 'Guest share', true from ws $$,
  '42501', null, 'guests cannot share views with the workspace'
);
select lives_ok(
  $$ insert into public.views (workspace_id, name) select workspace_id, 'Guest private' from ws $$,
  'guests can keep private views'
);

select tests.authenticate_as('eve');
select is((select count(*)::int from public.views), 0, 'outsiders see no views');

-- Favorites --------------------------------------------------------------------
select tests.authenticate_as('bob');
insert into public.favorites (user_id, workspace_id, entity_kind, entity_id)
select tests.uid('alice'), workspace_id, 'view', (select id from public.views where name = 'Alice bugs') from ws;
select is((select user_id from public.favorites), tests.uid('bob'), 'a favorite always belongs to the caller');

select tests.authenticate_as('alice');
select is((select count(*)::int from public.favorites), 0, 'favorites are private');

-- Admins can remove shared views; favorites go with them.
select tests.authenticate_as('bob');
update public.views set is_shared = true where name = 'Bob board';
select tests.authenticate_as('alice');
delete from public.views where name = 'Bob board';
select tests.authenticate_as('bob');
select is((select count(*)::int from public.views where name = 'Bob board'), 0, 'admins can delete shared views');

select tests.authenticate_as('alice');
delete from public.views where name = 'Alice bugs';
select tests.authenticate_as('bob');
select is((select count(*)::int from public.favorites), 0, 'deleting a view removes it from favorites');

select tests.clear_authentication();
select is(
  (select count(*)::int from public.favorites f
   where f.entity_kind = 'view' and not exists (select 1 from public.views v where v.id = f.entity_id)),
  0, 'no favorite points at a deleted view'
);

select * from finish();
rollback;
