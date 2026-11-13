import type { Session, SupabaseClient } from '@supabase/supabase-js';
import { create, type StoreApi, type UseBoundStore } from 'zustand';

import { bindSupabaseAutoRefresh, getSupabase } from '@/shared/services/supabase';
import { invalidateAccount } from '@/shared/services/accountScope';

import { authErrorMessage, toAuthError } from '../services/authErrors';
import { createDefaultSteamAuth } from '../services/defaultSteamAuth';
import type { SteamAuthService } from '../services/steamAuthService';

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
  /** Текст последней ошибки для показа пользователю; сбрасывается при новой попытке. */
  error: string | null;
  /** Восстановить сессию при старте (FR1.3). Никогда не бросает: при ошибке → signedOut. */
  restoreSession: () => Promise<void>;
  /** Вход через Steam (FR1.1). Никогда не бросает: ошибка уходит в `error`. */
  signIn: () => Promise<void>;
  /** Выйти и очистить сохранённую сессию (FR1.4). Никогда не бросает. */
  signOut: () => Promise<void>;
}

export const selectIsAuthenticated = (state: AuthState): boolean => state.status === 'signedIn';
export const selectIsBusy = (state: AuthState): boolean =>
  state.status === 'unknown' || state.status === 'signingIn';

/** Часть supabase.auth, которая нужна стору. Узкий интерфейс проще подменить в тестах. */
export type AuthClient = Pick<
  SupabaseClient['auth'],
  'getSession' | 'setSession' | 'signOut' | 'onAuthStateChange'
>;

export interface AuthStoreDeps {
  /** Ленивые фабрики: ошибка конфигурации (нет .env) станет понятной ошибкой входа, а не крашем. */
  getAuthClient: () => AuthClient;
  getSteamAuth: () => SteamAuthService;
  /** Вызывается один раз после успешного создания клиента (автообновление токена). */
  onClientReady?: () => void;
}

const STEAM_ID_RE = /^\d{17}$/;

/**
 * steam_id берём из app_metadata: её пишет только Edge Function под service role,
 * пользователь подменить её не может (в отличие от user_metadata).
 */
const userFromSession = (session: Session | null): AuthUser | null => {
  const steamId: unknown = session?.user.app_metadata.steam_id;
  return typeof steamId === 'string' && STEAM_ID_RE.test(steamId) ? { steamId } : null;
};

export const createAuthStore = (deps: AuthStoreDeps): UseBoundStore<StoreApi<AuthState>> =>
  create<AuthState>()((set, get) => {
    let subscribed = false;
    let operation = 0;
    let signingOut = false;

    /**
     * Подписка на события Supabase держит стор в синхроне с реальной сессией:
     * если refresh token протух или отозван, Supabase шлёт SIGNED_OUT,
     * и навигатор сам вернёт пользователя на экран входа (FR1.5).
     */
    const ensureSubscribed = (auth: AuthClient): void => {
      if (subscribed) return;
      subscribed = true;
      deps.onClientReady?.();
      auth.onAuthStateChange((event, session) => {
        if (signingOut) return;
        // Внутри колбэка нельзя ждать другие методы supabase.auth (возможен дедлок),
        // поэтому только синхронно обновляем стор.
        const user = userFromSession(session);
        if (user !== null) {
          if (user.steamId !== get().user?.steamId) operation += 1;
          set({ status: 'signedIn', user, error: null });
        } else if (event === 'SIGNED_OUT' && get().status === 'signedIn') {
          operation += 1;
          set({ status: 'signedOut', user: null });
        }
      });
    };

    return {
      status: 'unknown',
      user: null,
      error: null,

      restoreSession: async () => {
        if (signingOut) return;
        const currentOperation = ++operation;
        try {
          const auth = deps.getAuthClient();
          ensureSubscribed(auth);
          // Сессия читается из SecureStore. Без сети она тоже вернётся (оффлайн-режим NFR2),
          // а токен обновится, когда сеть появится.
          const { data, error } = await auth.getSession();
          if (currentOperation !== operation) return;
          if (error) throw error;
          const user = userFromSession(data.session);
          if (user === null && data.session !== null) {
            // Сессия есть, но без steam_id: это не наш пользователь. Чистим локально.
            await auth.signOut({ scope: 'local' });
          }
          if (currentOperation !== operation) return;
          set(user === null ? { status: 'signedOut', user: null } : { status: 'signedIn', user });
        } catch (error) {
          if (currentOperation !== operation) return;
          console.warn('restoreSession failed', error);
          const authError = toAuthError(error);
          set({
            status: 'signedOut',
            user: null,
            // Ошибку конфигурации показываем сразу: иначе кнопка входа «молча» не будет работать.
            error: authError.code === 'config' ? authErrorMessage(authError) : null,
          });
        }
      },

      signIn: async () => {
        if (get().status === 'signingIn' || signingOut) return;
        const currentOperation = ++operation;
        set({ status: 'signingIn', error: null });
        try {
          const auth = deps.getAuthClient();
          ensureSubscribed(auth);
          const result = await deps.getSteamAuth().signIn();
          if (currentOperation !== operation) return;
          if (result.kind === 'cancelled') {
            set({ status: 'signedOut' });
            return;
          }
          // Сессию в SecureStore сохраняет сам supabase-js через наш storage (FR1.2).
          const { data, error } = await auth.setSession({
            access_token: result.tokens.accessToken,
            refresh_token: result.tokens.refreshToken,
          });
          if (currentOperation !== operation) return;
          if (error) throw error;
          const user = userFromSession(data.session);
          if (user === null) {
            await auth.signOut({ scope: 'local' });
            throw new Error('В сессии нет steam_id');
          }
          set({ status: 'signedIn', user, error: null });
        } catch (error) {
          if (currentOperation !== operation) return;
          console.warn('signIn failed', error);
          set({ status: 'signedOut', user: null, error: authErrorMessage(error) });
        }
      },

      signOut: async () => {
        operation += 1;
        signingOut = true;
        // Hide the account and invalidate work before waiting for storage/network.
        set({ status: 'signedOut', user: null, error: null });
        try {
          // scope: 'local' — выходим на этом устройстве и не зависим от сети:
          // локальная сессия удаляется даже оффлайн.
          await deps.getAuthClient().signOut({ scope: 'local' });
        } catch (error) {
          console.warn('signOut failed, clearing local state anyway', error);
        }
        signingOut = false;
        set({ status: 'signedOut', user: null, error: null });
      },
    };
  });

/** Сервис входа создаётся один раз и только при первом использовании. */
const lazySteamAuth = (): (() => SteamAuthService) => {
  let service: SteamAuthService | null = null;
  return () => {
    service ??= createDefaultSteamAuth();
    return service;
  };
};

let unbindAutoRefresh: (() => void) | null = null;

/** Глобальный стор приложения с боевыми зависимостями. */
export const useAuth = createAuthStore({
  getAuthClient: () => getSupabase().auth,
  getSteamAuth: lazySteamAuth(),
  onClientReady: () => {
    unbindAutoRefresh ??= bindSupabaseAutoRefresh(getSupabase());
  },
});

useAuth.subscribe((state, previous) => {
  const previousId = previous.user?.steamId;
  if (previousId && previousId !== state.user?.steamId) invalidateAccount(previousId);
});
