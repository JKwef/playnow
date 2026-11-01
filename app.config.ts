import type { ConfigContext, ExpoConfig } from 'expo/config';

/**
 * Динамический конфиг поверх app.json.
 *
 * Expo CLI сам подгружает .env в process.env перед вычислением конфига.
 * Публичные значения проекта по умолчанию лежат в app.json → extra: URL проекта и publishable key
 * Supabase публичны по своей природе (доступ режет RLS), поэтому их можно коммитить.
 * В `extra` пробрасываем ТОЛЬКО публичные значения: всё, что лежит в `extra`,
 * попадает в JS-бандл и может быть извлечено из APK/IPA.
 * STEAM_API_KEY и RAWG_API_KEY сюда не попадают намеренно (SEC1):
 * они живут в секретах Supabase Edge Functions.
 */
const readExtra = (extra: Record<string, unknown> | undefined, key: string): string => {
  const value = extra?.[key];
  return typeof value === 'string' ? value : '';
};

export default ({ config }: ConfigContext): ExpoConfig => ({
  ...config,
  name: config.name ?? 'PlayNow',
  slug: config.slug ?? 'playnow',
  extra: {
    ...config.extra,
    // .env переопределяет значения из app.json (например, для отдельного dev-проекта).
    supabaseUrl: process.env.SUPABASE_URL || readExtra(config.extra, 'supabaseUrl'),
    supabaseAnonKey: process.env.SUPABASE_ANON_KEY || readExtra(config.extra, 'supabaseAnonKey'),
  },
});
