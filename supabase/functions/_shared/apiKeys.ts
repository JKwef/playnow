/**
 * Ключи API проекта внутри Edge Function. Supabase прокидывает и старые ключи
 * (SUPABASE_SERVICE_ROLE_KEY, SUPABASE_ANON_KEY), и новые (SUPABASE_SECRET_KEYS /
 * SUPABASE_PUBLISHABLE_KEYS — JSON вида {"default": "sb_..."}). Читаем оба варианта.
 */
export const requireEnv = (name: string): string => {
  const value = Deno.env.get(name);
  if (!value) throw new Error(`Не задана переменная окружения ${name}`);
  return value;
};

export const readApiKey = (legacyName: string, jsonName: string): string => {
  const legacy = Deno.env.get(legacyName);
  if (legacy) return legacy;
  const raw = Deno.env.get(jsonName);
  if (raw) {
    try {
      const keys: unknown = JSON.parse(raw);
      if (typeof keys === 'object' && keys !== null) {
        const record = keys as Record<string, unknown>;
        const value = record.default ?? Object.values(record)[0];
        if (typeof value === 'string' && value.length > 0) return value;
      }
    } catch (error) {
      console.error(`Не удалось разобрать ${jsonName}`, String(error));
    }
  }
  throw new Error(`Не задан ни ${legacyName}, ни ${jsonName}`);
};
