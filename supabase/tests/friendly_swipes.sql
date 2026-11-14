begin;
insert into auth.users(id, raw_user_meta_data) values
 ('10000000-0000-4000-8000-000000000001', '{"display_name":"Sender"}'),
 ('10000000-0000-4000-8000-000000000002', '{"display_name":"Companion"}'),
 ('10000000-0000-4000-8000-000000000003', '{"display_name":"Outsider"}');

set local role authenticated;
do $$
declare
  sender uuid := '10000000-0000-4000-8000-000000000001';
  recipient uuid := '10000000-0000-4000-8000-000000000002';
  outsider uuid := '10000000-0000-4000-8000-000000000003';
  sid uuid;
  result jsonb;
begin
  perform set_config('request.jwt.claims', jsonb_build_object('sub', sender)::text, true);
  if public.friendly_invitation('search', query => 'comp')->0->>'id' is distinct from recipient::text
    then raise exception 'Nickname search failed'; end if;
  result := public.friendly_invitation('invite', recipient);
  sid := (result->0->>'id')::uuid;
  if sid is null or result->0->>'invitee' <> 'Companion' then raise exception 'Invite failed'; end if;
  if public.friendly_invitation('invite', recipient)->0->>'id' is distinct from sid::text
    then raise exception 'Duplicate invitation'; end if;
  result := public.friendly_invitation('vote', sid, selected => array[620,427520]);
  if result->0->'games' is distinct from 'null'::jsonb then raise exception 'Result before acceptance'; end if;

  perform set_config('request.jwt.claims', jsonb_build_object('sub', outsider)::text, true);
  if public.friendly_invitation('inbox') <> '[]'::jsonb or public.friendly_invitation('list') <> '[]'::jsonb
    then raise exception 'Invitation visible to outsider'; end if;
  begin
    perform public.friendly_invitation('accept', sid);
    raise exception 'Outsider accepted';
  exception when raise_exception then
    if sqlerrm <> 'Invitation not found' then raise; end if;
  end;
  if has_function_privilege(current_user, 'public.friendly_swipes(text,uuid,integer,integer[])', 'EXECUTE')
    then raise exception 'Code-based join still available'; end if;

  perform set_config('request.jwt.claims', jsonb_build_object('sub', recipient)::text, true);
  if public.friendly_invitation('inbox')->0->>'name' is distinct from 'Sender'
    then raise exception 'Recipient did not get notification'; end if;
  result := public.friendly_invitation('accept', sid);
  if result->0->'games' is distinct from 'null'::jsonb or public.friendly_invitation('inbox') <> '[]'::jsonb
    then raise exception 'Accept exposed results or left an unread invitation'; end if;
  result := public.friendly_invitation('vote', sid, selected => array[620]);
  if result->0->'games' is distinct from '[620]'::jsonb then raise exception 'Incorrect shared result'; end if;
  perform public.friendly_invitation('hide', sid);
  if public.friendly_invitation('list') <> '[]'::jsonb then raise exception 'History entry not hidden'; end if;

  perform set_config('request.jwt.claims', jsonb_build_object('sub', sender)::text, true);
  if public.friendly_invitation('list')->0->'games' is distinct from '[620]'::jsonb
    then raise exception 'Sender lost shared result'; end if;
  sid := (public.friendly_invitation('invite', recipient)->0->>'id')::uuid;
  perform set_config('request.jwt.claims', jsonb_build_object('sub', recipient)::text, true);
  perform public.friendly_invitation('decline', sid);
  if public.friendly_invitation('inbox') <> '[]'::jsonb then raise exception 'Declined invitation remained'; end if;
  perform set_config('request.jwt.claims', jsonb_build_object('sub', sender)::text, true);
  if not exists(select 1 from jsonb_array_elements(public.friendly_invitation('list')) item
    where item->>'id' = sid::text and item->>'invitation' = 'declined') then
    raise exception 'Decline invisible to sender';
  end if;
end;
$$;
rollback;
