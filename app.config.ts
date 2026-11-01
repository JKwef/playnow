import type { ConfigContext, ExpoConfig } from 'expo/config';

/**
 * Динамический конфиг поверх app.json.
 *
 * Expo CLI сам подгружает .env в process.env перед вычислением конфига.
 * В `extra` пробрасываем ТОЛЬКО публичные значения: всё, что лежит в `extra`,
 * попадает в JS-бандл и может быть извлечено из APK/IPA.
 * STEAM_API_KEY и RAWG_API_KEY сюда не попадают намеренно (SEC1):
 * они живут в секретах Supabase Edge Functions.
 */
export default ({ config }: ConfigContext): ExpoConfig => ({
  ...config,
  name: config.name ?? 'PlayNow',
  slug: config.slug ?? 'playnow',
  extra: {
    ...config.extra,
    supabaseUrl: process.env.SUPABASE_URL ?? '',
    supabaseAnonKey: process.env.SUPABASE_ANON_KEY ?? '',
  },
});
