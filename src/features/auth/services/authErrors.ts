import { EnvError } from '@/shared/config/env';

import { AuthError, type AuthErrorCode } from '../types';

const MESSAGES: Record<AuthErrorCode, string> = {
  network: 'Нет подключения к интернету',
  steam_unavailable: 'Steam сейчас недоступен. Попробуйте позже',
  rejected: 'Не удалось подтвердить вход через Steam. Попробуйте ещё раз',
  server: 'Сервис временно недоступен. Попробуйте позже',
  config: 'Приложение не настроено. Проверьте файл .env',
  unknown: 'Не удалось войти. Попробуйте ещё раз',
};

/** Любую ошибку входа превращает в AuthError с понятным кодом. */
export const toAuthError = (error: unknown): AuthError => {
  if (error instanceof AuthError) return error;
  if (error instanceof EnvError) return new AuthError('config', error.message, { cause: error });
  // fetch бросает TypeError при отсутствии сети и AbortError при нашем таймауте.
  if (error instanceof TypeError || (error instanceof Error && error.name === 'AbortError')) {
    return new AuthError('network', error.message, { cause: error });
  }
  return new AuthError('unknown', error instanceof Error ? error.message : String(error), {
    cause: error,
  });
};

/** Текст для пользователя. Технические детали остаются в логах, а не на экране. */
export const authErrorMessage = (error: unknown): string => MESSAGES[toAuthError(error).code];
