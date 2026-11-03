import { fetchWithTimeout, REQUEST_TIMEOUT_MS } from '@/shared/services/http';

/** fetch, который отвечает только при отмене запроса: так видно, сработал ли таймаут. */
const hangingFetch = jest.fn(
  (_input: unknown, init?: RequestInit) =>
    new Promise<Response>((_resolve, reject) => {
      if (init?.signal?.aborted) reject(new Error('aborted'));
      init?.signal?.addEventListener('abort', () => reject(new Error('aborted')));
    }),
);

describe('fetchWithTimeout (SEC2)', () => {
  const realFetch = global.fetch;

  beforeEach(() => {
    jest.useFakeTimers();
    hangingFetch.mockClear();
    global.fetch = hangingFetch as unknown as typeof fetch;
  });

  afterEach(() => {
    jest.useRealTimers();
    global.fetch = realFetch;
  });

  test('таймаут 10 секунд', async () => {
    expect(REQUEST_TIMEOUT_MS).toBe(10_000);
    const request = fetchWithTimeout('https://example.com');
    jest.advanceTimersByTime(REQUEST_TIMEOUT_MS);
    await expect(request).rejects.toThrow('aborted');
  });

  test('отмена снаружи прерывает запрос', async () => {
    const outer = new AbortController();
    const request = fetchWithTimeout('https://example.com', { signal: outer.signal });
    outer.abort();
    await expect(request).rejects.toThrow('aborted');
  });

  test('уже отменённый signal прерывает сразу', async () => {
    const outer = new AbortController();
    outer.abort();
    await expect(fetchWithTimeout('https://example.com', { signal: outer.signal })).rejects.toThrow(
      'aborted',
    );
  });

  test('успешный ответ проходит без изменений', async () => {
    const response = new Response('ok');
    global.fetch = jest.fn(() => Promise.resolve(response)) as unknown as typeof fetch;
    await expect(fetchWithTimeout('https://example.com')).resolves.toBe(response);
  });
});
