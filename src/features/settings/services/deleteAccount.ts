import { getSupabase } from '@/shared/services/supabase';

/**
 * Удаление аккаунта на сервере через Edge Function `delete-account`.
 * JWT подставляет сам supabase-js: функция проверяет его и удаляет только своего пользователя.
 * Бросает ошибку, если запрос не удался, — хук превращает её в понятное сообщение.
 */
export const deleteAccountOnServer = async (steamId: string): Promise<void> => {
  const client = getSupabase();
  const { data, error: sessionError } = await client.auth.getSession();
  if (sessionError) throw sessionError;
  const session = data.session;
  if (!session || session.user.app_metadata.steam_id !== steamId)
    throw new Error('Account changed');
  // Pin the token to the confirmed account, even if the active session changes later.
  const { error } = await client.functions.invoke('delete-account', {
    headers: { Authorization: `Bearer ${session.access_token}` },
  });
  if (error) throw error;
};
