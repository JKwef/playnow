-- Imported genres stay separate from explicit user corrections.
alter table public.games add column genres_override text[]
  check (genres_override is null or (
    cardinality(genres_override) between 1 and 32
    and array_position(genres_override, null) is null
  ));

comment on column public.games.genres_override is
  'User-corrected genres. NULL uses imported genres. Steam and RAWG never write this column.';

-- Existing ownership policies cover this column; user_id remains non-editable.
grant update (genres_override) on public.games to authenticated;
