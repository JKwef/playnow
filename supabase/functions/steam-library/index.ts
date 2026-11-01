/**
 * Edge Function: импорт библиотеки Steam текущего пользователя (FR2.1, FR2.2).
 *
 * POST /steam-library (с JWT пользователя; проверяется внутри через auth.getUser)
 *   → 200 { games: GameRow[] }                  — все игры пользователя из таблицы games
 *   → 403 { error: 'private_profile' }          — профиль или игровые детали скрыты (FR2.7)
 *   → 401 { error: 'unauthorized' }
 *   → 502 { error: 'steam_unavailable' }
 *
 * SteamID берём из app_metadata проверенного JWT, а не из запроса:
 * иначе можно было бы запросить чужую библиотеку. Ключ Steam живёт только здесь (SEC1).
 */
import { createClient } from 'npm:@supabase/supabase-js@2';

import { readApiKey, requireEnv } from '../_shared/apiKeys.ts';
import { buildOwnedGamesUrl, parseOwnedGames } from './steam.ts';

const SUPABASE_URL = requireEnv('SUPABASE_URL');
const SERVICE_ROLE_KEY = readApiKey('SUPABASE_SERVICE_ROLE_KEY', 'SUPABASE_SECRET_KEYS');
const ANON_KEY = readApiKey('SUPABASE_ANON_KEY', 'SUPABASE_PUBLISHABLE_KEYS');
const STEAM_API_KEY = requireEnv('STEAM_API_KEY');
const STEAM_ID_RE = /^\d{17}$/;

const admin = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
  auth: { persistSession: false, autoRefreshToken: false },
});

const json = (status: number, body: Record<string, unknown>): Response =>
  new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' },
  });

/**
 * Пользователь из JWT. auth.getUser проверяет токен на сервере Auth: подпись, срок,
 * не удалён ли пользователь. Поэтому функция деплоится с verify_jwt = false.
 */
const getUser = async (req: Request) => {
  const token = req.headers.get('Authorization')?.replace(/^Bearer\s+/i, '');
  if (!token) return null;
  const client = createClient(SUPABASE_URL, ANON_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const { data, error } = await client.auth.getUser(token);
  if (error || !data.user) return null;
  const steamId: unknown = data.user.app_metadata.steam_id;
  return typeof steamId === 'string' && STEAM_ID_RE.test(steamId)
    ? { id: data.user.id, steamId }
    : null;
};

Deno.serve(async (req) => {
  if (req.method !== 'POST') return json(405, { error: 'method_not_allowed' });

  const user = await getUser(req);
  if (!user) return json(401, { error: 'unauthorized' });

  let body: unknown;
  try {
    const response = await fetch(buildOwnedGamesUrl(STEAM_API_KEY, user.steamId), {
      signal: AbortSignal.timeout(10_000),
    });
    if (response.status === 401 || response.status === 403) {
      // Steam отвечает так при невалидном ключе. Это проблема конфигурации, не пользователя.
      console.error('Steam отклонил STEAM_API_KEY', response.status);
      return json(500, { error: 'server_misconfigured' });
    }
    if (!response.ok) {
      console.error('Steam GetOwnedGames failed', response.status);
      return json(502, { error: 'steam_unavailable' });
    }
    body = await response.json();
  } catch (error) {
    console.error('Steam GetOwnedGames error', String(error));
    return json(502, { error: 'steam_unavailable' });
  }

  let result;
  try {
    result = parseOwnedGames(body);
  } catch (error) {
    console.error('Steam response parse error', String(error));
    return json(502, { error: 'steam_unavailable' });
  }
  if (result.kind === 'private') return json(403, { error: 'private_profile' });

  if (result.games.length > 0) {
    // Обновляем только то, что знает Steam. genres не трогаем: их заполняет обогащение из RAWG.
    const rows = result.games.map((game) => ({
      user_id: user.id,
      appid: game.appid,
      name: game.name,
      playtime: game.playtime,
      cover_url: game.coverUrl,
    }));
    const upsert = await admin.from('games').upsert(rows, { onConflict: 'user_id,appid' });
    if (upsert.error) {
      console.error('games upsert failed', upsert.error);
      return json(500, { error: 'server_error' });
    }
  }

  // Возвращаем всё из таблицы: так клиент получает и жанры, сохранённые раньше,
  // и игры, добавленные вручную (FR2.6).
  const { data, error } = await admin
    .from('games')
    .select('appid, name, cover_url, genres, playtime, created_at')
    .eq('user_id', user.id)
    .order('name');
  if (error) {
    console.error('games select failed', error);
    return json(500, { error: 'server_error' });
  }
  return json(200, { games: data ?? [] });
});
