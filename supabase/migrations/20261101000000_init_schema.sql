-- PlayNow: начальная схема (TR3).
-- users ↔ auth.users 1:1; games и play_sessions принадлежат пользователю.
-- Доступ клиента только через RLS: каждый видит и меняет лишь свои строки.

-- ---------------------------------------------------------------------------
-- Таблицы
-- ---------------------------------------------------------------------------

create table public.users (
  -- Тот же id, что в auth.users: профиль удаляется вместе с аккаунтом.
  id uuid primary key references auth.users (id) on delete cascade,
  -- SteamID64 всегда 17 цифр. Храним как text: значения больше 2^53 и теряют точность в JS number.
  steam_id text not null unique check (steam_id ~ '^[0-9]{17}$'),
  created_at timestamptz not null default now()
);

comment on table public.users is 'Профиль PlayNow. Создаётся только Edge Function после проверки Steam OpenID.';

create table public.games (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.users (id) on delete cascade,
  appid integer not null check (appid > 0),
  name text not null check (char_length(name) between 1 and 500),
  cover_url text check (cover_url is null or cover_url ~ '^https://'),
  genres text[] not null default '{}',
  -- Минуты, как в Steam playtime_forever.
  playtime integer not null default 0 check (playtime >= 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  -- Одна игра один раз в бэклоге пользователя: на этом держится upsert при импорте.
  unique (user_id, appid),
  -- Нужен для составного внешнего ключа из play_sessions (см. ниже).
  unique (id, user_id)
);

create table public.play_sessions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.users (id) on delete cascade,
  game_id uuid not null,
  started_at timestamptz not null default now(),
  ended_at timestamptz,
  check (ended_at is null or ended_at >= started_at),
  -- Составной FK гарантирует на уровне БД, что сессия ссылается на игру того же пользователя.
  -- Одной RLS тут мало: без него можно записать сессию на чужой game_id.
  foreign key (game_id, user_id) references public.games (id, user_id) on delete cascade
);

-- Индексы под реальные запросы: «все мои игры», «мои последние сессии».
-- games(user_id) уже покрыт уникальным индексом (user_id, appid).
create index play_sessions_user_started_idx on public.play_sessions (user_id, started_at desc);
create index play_sessions_game_idx on public.play_sessions (game_id);

-- ---------------------------------------------------------------------------
-- updated_at
-- ---------------------------------------------------------------------------

create function public.set_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

create trigger games_set_updated_at
  before update on public.games
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------------
-- Права и RLS
-- ---------------------------------------------------------------------------

alter table public.users enable row level security;
alter table public.games enable row level security;
alter table public.play_sessions enable row level security;

-- Гостю (anon) нельзя ничего. Supabase по умолчанию выдаёт anon права на public, забираем их.
revoke all on public.users, public.games, public.play_sessions from anon;

-- users: только чтение своей строки. INSERT/UPDATE делает Edge Function под service_role
-- (она обходит RLS). Если бы клиент мог менять steam_id, он подставил бы чужой
-- аккаунт Steam и импортировал чужую библиотеку.
revoke all on public.users from authenticated;
grant select on public.users to authenticated;

create policy "users: select own"
  on public.users for select
  to authenticated
  using (id = (select auth.uid()));

-- games: полный CRUD своих строк (импорт из Steam, ручное добавление FR2.6, удаление).
-- user_id менять нельзя: в UPDATE даём права только на изменяемые колонки.
revoke all on public.games from authenticated;
grant select, delete on public.games to authenticated;
grant insert (user_id, appid, name, cover_url, genres, playtime) on public.games to authenticated;
grant update (name, cover_url, genres, playtime) on public.games to authenticated;

-- (select auth.uid()) вместо auth.uid(): Postgres вычисляет его один раз на запрос,
-- а не на каждую строку. Рекомендация Supabase для производительности RLS.
create policy "games: select own"
  on public.games for select
  to authenticated
  using (user_id = (select auth.uid()));

create policy "games: insert own"
  on public.games for insert
  to authenticated
  with check (user_id = (select auth.uid()));

create policy "games: update own"
  on public.games for update
  to authenticated
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));

create policy "games: delete own"
  on public.games for delete
  to authenticated
  using (user_id = (select auth.uid()));

-- play_sessions: создать, прочитать, завершить (ended_at) и удалить свои сессии.
revoke all on public.play_sessions from authenticated;
grant select, delete on public.play_sessions to authenticated;
grant insert (user_id, game_id, started_at, ended_at) on public.play_sessions to authenticated;
grant update (ended_at) on public.play_sessions to authenticated;

create policy "play_sessions: select own"
  on public.play_sessions for select
  to authenticated
  using (user_id = (select auth.uid()));

create policy "play_sessions: insert own"
  on public.play_sessions for insert
  to authenticated
  with check (user_id = (select auth.uid()));

create policy "play_sessions: update own"
  on public.play_sessions for update
  to authenticated
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));

create policy "play_sessions: delete own"
  on public.play_sessions for delete
  to authenticated
  using (user_id = (select auth.uid()));
