/** Общие помощники HTTP для Edge Functions. */
export const json = (status: number, body: Record<string, unknown>): Response =>
  new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' },
  });

/** Таймаут исходящих запросов к Steam/RAWG (SEC2). */
export const UPSTREAM_TIMEOUT_MS = 10_000;
