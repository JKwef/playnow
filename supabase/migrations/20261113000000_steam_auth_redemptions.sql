-- A unique insert serializes competing exchanges across all function instances.
-- No identity, code or token is persisted. Clients have no access to this table.
create table public.steam_auth_redemptions (
  code_hash text primary key check (code_hash ~ '^[A-Za-z0-9_-]{43}$'),
  expires_at timestamptz not null
);
alter table public.steam_auth_redemptions enable row level security;
revoke all on public.steam_auth_redemptions from public, anon, authenticated;
grant insert, select, delete on public.steam_auth_redemptions to service_role;
create index steam_auth_redemptions_expiry on public.steam_auth_redemptions (expires_at);

create function public.claim_steam_auth_code(digest text, expiry timestamptz)
returns boolean language plpgsql security definer set search_path = '' as $$
declare claimed integer;
begin
  if expiry <= clock_timestamp() then return false; end if;
  delete from public.steam_auth_redemptions where expires_at <= clock_timestamp();
  insert into public.steam_auth_redemptions (code_hash, expires_at)
    values (digest, expiry) on conflict (code_hash) do nothing;
  get diagnostics claimed = row_count;
  return claimed = 1;
end;
$$;
revoke all on function public.claim_steam_auth_code(text, timestamptz) from public, anon, authenticated;
grant execute on function public.claim_steam_auth_code(text, timestamptz) to service_role;
