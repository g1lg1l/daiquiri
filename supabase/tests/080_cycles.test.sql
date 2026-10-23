-- Cycles: scheduled by the database, visible to the team, renamable by members, rolled over nightly.
begin;
\ir _helpers.psql
select plan(15);

select tests.create_user('alice');
select tests.create_user('bob');
select tests.create_user('eve');

select tests.authenticate_as('alice');
select public.create_workspace('Cycles', 't-cycles', 'General', 'GEN');
select public.create_team((select id from public.workspaces where slug = 't-cycles'), 'Other', 'OTH');
select tests.clear_authentication();
insert into public.workspace_members (workspace_id, user_id, role)
select id, tests.uid('bob'), 'member'::public.workspace_role from public.workspaces where slug = 't-cycles';
insert into public.team_members (team_id, workspace_id, user_id)
select t.id, t.workspace_id, tests.uid('bob') from public.teams t where t.key = 'GEN'
  and t.workspace_id = (select id from public.workspaces where slug = 't-cycles');
create temp table gen on commit drop as
  select t.id, t.workspace_id from public.teams t join public.workspaces w on w.id = t.workspace_id
  where w.slug = 't-cycles' and t.key = 'GEN';
grant select on gen to authenticated;

-- Turning cycles on schedules the current cycle and three upcoming ones.
select tests.authenticate_as('alice');
update public.teams set cycles_enabled = true, cycle_weeks = 2 where id = (select id from gen);
select is((select count(*)::int from public.cycles where team_id = (select id from gen)), 4,
  'enabling cycles creates the current and three upcoming cycles');
select ok(
  (select bool_and(ends_on - starts_on = 13) from public.cycles where team_id = (select id from gen)),
  'each cycle lasts the team''s two weeks');
select ok(
  exists (select 1 from public.cycles where team_id = (select id from gen)
          and (now() at time zone 'utc')::date between starts_on and ends_on),
  'one of them is the current cycle');
select is(
  (select count(*)::int from public.cycles a join public.cycles b
     on b.team_id = a.team_id and b.number = a.number + 1
   where a.team_id = (select id from gen) and b.starts_on <> a.ends_on + 1),
  0, 'cycles follow each other without gaps');

-- A team created from the software template has cycles on from the start.
select tests.authenticate_as('alice');
select public.create_team((select workspace_id from gen), 'Platform', 'PLT', 'software');
select is(
  (select count(*)::int from public.cycles c join public.teams t on t.id = c.team_id where t.key = 'PLT'),
  4, 'a software team gets its cycles when it is created');

-- Members rename, nobody creates or deletes.
select tests.authenticate_as('bob');
update public.cycles set name = 'Launch' where team_id = (select id from gen) and number = 1;
select is((select name from public.cycles where team_id = (select id from gen) and number = 1), 'Launch',
  'team members can rename a cycle');
select throws_ok(
  $$ insert into public.cycles (workspace_id, team_id, number, starts_on, ends_on)
     select workspace_id, id, 99, current_date, current_date from gen $$,
  '42501', null, 'clients cannot create cycles');
select throws_ok(
  $$ update public.cycles set starts_on = current_date where number = 1 $$,
  '42501', null, 'nor change their dates');

select tests.authenticate_as('eve');
select is((select count(*)::int from public.cycles), 0, 'outsiders see no cycles');

-- Tasks join cycles of their own team only.
select tests.authenticate_as('alice');
insert into public.tasks (team_id, workspace_id, title, cycle_id)
select id, workspace_id, 'In cycle 1', (select c.id from public.cycles c where c.team_id = gen.id and c.number = 1) from gen;
select is((select count(*)::int from public.tasks where cycle_id is not null), 1, 'a task joins a cycle of its team');
select throws_ok(
  $$ insert into public.tasks (team_id, workspace_id, title, cycle_id)
     select t.id, t.workspace_id, 'Wrong team', (select c.id from public.cycles c join gen on c.team_id = gen.id limit 1)
     from public.teams t where t.key = 'OTH' $$,
  '23503', null, 'but not a cycle of another team');

-- Nightly rollover: unfinished work moves on, finished work stays.
select tests.clear_authentication();
insert into public.cycles (workspace_id, team_id, number, starts_on, ends_on)
select workspace_id, id, 100, current_date - 20, current_date - 7 from gen;
-- The past cycle sorts before the scheduled ones once it is renumbered first.
update public.cycles set number = number + 200 where team_id = (select id from gen) and number < 100;
update public.cycles set number = 1 where team_id = (select id from gen) and number = 100;
insert into public.tasks (team_id, workspace_id, title, cycle_id)
select id, workspace_id, 'Open in the past cycle', (select c.id from public.cycles c where c.team_id = gen.id and c.number = 1) from gen;
insert into public.tasks (team_id, workspace_id, title, cycle_id, status_id)
select id, workspace_id, 'Done in the past cycle',
  (select c.id from public.cycles c where c.team_id = gen.id and c.number = 1),
  (select s.id from public.statuses s where s.team_id = gen.id and s.category = 'completed' limit 1)
from gen;
select app.maintain_cycles();
select is(
  (select c.number from public.tasks t join public.cycles c on c.id = t.cycle_id where t.title = 'Open in the past cycle'),
  201, 'unfinished tasks roll over into the next cycle');
select is(
  (select c.number from public.tasks t join public.cycles c on c.id = t.cycle_id where t.title = 'Done in the past cycle'),
  1, 'completed tasks stay in their cycle');
select isnt((select completed_at from public.cycles where team_id = (select id from gen) and number = 1), null,
  'the ended cycle is closed');

-- Burn-up rows, one per day up to today.
select tests.authenticate_as('alice');
select is(
  (select count(*)::int from public.cycle_progress((select c.id from public.cycles c where c.team_id = (select id from gen) and c.number = 1))),
  14, 'cycle_progress returns one row per day of an ended cycle');

select * from finish();
rollback;
