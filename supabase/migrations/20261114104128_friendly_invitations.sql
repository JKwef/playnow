create table friendly_private.invitations (
  session_id uuid primary key references friendly_private.sessions on delete cascade,
  sender uuid not null references auth.users on delete cascade,
  recipient uuid not null references auth.users on delete cascade,
  status text not null default 'pending' check (status in ('pending', 'accepted', 'declined')),
  check (sender <> recipient)
);
alter table friendly_private.invitations enable row level security;

create function friendly_private.nickname(account auth.users)
returns text language sql stable set search_path = '' as $$
  select left(coalesce(nullif(trim(account.raw_user_meta_data->>'display_name'), ''),
    nullif(trim(account.raw_app_meta_data->>'steam_nickname'), ''),
    'Q' || left(replace(account.id::text, '-', ''), 10)), 40);
$$;

create function friendly_private.invitation_action(
  action text, target uuid, query text, selected integer[]
) returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  uid uuid := auth.uid();
  sid uuid := target;
  invite friendly_private.invitations;
begin
  if uid is null or not exists(select 1 from auth.users where id = uid) then
    raise exception 'Authentication required';
  end if;
  if action = 'search' then
    return coalesce((select jsonb_agg(jsonb_build_object('id', found.id, 'name', found.name))
      from (select u.id, friendly_private.nickname(u) as name from auth.users u
        where u.id <> uid and length(trim(query)) between 3 and 40
          and strpos(lower(friendly_private.nickname(u)), lower(trim(query))) > 0
        order by name, u.id limit 12) found), '[]'::jsonb);
  elsif action = 'inbox' then
    return coalesce((select jsonb_agg(jsonb_build_object('id', i.session_id, 'name', m.nickname)
      order by s.created_at desc) from friendly_private.invitations i
      join friendly_private.sessions s on s.id = i.session_id
      join friendly_private.members m on m.session_id = i.session_id and m.user_id = i.sender
      where i.recipient = uid and i.status = 'pending'), '[]'::jsonb);
  elsif action = 'invite' then
    if target is null or target = uid then raise exception 'Invalid recipient'; end if;
    perform 1 from auth.users where id = uid for update;
    select i.session_id into sid from friendly_private.invitations i
      where i.sender = uid and i.recipient = target and i.status = 'pending' limit 1;
    if sid is null then
      insert into friendly_private.sessions(seats) values (2) returning id into sid;
      insert into friendly_private.members(session_id, user_id, nickname)
        select sid, u.id, friendly_private.nickname(u) from auth.users u where u.id = uid;
      insert into friendly_private.invitations(session_id, sender, recipient) values (sid, uid, target);
    end if;
  elsif action in ('accept', 'decline') then
    select * into invite from friendly_private.invitations where session_id = sid and recipient = uid for update;
    if not found then raise exception 'Invitation not found'; end if;
    if invite.status <> 'pending' and invite.status <> (case when action = 'accept' then 'accepted' else 'declined' end) then
      raise exception 'Invitation already answered';
    end if;
    if action = 'accept' then
      perform friendly_private.swipes('join', sid, null, null);
      update friendly_private.members m set nickname = friendly_private.nickname(u)
        from auth.users u where m.session_id = sid and m.user_id = uid and u.id = uid;
      update friendly_private.invitations set status = 'accepted' where session_id = sid;
    else
      update friendly_private.invitations set status = 'declined' where session_id = sid;
      return '[]'::jsonb;
    end if;
  elsif action in ('vote', 'hide') then
    if action = 'vote' and exists (select 1 from friendly_private.invitations
      where session_id = sid and sender = uid and status = 'declined')
      then raise exception 'Invitation declined'; end if;
    perform friendly_private.swipes(action, sid, null, selected);
    if action = 'hide' then return '[]'::jsonb; end if;
  elsif action = 'list' then
    sid := null;
  else
    raise exception 'Invalid action';
  end if;
  return coalesce((select jsonb_agg(entry || jsonb_build_object(
    'invitation', i.status,
    'invitee', case when i.sender = uid then friendly_private.nickname(recipient_account) end
  ) order by (entry->>'date')::numeric desc)
    from jsonb_array_elements(friendly_private.swipes('list', sid, null, null)) entry
    left join friendly_private.invitations i on i.session_id = (entry->>'id')::uuid
    left join auth.users recipient_account on recipient_account.id = i.recipient
  ), '[]'::jsonb);
end;
$$;

-- Joining new sessions requires an invitation addressed to the authenticated user.
revoke execute on function public.friendly_swipes(text,uuid,integer,integer[]) from authenticated;
revoke execute on function friendly_private.swipes(text,uuid,integer,integer[]) from authenticated;
revoke all on function friendly_private.nickname(auth.users) from public;
revoke all on function friendly_private.invitation_action(text,uuid,text,integer[]) from public;
grant execute on function friendly_private.invitation_action(text,uuid,text,integer[]) to authenticated;

create function public.friendly_invitation(action text, target uuid default null, query text default null, selected integer[] default null)
returns jsonb language sql security invoker set search_path = '' as $$
  select friendly_private.invitation_action(action, target, query, selected);
$$;
revoke all on function public.friendly_invitation(text,uuid,text,integer[]) from public, anon;
grant execute on function public.friendly_invitation(text,uuid,text,integer[]) to authenticated;
