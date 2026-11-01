import { buildQuery, parseQueryParams } from '@/shared/utils/url';

import { AuthError, type SessionTokens, type SteamSignInResult } from '../types';
import { toAuthError } from './authErrors';

/** Результат открытия окна входа (совместим с expo-web-browser). */
export type AuthSessionResult = { type: 'success'; url: string } | { type: string };

export interface SteamAuthServiceDeps {
  /** https://<ref>.supabase.co/functions/v1/steam-auth */
  functionsBaseUrl: string;
  /** Куда функция вернёт пользователя: playnow://auth (или exp://…/--/auth в Expo Go). */
  redirectUrl: string;
  openAuthSession: (url: string, redirectUrl: string) => Promise<AuthSessionResult>;
  /** Случайный PKCE verifier (base64url, 43+ символов). */
  createVerifier: () => string;
  sha256Base64Url: (input: string) => Promise<string>;
  fetch: typeof fetch;
}

export interface SteamAuthService {
  signIn: () => Promise<SteamSignInResult>;
}

/** Коды ошибок, которые Edge Function кладёт в ?error= при редиректе. */
const CALLBACK_ERRORS: Record<string, AuthError['code']> = {
  steam_unavailable: 'steam_unavailable',
  invalid_assertion: 'rejected',
  invalid_request: 'rejected',
  server_error: 'server',
};

/** Валидация ответа /exchange (SEC3): доверяем только строкам нужной формы. */
const parseTokens = (body: unknown): SessionTokens => {
  if (typeof body === 'object' && body !== null) {
    const { access_token: accessToken, refresh_token: refreshToken } = body as Record<
      string,
      unknown
    >;
    if (
      typeof accessToken === 'string' &&
      accessToken.length > 0 &&
      typeof refreshToken === 'string' &&
      refreshToken.length > 0
    ) {
      return { accessToken, refreshToken };
    }
  }
  throw new AuthError('server', 'Некорректный ответ /exchange');
};

/**
 * Вход через Steam OpenID 2.0 по схеме из supabase/functions/steam-auth.
 *
 * Окно входа открывается в системном браузере (ASWebAuthenticationSession / Custom Tabs),
 * а не в WebView: приложение не видит пароль Steam, пользователь видит настоящий адрес
 * steamcommunity.com, работают сохранённый вход и Steam Guard.
 *
 * PKCE: verifier живёт только в памяти приложения, на сервер сначала уходит его хеш.
 * Даже если кто-то перехватит редирект с кодом, без verifier сессию он не получит.
 */
export const createSteamAuthService = (deps: SteamAuthServiceDeps): SteamAuthService => ({
  signIn: async () => {
    try {
      const verifier = deps.createVerifier();
      const challenge = await deps.sha256Base64Url(verifier);
      const startUrl = `${deps.functionsBaseUrl}/start?${buildQuery({
        challenge,
        redirect: deps.redirectUrl,
      })}`;

      const result = await deps.openAuthSession(startUrl, deps.redirectUrl);
      if (result.type !== 'success' || !('url' in result)) {
        return { kind: 'cancelled' };
      }

      const params = parseQueryParams(result.url);
      if (params.error === 'cancelled') {
        return { kind: 'cancelled' };
      }
      if (params.error !== undefined) {
        throw new AuthError(
          CALLBACK_ERRORS[params.error] ?? 'unknown',
          `callback: ${params.error}`,
        );
      }
      if (params.code === undefined || params.code === '') {
        throw new AuthError('rejected', 'В редиректе нет кода');
      }

      const response = await deps.fetch(`${deps.functionsBaseUrl}/exchange`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ code: params.code, verifier }),
      });
      if (!response.ok) {
        throw new AuthError(
          response.status >= 500 ? 'server' : 'rejected',
          `/exchange ответил ${response.status}`,
        );
      }
      return { kind: 'success', tokens: parseTokens(await response.json()) };
    } catch (error) {
      throw toAuthError(error);
    }
  },
});
