import { createClient, processLock, type SupabaseClient } from '@supabase/supabase-js';
import { AppState, Platform, type AppStateStatus } from 'react-native';

import { getEnv, type AppEnv } from '@/shared/config/env';
import type { Database } from '@/shared/types/database';

import { createChunkedSecureStorage, type KeyValueStorage } from './secureStorage';

export type AppSupabaseClient = SupabaseClient<Database>;

/** Таймаут сетевых запросов (SEC2). */
export const REQUEST_TIMEOUT_MS = 10_000;

/**
 * fetch с таймаутом: supabase-js по умолчанию ждёт ответа бесконечно.
 * Если вызывающий код передал свой signal, уважаем и его.
 */
export const fetchWithTimeout: typeof fetch = (input, init) => {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
  const outerSignal = init?.signal;
  if (outerSignal) {
    if (outerSignal.aborted) {
      controller.abort();
    } else {
      outerSignal.addEventListener('abort', () => controller.abort(), { once: true });
    }
  }
  return fetch(input, { ...init, signal: controller.signal }).finally(() => clearTimeout(timer));
};

export interface SupabaseClientDeps {
  env: AppEnv;
  storage: KeyValueStorage;
}

/**
 * Фабрика клиента. Зависимости передаются явно (DI): в тестах подставляются
 * фейковые env и in-memory storage, без SecureStore и реальной сети.
 */
export const createSupabaseClient = ({ env, storage }: SupabaseClientDeps): AppSupabaseClient =>
  createClient<Database>(env.supabaseUrl, env.supabaseAnonKey, {
    auth: {
      storage,
      autoRefreshToken: true,
      persistSession: true,
      // В RN нет URL страницы, из которого можно достать сессию (это для веба).
      detectSessionInUrl: false,
      // Сериализует обновление токена внутри процесса, чтобы два параллельных refresh не гонялись.
      lock: processLock,
    },
    global: { fetch: fetchWithTimeout },
  });

let client: AppSupabaseClient | null = null;

/**
 * Ленивый синглтон для приложения. Создаётся при первом обращении,
 * поэтому ошибка конфигурации (нет .env) всплывёт с понятным текстом EnvError.
 */
export const getSupabase = (): AppSupabaseClient => {
  if (client === null) {
    client = createSupabaseClient({ env: getEnv(), storage: createChunkedSecureStorage() });
  }
  return client;
};

/**
 * Обновлять токен в фоне имеет смысл, только пока приложение на экране.
 * Рекомендация Supabase для React Native: иначе таймеры спят в бэкграунде,
 * и после возврата пользователь может получить просроченный токен (FR1.5).
 * Возвращает функцию отписки.
 */
export const bindSupabaseAutoRefresh = (supabase: AppSupabaseClient): (() => void) => {
  if (Platform.OS === 'web') {
    return () => undefined;
  }
  const onChange = (state: AppStateStatus): void => {
    if (state === 'active') {
      void supabase.auth.startAutoRefresh();
    } else {
      void supabase.auth.stopAutoRefresh();
    }
  };
  if (AppState.currentState === 'active') {
    onChange('active');
  }
  const subscription = AppState.addEventListener('change', onChange);
  return () => subscription.remove();
};
