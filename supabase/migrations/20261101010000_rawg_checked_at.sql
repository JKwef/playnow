-- Этап 6: пометка «игру уже искали в RAWG». Без неё каждый вызов rawg-enrich
-- заново тратил бы квоту RAWG на игры, у которых жанров в RAWG просто нет.
-- Клиенту колонка не нужна: её пишет только Edge Function (service role),
-- поэтому в column-level grants для authenticated она не добавляется.
alter table public.games add column if not exists rawg_checked_at timestamptz;

-- Частичный индекс под выборку партии: «непроверенные игры пользователя».
create index if not exists games_rawg_pending_idx
  on public.games (user_id, playtime)
  where rawg_checked_at is null;
