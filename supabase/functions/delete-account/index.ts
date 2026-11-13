/**
 * Edge Function: удаление аккаунта PlayNow по требованию пользователя
 * (требование Google Play: удаление доступно из приложения).
 *
 * POST /delete-account (с JWT пользователя; проверяется внутри через auth.getUser)
 *   → 200 { ok: true }              — пользователь удалён
 *   → 401 { error: 'unauthorized' }
 *   → 500 { error: 'server_error' }
 *
 * Удаляем только СВОЙ аккаунт: id берём из проверенного JWT, а не из тела запроса.
 * games и play_sessions удаляются каскадом (on delete cascade в схеме), поэтому
 * отдельные delete-запросы не нужны. Ключ service role живёт только здесь.
 */
import { createClient } from 'npm:@supabase/supabase-js@2';

import { readApiKey, requireEnv } from '../_shared/apiKeys.ts';
import { getRequestUser } from '../_shared/auth.ts';
import { json, preflight } from '../_shared/http.ts';

const SUPABASE_URL = requireEnv('SUPABASE_URL');
const SERVICE_ROLE_KEY = readApiKey('SUPABASE_SERVICE_ROLE_KEY', 'SUPABASE_SECRET_KEYS');
const ANON_KEY = readApiKey('SUPABASE_ANON_KEY', 'SUPABASE_PUBLISHABLE_KEYS');

const admin = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
  auth: { persistSession: false, autoRefreshToken: false },
});

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return preflight();
  if (req.method !== 'POST') return json(405, { error: 'method_not_allowed' });

  const user = await getRequestUser(req, SUPABASE_URL, ANON_KEY);
  if (!user) return json(401, { error: 'unauthorized' });

  const { error } = await admin.auth.admin.deleteUser(user.id);
  if (error) {
    console.error('deleteUser failed', error);
    return json(500, { error: 'server_error' });
  }
  return json(200, { ok: true });
});
