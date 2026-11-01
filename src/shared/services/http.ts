/** Таймаут сетевых запросов (SEC2). */
export const REQUEST_TIMEOUT_MS = 10_000;

/**
 * fetch с таймаутом: стандартный fetch ждёт ответа бесконечно.
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
