import Constants from 'expo-constants';

/** Публичная конфигурация клиента, прочитанная из `extra` (см. app.config.ts). */
export interface AppEnv {
  supabaseUrl: string;
  supabaseAnonKey: string;
}

export class EnvError extends Error {
  constructor(missing: readonly string[]) {
    super(`Не заданы переменные окружения: ${missing.join(', ')}. Проверьте файл .env`);
    this.name = 'EnvError';
  }
}

const readString = (extra: Record<string, unknown>, key: string): string => {
  const value = extra[key];
  return typeof value === 'string' ? value.trim() : '';
};

/**
 * Читает и валидирует env. Бросает EnvError, если чего-то не хватает,
 * чтобы ошибка конфигурации всплывала сразу, а не на первом сетевом запросе.
 */
export const getEnv = (): AppEnv => {
  const extra: Record<string, unknown> = Constants.expoConfig?.extra ?? {};
  const env: AppEnv = {
    supabaseUrl: readString(extra, 'supabaseUrl'),
    supabaseAnonKey: readString(extra, 'supabaseAnonKey'),
  };

  const missing = (Object.keys(env) as (keyof AppEnv)[]).filter((key) => env[key] === '');
  if (missing.length > 0) {
    throw new EnvError(missing);
  }
  return env;
};
