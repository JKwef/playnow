/** Таймаут сетевых запросов (SEC2). */
export const REQUEST_TIMEOUT_MS = 10_000;

/**
 * fetch с таймаутом: стандартный fetch ждёт ответа бесконечно.
 * Если вызывающий код передал свой signal, уважаем и его.
 */
export const createFetchWithTimeout =
  (timeoutMs: number): typeof fetch =>
  async (input, init) => {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    const outerSignal = init?.signal;
    const abort = () => controller.abort();
    if (outerSignal) {
      if (outerSignal.aborted) {
        controller.abort();
      } else {
        outerSignal.addEventListener('abort', abort, { once: true });
      }
    }
    try {
      return await fetch(input, { ...init, signal: controller.signal });
    } finally {
      clearTimeout(timer);
      outerSignal?.removeEventListener('abort', abort);
    }
  };

export const fetchWithTimeout = createFetchWithTimeout(REQUEST_TIMEOUT_MS);
