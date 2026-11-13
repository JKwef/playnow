-- Run in a transaction and ROLLBACK, including fixtures. Also works after the migration.
begin;
select set_config('stage12.uid1', gen_random_uuid()::text, true);
select set_config('stage12.uid2', gen_random_uuid()::text, true);
insert into auth.users(id) values (current_setting('stage12.uid1')::uuid), (current_setting('stage12.uid2')::uuid);
create function pg_temp.assert_sync(ok boolean, label text) returns void language plpgsql as $$
begin if ok is not true then raise exception 'Sync assertion failed: %', label; end if; end; $$;
select pg_temp.assert_sync(not has_table_privilege('authenticated', 'public.picker_sync_state', 'INSERT,UPDATE,DELETE'), 'no direct DML');
select pg_temp.assert_sync(not has_function_privilege('anon', 'public.write_picker_sync(uuid,bigint,uuid,jsonb)', 'EXECUTE'), 'anon cannot write');
select pg_temp.assert_sync(picker_sync_private.valid_snapshot('{"choice":null,"postponed":{"620":1795000000000}}'), 'valid postponed snapshot');
select pg_temp.assert_sync(not picker_sync_private.valid_snapshot('{"choice":{},"postponed":{}}'), 'reject missing choice fields');
select pg_temp.assert_sync(not picker_sync_private.valid_snapshot('{"choice":null,"postponed":{"0":1}}'), 'reject invalid appid');
select pg_temp.assert_sync(not picker_sync_private.valid_snapshot('{"choice":null,"postponed":{"1":1.5}}'), 'reject fractional deadline');
select pg_temp.assert_sync(not picker_sync_private.valid_snapshot('{"choice":null,"postponed":{},"history":[]}'), 'reject extra payload');
select set_config('request.jwt.claims', jsonb_build_object('sub', current_setting('stage12.uid1'), 'role','authenticated')::text, true);
set local role authenticated;
do $$
declare result jsonb; uid uuid := current_setting('stage12.uid1')::uuid;
begin
  result := public.write_picker_sync(uid,0,'00000000-0000-4000-8000-000000000001','{"choice":null,"postponed":{"620":1795000000000}}');
  perform pg_temp.assert_sync(result->>'applied'='true' and (result->>'revision')::int=1, 'first CAS');
  result := public.write_picker_sync(uid,0,'00000000-0000-4000-8000-000000000001','{"choice":null,"postponed":{"620":1795000000000}}');
  perform pg_temp.assert_sync(result->>'applied'='true' and (result->>'revision')::int=1, 'idempotent retry');
  result := public.write_picker_sync(uid,0,'00000000-0000-4000-8000-000000000002','{"choice":null,"postponed":{}}');
  perform pg_temp.assert_sync(result->>'applied'='false' and (result->>'revision')::int=1, 'stale CAS denied');
  begin
    perform public.write_picker_sync(uid,1,'00000000-0000-4000-8000-000000000001','{"choice":null,"postponed":{}}');
    raise exception 'Expected operation mismatch';
  exception when invalid_parameter_value then null; end;
  begin
    perform public.write_picker_sync(null,1,gen_random_uuid(),'{"choice":null,"postponed":{}}');
    raise exception 'Expected null identity denial';
  exception when insufficient_privilege then null; end;
  begin
    perform public.write_picker_sync(current_setting('stage12.uid2')::uuid,1,gen_random_uuid(),'{"choice":null,"postponed":{}}');
    raise exception 'Expected other identity denial';
  exception when insufficient_privilege then null; end;
  begin
    perform public.write_picker_sync(uid,1,gen_random_uuid(),'{"choice":null,"postponed":{"1":-1}}');
    raise exception 'Expected validation denial';
  exception when invalid_parameter_value then null; end;
  perform pg_temp.assert_sync((select count(*)=1 from public.picker_sync_state), 'owner sees own row only');
end $$;
select set_config('request.jwt.claims', jsonb_build_object('sub', current_setting('stage12.uid2'), 'role','authenticated')::text, true);
select pg_temp.assert_sync((select count(*)=0 from public.picker_sync_state), 'other account cannot see snapshot');
select public.write_picker_sync(current_setting('stage12.uid2')::uuid,0,gen_random_uuid(),'{"choice":{"game":{"appid":620,"name":"Portal 2"},"mode":"new","contextId":"action","genreFilter":"any","acceptedAt":"2026-11-13T12:00:00Z","installedOnly":true},"postponed":{}}');
select pg_temp.assert_sync((select count(*)=1 from public.picker_sync_state), 'second owner sees only own row');
reset role;
delete from auth.users where id in (current_setting('stage12.uid1')::uuid,current_setting('stage12.uid2')::uuid);
select pg_temp.assert_sync((select count(*)=0 from public.picker_sync_state where user_id in (current_setting('stage12.uid1')::uuid,current_setting('stage12.uid2')::uuid)), 'account deletion cascades');
select 'picker_sync_sql_passed' as result;
rollback;
