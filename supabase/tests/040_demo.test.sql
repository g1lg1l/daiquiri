-- Demo sandboxes (ADR-0006): one private, seeded workspace per visitor.
begin;
\ir _helpers.psql
select plan(7);

select tests.create_user('visitor');
select tests.create_user('other');
select tests.authenticate_as('visitor');

create temp table demo on commit drop as select * from public.create_demo_workspace();
grant select on demo to authenticated;

select ok((select slug from demo) like 'demo-%', 'returns the new sandbox');
select ok((select is_demo from demo), 'marked as a demo workspace');
select is((select count(*)::int from public.teams where workspace_id = (select id from demo)), 3, 'seeded with three teams');
select ok((select count(*) from public.tasks where workspace_id = (select id from demo)) >= 30, 'seeded with realistic tasks');
select is((select id from public.create_demo_workspace()), (select id from demo), 'calling again returns the same sandbox');

select tests.authenticate_as('other');
select is((select count(*)::int from public.workspaces where id = (select id from demo)), 0, 'sandboxes are private to their visitor');
select is((select count(*)::int from public.tasks where workspace_id = (select id from demo)), 0, 'and so is their data');

select * from finish();
rollback;
