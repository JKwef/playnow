-- Проверка RLS и ограничений схемы.
-- Запуск против локального Supabase (npx supabase start):
--   psql "postgresql://postgres:postgres@127.0.0.1:54322/postgres" -v ON_ERROR_STOP=1 -f supabase/tests/rls.sql
-- Всё выполняется в транзакции и откатывается; любая неудачная проверка прерывает скрипт.

begin;

-- Два пользователя: A и B.
insert into auth.users (id) values
  ('00000000-0000-0000-0000-00000000000a'),
  ('00000000-0000-0000-0000-00000000000b');
insert into public.users (id, steam_id) values
  ('00000000-0000-0000-0000-00000000000a', '76561197960287930'),
  ('00000000-0000-0000-0000-00000000000b', '76561197960287931');
insert into public.games (id, user_id, appid, name) values
  ('10000000-0000-0000-0000-00000000000a', '00000000-0000-0000-0000-00000000000a', 730, 'Counter-Strike 2'),
  ('10000000-0000-0000-0000-00000000000b', '00000000-0000-0000-0000-00000000000b', 570, 'Dota 2');

-- Хелпер: выполнить SQL и убедиться, что он упал с ошибкой.
create function pg_temp.expect_error(sql text, label text) returns void language plpgsql as $$
begin
  execute sql;
  raise exception 'FAIL: % (ожидали ошибку, но запрос прошёл)', label;
exception
  when raise_exception then raise;
  when others then raise notice 'ok: %', label;
end;
$$;
grant execute on function pg_temp.expect_error(text, text) to anon, authenticated;

-- ---------------------------------------------------------------- anon
set local role anon;
select pg_temp.expect_error('select * from public.games', 'anon не читает games');
select pg_temp.expect_error('select * from public.users', 'anon не читает users');
select pg_temp.expect_error('select * from public.steam_auth_redemptions', 'anon не читает погашения');
select pg_temp.expect_error(
  $q$select public.claim_steam_auth_code(repeat('x', 43), now() + interval '1 minute')$q$,
  'anon не погашает коды');
reset role;

-- ---------------------------------------------------------------- пользователь A
set local role authenticated;
set local request.jwt.claims = '{"sub":"00000000-0000-0000-0000-00000000000a","role":"authenticated"}';
select pg_temp.expect_error('select * from public.steam_auth_redemptions', 'A не читает погашения');
select pg_temp.expect_error(
  $q$select public.claim_steam_auth_code(repeat('x', 43), now() + interval '1 minute')$q$,
  'A не погашает коды');

do $$
begin
  if (select count(*) from public.users) <> 1 then raise exception 'FAIL: A видит чужие профили'; end if;
  if (select count(*) from public.games) <> 1 then raise exception 'FAIL: A видит чужие игры'; end if;
  if exists (select 1 from public.games where appid = 570) then raise exception 'FAIL: A видит игру B'; end if;
  raise notice 'ok: A видит только свои users/games';
end $$;

-- Профиль только для чтения: steam_id подменить нельзя.
select pg_temp.expect_error(
  $q$update public.users set steam_id = '76561197960287999'$q$, 'A не меняет steam_id');
select pg_temp.expect_error(
  $q$insert into public.users (id, steam_id) values ('00000000-0000-0000-0000-00000000000a', '76561197960287999')$q$,
  'A не создаёт профиль сам');

-- Свои игры: insert/update работают.
insert into public.games (user_id, appid, name, genres) values
  ('00000000-0000-0000-0000-00000000000a', 440, 'Team Fortress 2', '{action,shooter}');
update public.games set playtime = 42 where appid = 440;
do $$ begin
  if (select playtime from public.games where appid = 440) <> 42 then raise exception 'FAIL: update своей игры'; end if;
  raise notice 'ok: A добавляет и меняет свои игры';
end $$;

-- Чужие игры: insert с чужим user_id запрещён, update/delete чужих молча не затрагивают строк.
select pg_temp.expect_error(
  $q$insert into public.games (user_id, appid, name) values ('00000000-0000-0000-0000-00000000000b', 10, 'x')$q$,
  'A не вставляет игру от имени B');
select pg_temp.expect_error(
  $q$update public.games set user_id = '00000000-0000-0000-0000-00000000000b' where appid = 730$q$,
  'A не переносит свою игру на B');
update public.games set name = 'hacked' where id = '10000000-0000-0000-0000-00000000000b';
delete from public.games where id = '10000000-0000-0000-0000-00000000000b';

-- Дубликат appid и мусорные значения режутся ограничениями.
update public.games set genres_override = '{puzzle,arcade}' where appid = 440;
do $$ begin
  if (select genres_override from public.games where appid = 440) <> array['puzzle','arcade'] then
    raise exception 'FAIL: не удалось сохранить исправленные жанры';
  end if;
  if (select playtime from public.games where appid = 440) <> 42 then
    raise exception 'FAIL: исправление жанра изменило playtime';
  end if;
end $$;
select pg_temp.expect_error(
  $q$update public.games set genres_override = '{}' where appid = 440$q$,
  'пустой пользовательский жанр запрещён');
select pg_temp.expect_error(
  $q$update public.games set genres_override = array[null]::text[] where appid = 440$q$,
  'null в списке жанров запрещён');

select pg_temp.expect_error(
  $q$insert into public.games (user_id, appid, name) values ('00000000-0000-0000-0000-00000000000a', 730, 'dup')$q$,
  'дубликат appid в бэклоге');
select pg_temp.expect_error(
  $q$insert into public.games (user_id, appid, name, playtime) values ('00000000-0000-0000-0000-00000000000a', 1, 'x', -5)$q$,
  'отрицательный playtime');
select pg_temp.expect_error(
  $q$insert into public.games (user_id, appid, name, cover_url) values ('00000000-0000-0000-0000-00000000000a', 2, 'x', 'http://insecure')$q$,
  'cover_url не по https');

-- Сессии: на свою игру можно, на чужую нельзя (составной FK), ended_at < started_at нельзя.
insert into public.play_sessions (user_id, game_id) values
  ('00000000-0000-0000-0000-00000000000a', '10000000-0000-0000-0000-00000000000a');
update public.play_sessions set ended_at = now() + interval '1 hour';
select pg_temp.expect_error(
  $q$insert into public.play_sessions (user_id, game_id) values ('00000000-0000-0000-0000-00000000000a', '10000000-0000-0000-0000-00000000000b')$q$,
  'сессия на чужую игру');
select pg_temp.expect_error(
  $q$update public.play_sessions set ended_at = started_at - interval '1 minute'$q$,
  'ended_at раньше started_at');
select pg_temp.expect_error(
  $q$update public.play_sessions set user_id = '00000000-0000-0000-0000-00000000000b'$q$,
  'A не переносит сессию на B');
reset role;

-- Проверяем под суперпользователем, что чужая игра B не пострадала.
do $$ begin
  if (select name from public.games where id = '10000000-0000-0000-0000-00000000000b') <> 'Dota 2' then
    raise exception 'FAIL: A изменил или удалил игру B';
  end if;
  raise notice 'ok: игра B не тронута';
end $$;

-- ---------------------------------------------------------------- каскад
-- Steam/RAWG import changes only imported columns, never the correction.
update public.games set genres = '{action}', playtime = 43
  where user_id = '00000000-0000-0000-0000-00000000000a' and appid = 440;
do $$ begin
  if (select genres_override from public.games where user_id = '00000000-0000-0000-0000-00000000000a' and appid = 440) <> array['puzzle','arcade'] then
    raise exception 'FAIL: импорт затёр исправление жанра';
  end if;
end $$;

set local role authenticated;
set local request.jwt.claims = '{"sub":"00000000-0000-0000-0000-00000000000b","role":"authenticated"}';
do $$
begin
  if (select count(*) from public.games) <> 1 then raise exception 'FAIL: B видит чужие игры'; end if;
  if exists (select 1 from public.users where steam_id = '76561197960287930') then raise exception 'FAIL: B видит A'; end if;
  if exists (select 1 from public.play_sessions) then raise exception 'FAIL: B видит сессии A'; end if;
  update public.games set name = 'hacked by B' where appid = 730;
  if found then raise exception 'FAIL: B меняет игру A'; end if;
  update public.games set genres_override = '{rpg}' where appid = 440;
  if found then raise exception 'FAIL: B меняет жанры A'; end if;
  delete from public.games where appid = 730;
  if found then raise exception 'FAIL: B удаляет игру A'; end if;
end $$;
select pg_temp.expect_error(
  $q$insert into public.games (user_id, appid, name) values ('00000000-0000-0000-0000-00000000000a', 11, 'x')$q$,
  'B не вставляет игры A');
reset role;

delete from auth.users where id = '00000000-0000-0000-0000-00000000000a';
do $$ begin
  if exists (select 1 from public.users where id = '00000000-0000-0000-0000-00000000000a')
     or exists (select 1 from public.games where user_id = '00000000-0000-0000-0000-00000000000a')
     or exists (select 1 from public.play_sessions where user_id = '00000000-0000-0000-0000-00000000000a') then
    raise exception 'FAIL: данные A не удалились каскадом';
  end if;
  raise notice 'ok: удаление аккаунта чистит все данные';
  if (select count(*) from public.games where user_id = '00000000-0000-0000-0000-00000000000b') <> 1 then
    raise exception 'FAIL: удаление A затронуло B';
  end if;
end $$;

rollback;
