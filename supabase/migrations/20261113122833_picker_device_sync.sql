-- One compare-and-swap register per account. No game FK: a saved choice may outlive an import.
create schema if not exists picker_sync_private;
revoke all on schema picker_sync_private from public, anon;
grant usage on schema picker_sync_private to authenticated;

create function picker_sync_private.valid_snapshot(value jsonb) returns boolean
language plpgsql immutable set search_path = '' as $$
declare c jsonb; pair record; id numeric;
begin
  if jsonb_typeof(value) <> 'object' or not (value ? 'choice' and value ? 'postponed')
    or jsonb_typeof(value->'postponed') <> 'object' or octet_length(value::text) > 2097152
    or exists (select 1 from jsonb_object_keys(value) k where k not in ('choice','postponed')) then return false; end if;
  c := value->'choice';
  if c <> 'null'::jsonb then
    if jsonb_typeof(c) <> 'object' or jsonb_typeof(c->'game') <> 'object'
      or jsonb_typeof(c->'game'->'appid') <> 'number' or (c->'game'->>'appid') !~ '^[1-9][0-9]{0,15}$'
      or jsonb_typeof(c->'game'->'name') <> 'string' or length(btrim(c->'game'->>'name')) not between 1 and 500
      or not ((c->'game') ?& array['appid','name'])
      or coalesce(c->>'contextId','') not in ('short-session','addictive','story','action')
      or coalesce(c->>'mode','') not in ('new','continue') or coalesce(c->>'genreFilter','') not in ('context','any')
      or jsonb_typeof(c->'acceptedAt') <> 'string'
      or (c ? 'installedOnly' and jsonb_typeof(c->'installedOnly') <> 'boolean')
      or not (c ?& array['game','contextId','mode','genreFilter','acceptedAt']) then return false; end if;
    if (c->'game'->>'appid')::numeric > 9007199254740991 then return false; end if;
    perform (c->>'acceptedAt')::timestamptz;
    if not isfinite((c->>'acceptedAt')::timestamptz) then return false; end if;
  end if;
  for pair in select * from jsonb_each(value->'postponed') loop
    if pair.key !~ '^[1-9][0-9]{0,15}$' or jsonb_typeof(pair.value) <> 'number'
      or pair.value::text !~ '^[1-9][0-9]{0,15}$' then return false; end if;
    if pair.key::numeric > 9007199254740991 or pair.value::text::numeric > 9007199254740991 then return false; end if;
  end loop;
  return true;
exception when others then return false;
end;
$$;
revoke all on function picker_sync_private.valid_snapshot(jsonb) from public, anon;
grant execute on function picker_sync_private.valid_snapshot(jsonb) to authenticated;

create table public.picker_sync_state (
  user_id uuid primary key references auth.users(id) on delete cascade,
  revision bigint not null default 0 check (revision between 0 and 9007199254740991),
  snapshot jsonb not null default '{"choice":null,"postponed":{}}'::jsonb
    check (picker_sync_private.valid_snapshot(snapshot)),
  mutation_id uuid,
  updated_at timestamptz not null default now()
);
alter table public.picker_sync_state enable row level security;
revoke all on public.picker_sync_state from public, anon, authenticated;
grant select on public.picker_sync_state to authenticated;
grant all on public.picker_sync_state to service_role;
create policy "picker sync: read own" on public.picker_sync_state for select to authenticated
  using (user_id = (select auth.uid()));

-- Definer is kept in a non-exposed schema so clients cannot bypass revision checks with DML.
create function picker_sync_private.write_state(expected_user_id uuid, expected_revision bigint, operation_id uuid, new_snapshot jsonb)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare uid uuid := auth.uid(); current_row public.picker_sync_state; accepted boolean := false;
begin
  if uid is null or expected_user_id is null or uid <> expected_user_id then raise exception 'Account mismatch' using errcode='42501'; end if;
  if expected_revision is null or expected_revision < 0 or operation_id is null
    or new_snapshot is null or not picker_sync_private.valid_snapshot(new_snapshot) then
    raise exception 'Invalid sync request' using errcode='22023';
  end if;
  insert into public.picker_sync_state(user_id) values(uid) on conflict(user_id) do nothing;
  select * into current_row from public.picker_sync_state where user_id=uid for update;
  if current_row.mutation_id = operation_id then
    if current_row.snapshot <> new_snapshot then raise exception 'Operation reused with another payload' using errcode='22023'; end if;
    accepted := true;
  elsif current_row.revision = expected_revision then
    update public.picker_sync_state set snapshot=new_snapshot, revision=revision+1,
      mutation_id=operation_id, updated_at=now() where user_id=uid returning * into current_row;
    accepted := true;
  end if;
  return jsonb_build_object('applied',accepted,'revision',current_row.revision,'snapshot',current_row.snapshot,'mutationId',current_row.mutation_id);
end;
$$;
revoke all on function picker_sync_private.write_state(uuid,bigint,uuid,jsonb) from public, anon;
grant execute on function picker_sync_private.write_state(uuid,bigint,uuid,jsonb) to authenticated;

create function public.write_picker_sync(expected_user_id uuid, expected_revision bigint, operation_id uuid, new_snapshot jsonb)
returns jsonb language sql security invoker set search_path = '' as $$
  select picker_sync_private.write_state(expected_user_id,expected_revision,operation_id,new_snapshot);
$$;
revoke all on function public.write_picker_sync(uuid,bigint,uuid,jsonb) from public, anon;
grant execute on function public.write_picker_sync(uuid,bigint,uuid,jsonb) to authenticated;
