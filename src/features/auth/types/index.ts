export interface SessionTokens {
  accessToken: string;
  refreshToken: string;
}

export type SteamSignInResult =
  | { kind: 'success'; tokens: SessionTokens }
  /** Пользователь закрыл окно входа или нажал «Отмена» в Steam. Это не ошибка. */
  | { kind: 'cancelled' };

/**
 * network           — нет интернета или таймаут;
 * steam_unavailable — Steam не ответил или ответил ошибкой;
 * rejected          — сервер отклонил вход (подпись, код, verifier);
 * server            — ошибка нашего бэкенда;
 * config            — приложение не настроено (.env);
 * unknown           — всё прочее.
 */
export type AuthErrorCode =
  'network' | 'steam_unavailable' | 'rejected' | 'server' | 'config' | 'unknown';

export class AuthError extends Error {
  constructor(
    public readonly code: AuthErrorCode,
    message: string,
    options?: { cause?: unknown },
  ) {
    super(message, options);
    this.name = 'AuthError';
  }
}
