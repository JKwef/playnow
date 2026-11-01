-- Этап 7 (правки): дата последнего запуска из Steam для сортировки «Недавно запускал».
-- Steam не отдаёт дату покупки, а rtime_last_played отдаёт.
alter table public.games add column if not exists last_played_at timestamptz;

-- Обложки по старому шаблону Steam у новых игр дают 404. rawg-enrich теперь проверяет
-- обложку и находит рабочую; отправляем такие игры на одну повторную проверку.
-- Жанры при этом не теряются: функция сохраняет уже найденные.
update public.games
set rawg_checked_at = null
where cover_url ~ '^https://cdn\.cloudflare\.steamstatic\.com/steam/apps/[0-9]+/header\.jpg$';
