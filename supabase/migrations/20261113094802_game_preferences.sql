create table public.game_preferences (
  user_id uuid not null,
  appid integer not null,
  progress_status text not null default 'unspecified'
    check (progress_status in ('unspecified', 'not_started', 'playing', 'completed')),
  excluded boolean not null default false,
  primary key (user_id, appid),
  foreign key (user_id, appid) references public.games (user_id, appid) on delete cascade
);
alter table public.game_preferences enable row level security;
revoke all on public.game_preferences from public, anon, authenticated;
grant select, delete on public.game_preferences to authenticated;
grant insert (user_id, appid, progress_status, excluded) on public.game_preferences to authenticated;
grant update (progress_status, excluded) on public.game_preferences to authenticated;
grant all on public.game_preferences to service_role;

create policy "game_preferences: select own" on public.game_preferences
  for select to authenticated using (user_id = (select auth.uid()));
create policy "game_preferences: insert own" on public.game_preferences
  for insert to authenticated with check (user_id = (select auth.uid()));
create policy "game_preferences: update own" on public.game_preferences
  for update to authenticated using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));
create policy "game_preferences: delete own" on public.game_preferences
  for delete to authenticated using (user_id = (select auth.uid()));

-- Independent fields are patched atomically. Expected identity prevents a delayed
-- action from being applied to a different account after a token switch.
create function public.set_game_preference(
  target_appid integer,
  expected_user_id uuid,
  new_status text default null,
  new_excluded boolean default null
) returns table (appid integer, progress_status text, excluded boolean)
language sql security invoker set search_path = '' as $$
  insert into public.game_preferences as preference (user_id, appid, progress_status, excluded)
    select auth.uid(), target_appid, coalesce(new_status, 'unspecified'), coalesce(new_excluded, false)
    where auth.uid() = expected_user_id
  on conflict (user_id, appid) do update set
    progress_status = coalesce(new_status, preference.progress_status),
    excluded = coalesce(new_excluded, preference.excluded)
  returning preference.appid, preference.progress_status, preference.excluded;
$$;
revoke all on function public.set_game_preference(integer, uuid, text, boolean) from public, anon;
grant execute on function public.set_game_preference(integer, uuid, text, boolean) to authenticated;
