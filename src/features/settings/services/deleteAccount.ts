import { getSupabase } from '@/shared/services/supabase';

/**
 * Удаление аккаунта на сервере через Edge Function `delete-account`.
 * JWT подставляет сам supabase-js: функция проверяет его и удаляет только своего пользователя.
 * Бросает ошибку, если запрос не удался, — хук превращает её в понятное сообщение.
 */
export const deleteAccountOnServer = async (): Promise<void> => {
  const { error } = await getSupabase().functions.invoke('delete-account');
  if (error) throw error;
};
