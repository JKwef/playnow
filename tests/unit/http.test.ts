import { createFetchWithTimeout, fetchWithTimeout } from '@/shared/services/http';

describe('HTTP deadlines', () => {
  let fetchMock: jest.SpyInstance;

  beforeEach(() => {
    jest.useFakeTimers();
    fetchMock = jest.spyOn(globalThis, 'fetch');
  });

  afterEach(() => {
    jest.restoreAllMocks();
    jest.useRealTimers();
  });

  const pendingRequest = () => {
    fetchMock.mockImplementation(
      (_input: unknown, init?: RequestInit) =>
        new Promise((_resolve, reject) => {
          init?.signal?.addEventListener('abort', () => reject(new Error('aborted')), {
            once: true,
          });
        }),
    );
  };

  it('allows a slow enrichment batch while keeping the ordinary deadline', async () => {
    pendingRequest();
    const normal = expect(fetchWithTimeout('https://example.com')).rejects.toThrow('aborted');
    const slowRequest = createFetchWithTimeout(90_000)('https://example.com');
    const slow = expect(slowRequest).rejects.toThrow('aborted');
    const slowSignal = (fetchMock.mock.calls[1]?.[1] as RequestInit).signal;

    await jest.advanceTimersByTimeAsync(10_000);
    await normal;
    expect(slowSignal?.aborted).toBe(false);
    await jest.advanceTimersByTimeAsync(80_000);
    await slow;
    expect(slowSignal?.aborted).toBe(true);
    expect(jest.getTimerCount()).toBe(0);
  });

  it('honors cancellation by the caller', async () => {
    pendingRequest();
    const controller = new AbortController();
    const result = expect(
      fetchWithTimeout('https://example.com', { signal: controller.signal }),
    ).rejects.toThrow('aborted');
    controller.abort();
    await result;
    expect(jest.getTimerCount()).toBe(0);
  });

  it('removes the cancellation listener and timer after success', async () => {
    fetchMock.mockResolvedValue({ ok: true });
    const controller = new AbortController();
    const remove = jest.spyOn(controller.signal, 'removeEventListener');
    await fetchWithTimeout('https://example.com', { signal: controller.signal });
    expect(remove).toHaveBeenCalledWith('abort', expect.any(Function));
    expect(jest.getTimerCount()).toBe(0);
  });
});
