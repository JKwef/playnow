create schema if not exists friendly_private;

create table friendly_private.sessions (
  id uuid primary key default gen_random_uuid(),
  seats integer not null check (seats between 2 and 4),
  created_at timestamptz not null default now()
);
create table friendly_private.members (
  session_id uuid references friendly_private.sessions on delete cascade,
  user_id uuid references auth.users on delete cascade,
  nickname text not null,
  votes integer[],
  hidden boolean not null default false,
  primary key (session_id, user_id)
);
alter table friendly_private.sessions enable row level security;
alter table friendly_private.members enable row level security;

create function friendly_private.swipes(action text, session_code uuid, seats integer, selected integer[])
returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  uid uuid := auth.uid();
  sid uuid := session_code;
  capacity integer;
  display_name text;
begin
  if uid is null then raise exception 'Authentication required'; end if;
  if action = 'create' then
    insert into friendly_private.sessions(seats) values ($3) returning id into sid;
  end if;
  if action in ('create', 'join', 'vote', 'hide') then
    select s.seats into capacity from friendly_private.sessions s where id = sid for update;
    if not found then raise exception 'Session not found'; end if;
    if action in ('create', 'join') then
      if not exists (select 1 from friendly_private.members where session_id = sid and user_id = uid) then
        if (select count(*) from friendly_private.members where session_id = sid) >= capacity then
          raise exception 'Session is full';
        end if;
        select left(coalesce(nullif(trim(raw_user_meta_data->>'display_name'), ''),
          nullif(trim(raw_app_meta_data->>'steam_nickname'), ''), 'Q' || left(uid::text, 8)), 40)
          into display_name from auth.users where id = uid;
        insert into friendly_private.members(session_id,user_id,nickname) values(sid,uid,display_name);
      end if;
      update friendly_private.members set hidden = false where session_id = sid and user_id = uid;
    else
      if not exists (select 1 from friendly_private.members where session_id = sid and user_id = uid) then
        raise exception 'Not a participant';
      end if;
      if action = 'vote' then
        if selected is null or cardinality(selected) > 2 or array_position(selected, null) is not null
          or not selected <@ array[620,427520] then raise exception 'Invalid vote'; end if;
        update friendly_private.members set votes = selected
          where session_id = sid and user_id = uid and votes is null;
      else
        update friendly_private.members set hidden = true where session_id = sid and user_id = uid;
      end if;
    end if;
  elsif action <> 'list' or action is null then
    raise exception 'Invalid action';
  end if;
  return coalesce((
    select jsonb_agg(jsonb_build_object(
      'id', s.id, 'date', extract(epoch from s.created_at) * 1000,
      'players', stats.names, 'seats', s.seats, 'finished', stats.finished,
      'voted', mine.votes is not null,
      'games', case when stats.finished = s.seats then array(
        select game from unnest(array[620,427520]) game
        where not exists (select 1 from friendly_private.members m
          where m.session_id = s.id and not game = any(m.votes))
      ) else null end
    ) order by s.created_at desc)
    from friendly_private.sessions s
    join friendly_private.members mine on mine.session_id = s.id and mine.user_id = uid and not mine.hidden
    cross join lateral (
      select count(votes) as finished, array_agg(nickname order by user_id) as names
      from friendly_private.members where session_id = s.id
    ) stats
    where sid is null or s.id = sid
  ), '[]'::jsonb);
end;
$$;
revoke all on schema friendly_private from public;
grant usage on schema friendly_private to authenticated;
revoke all on function friendly_private.swipes(text,uuid,integer,integer[]) from public;
grant execute on function friendly_private.swipes(text,uuid,integer,integer[]) to authenticated;
create function public.friendly_swipes(action text, session_code uuid default null, seats integer default null, selected integer[] default null)
returns jsonb language sql security invoker set search_path = '' as $$
  select friendly_private.swipes(action, session_code, seats, selected);
$$;
revoke all on function public.friendly_swipes(text,uuid,integer,integer[]) from public, anon;
grant execute on function public.friendly_swipes(text,uuid,integer,integer[]) to authenticated;
