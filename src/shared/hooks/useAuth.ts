import { create } from 'zustand';

/**
 * Жизненный цикл сессии. Один union вместо нескольких boolean (isLoading, isAuthenticated...):
 * так невозможны противоречивые комбинации вроде «загружается и одновременно вошёл».
 *
 * unknown   — старт приложения, ещё читаем сохранённую сессию;
 * signedOut — сессии нет, показываем вход;
 * signingIn — идёт вход через Steam (экран входа остаётся, кнопка заблокирована);
 * signedIn  — есть пользователь.
 */
export type AuthStatus = 'unknown' | 'signedOut' | 'signingIn' | 'signedIn';

export interface AuthUser {
  /** SteamID64, например "76561197960287930". */
  steamId: string;
}

export interface AuthState {
  status: AuthStatus;
  user: AuthUser | null;
  /** Текст последней ошибки входа для показа пользователю; сбрасывается при новой попытке. */
  error: string | null;
  /** Восстановить сессию при старте (FR1.3). Никогда не бросает: при ошибке → signedOut. */
  restoreSession: () => Promise<void>;
  /** Запустить вход через Steam (FR1.1). Никогда не бросает: ошибка уходит в `error`. */
  signIn: () => Promise<void>;
  /** Выйти и очистить сохранённую сессию (FR1.4). */
  signOut: () => Promise<void>;
}

/** Удобные производные значения: экраны не должны сравнивать строки статуса сами. */
export const selectIsAuthenticated = (state: AuthState): boolean => state.status === 'signedIn';
export const selectIsBusy = (state: AuthState): boolean =>
  state.status === 'unknown' || state.status === 'signingIn';

/**
 * Глобальный стейт авторизации (Zustand).
 *
 * Контракт финальный, реализация методов — ЗАГЛУШКА ЭТАПА 2:
 * restoreSession сразу даёт signedOut, signIn подставляет фиктивного пользователя.
 * На этапе 4 тела методов заменятся на Steam OpenID + SecureStore без изменения сигнатур.
 */
export const useAuth = create<AuthState>()((set) => ({
  status: 'unknown',
  user: null,
  error: null,

  restoreSession: async () => {
    set({ status: 'signedOut', user: null });
  },

  signIn: async () => {
    set({ status: 'signingIn', error: null });
    set({ status: 'signedIn', user: { steamId: 'dev-steam-id' } });
  },

  signOut: async () => {
    set({ status: 'signedOut', user: null, error: null });
  },
}));
