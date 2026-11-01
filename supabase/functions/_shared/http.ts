/** Общие помощники HTTP для Edge Functions. */

/**
 * CORS для веб-версии (проверка на ПК в браузере). Мобильному приложению CORS не нужен.
 * Origin «*» безопасен: доступ даёт только JWT пользователя в заголовке, а не cookies.
 */
export const CORS_HEADERS: Record<string, string> = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'authorization, apikey, content-type, x-client-info',
  'Access-Control-Max-Age': '86400',
};

export const json = (status: number, body: Record<string, unknown>): Response =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...CORS_HEADERS, 'Content-Type': 'application/json', 'Cache-Control': 'no-store' },
  });

/** Ответ на preflight-запрос браузера. */
export const preflight = (): Response => new Response(null, { status: 204, headers: CORS_HEADERS });

/** Таймаут исходящих запросов к Steam/RAWG (SEC2). */
export const UPSTREAM_TIMEOUT_MS = 10_000;
