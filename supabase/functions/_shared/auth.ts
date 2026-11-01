import { createClient } from 'npm:@supabase/supabase-js@2';

const STEAM_ID_RE = /^\d{17}$/;

export interface RequestUser {
  id: string;
  steamId: string;
}

/**
 * Пользователь из заголовка Authorization. auth.getUser проверяет токен на сервере Auth:
 * подпись, срок, не удалён ли пользователь. Поэтому функции деплоятся с verify_jwt = false.
 * SteamID берём из app_metadata (её меняет только service role), а не из тела запроса.
 */
export const getRequestUser = async (
  req: Request,
  supabaseUrl: string,
  anonKey: string,
): Promise<RequestUser | null> => {
  const token = req.headers.get('Authorization')?.replace(/^Bearer\s+/i, '');
  if (!token) return null;
  const client = createClient(supabaseUrl, anonKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const { data, error } = await client.auth.getUser(token);
  if (error || !data.user) return null;
  const steamId: unknown = data.user.app_metadata.steam_id;
  return typeof steamId === 'string' && STEAM_ID_RE.test(steamId)
    ? { id: data.user.id, steamId }
    : null;
};
