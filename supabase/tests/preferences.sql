-- Local Supabase: psql ... -v ON_ERROR_STOP=1 -f supabase/tests/preferences.sql
begin;
insert into auth.users (id) values
  ('30000000-0000-0000-0000-00000000000a'),
  ('30000000-0000-0000-0000-00000000000b');
insert into public.users (id, steam_id) values
  ('30000000-0000-0000-0000-00000000000a', '76561197960287932'),
  ('30000000-0000-0000-0000-00000000000b', '76561197960287933');
insert into public.games (user_id, appid, name, genres, playtime) values
  ('30000000-0000-0000-0000-00000000000a', 730, 'A game', '{action}', 61),
  ('30000000-0000-0000-0000-00000000000b', 570, 'B game', '{rpg}', 0);

create function pg_temp.preference_expect_error(statement text) returns void language plpgsql as $$
begin
  execute statement;
  raise exception 'FAIL: expected a permission or constraint error';
exception when raise_exception then raise;
  when others then null;
end;
$$;
grant execute on function pg_temp.preference_expect_error(text) to anon, authenticated;

set local role anon;
select pg_temp.preference_expect_error('select * from public.game_preferences');
select pg_temp.preference_expect_error($q$select public.set_game_preference(730,'30000000-0000-0000-0000-00000000000a','completed',true)$q$);
reset role;

set local role authenticated;
set local request.jwt.claims = '{"sub":"30000000-0000-0000-0000-00000000000a","role":"authenticated"}';

-- Playing for 61 minutes does not create or infer a progression status.
do $$ begin
  if exists(select 1 from public.game_preferences) then raise exception 'FAIL: inferred status'; end if;
end $$;
select * from public.set_game_preference(730, '30000000-0000-0000-0000-00000000000a', 'completed');
select * from public.set_game_preference(730, '30000000-0000-0000-0000-00000000000a', new_excluded => true);
do $$ begin
  if not exists(select 1 from public.game_preferences where appid=730 and progress_status='completed' and excluded) then
    raise exception 'FAIL: exclusion reset the completion status';
  end if;
  if not exists(select 1 from public.games where appid=730 and playtime=61 and genres=array['action']) then
    raise exception 'FAIL: preference changed imported fields';
  end if;
end $$;
select * from public.set_game_preference(730, '30000000-0000-0000-0000-00000000000a', 'playing');
do $$ begin
  if not exists(select 1 from public.game_preferences where appid=730 and progress_status='playing' and excluded) then
    raise exception 'FAIL: changing status reset permanent exclusion';
  end if;
  if (select count(*) from public.set_game_preference(730, '30000000-0000-0000-0000-00000000000b', 'completed', false)) <> 0 then
    raise exception 'FAIL: a stale identity request was applied';
  end if;
end $$;
select pg_temp.preference_expect_error($q$select public.set_game_preference(730,'30000000-0000-0000-0000-00000000000a','invalid')$q$);
select pg_temp.preference_expect_error($q$select public.set_game_preference(570,'30000000-0000-0000-0000-00000000000a','playing')$q$);
select pg_temp.preference_expect_error($q$insert into public.game_preferences(user_id,appid) values('30000000-0000-0000-0000-00000000000b',570)$q$);
select pg_temp.preference_expect_error($q$update public.game_preferences set user_id='30000000-0000-0000-0000-00000000000b'$q$);
select pg_temp.preference_expect_error($q$update public.game_preferences set appid=570$q$);

-- Return and undo restore the explicit fields without deleting the game.
select * from public.set_game_preference(730, '30000000-0000-0000-0000-00000000000a', 'not_started', false);
select * from public.set_game_preference(730, '30000000-0000-0000-0000-00000000000a', 'playing', true);
reset role;

-- The same import upsert used by steam-library leaves preferences intact.
insert into public.games(user_id,appid,name,playtime) values('30000000-0000-0000-0000-00000000000a',730,'A game',62)
  on conflict(user_id,appid) do update set playtime=excluded.playtime;
do $$ begin
  if not exists(select 1 from public.game_preferences where user_id='30000000-0000-0000-0000-00000000000a' and progress_status='playing' and excluded) then
    raise exception 'FAIL: import reset user preferences';
  end if;
end $$;

set local role authenticated;
set local request.jwt.claims = '{"sub":"30000000-0000-0000-0000-00000000000b","role":"authenticated"}';
do $$ begin
  if exists(select 1 from public.game_preferences) then raise exception 'FAIL: B reads A'; end if;
  update public.game_preferences set excluded=false where appid=730;
  if found then raise exception 'FAIL: B updates A'; end if;
  delete from public.game_preferences where appid=730;
  if found then raise exception 'FAIL: B deletes A'; end if;
end $$;
select * from public.set_game_preference(570, '30000000-0000-0000-0000-00000000000b', 'not_started', false);
reset role;
delete from auth.users where id='30000000-0000-0000-0000-00000000000a';
do $$ begin
  if exists(select 1 from public.game_preferences where user_id='30000000-0000-0000-0000-00000000000a') then
    raise exception 'FAIL: deleted account preferences remain';
  end if;
  if not exists(select 1 from public.game_preferences where user_id='30000000-0000-0000-0000-00000000000b') then
    raise exception 'FAIL: deleting A affected B';
  end if;
end $$;
rollback;
