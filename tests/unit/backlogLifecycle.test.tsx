import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { act, renderHook, waitFor } from '@testing-library/react-native';
import type { ReactNode } from 'react';

import { useAuth } from '@/features/auth/hooks/useAuth';
import { bindAccountQueries } from '@/features/auth/services/accountQueries';
import { backlogKeys, useBacklog, type BacklogDeps } from '@/features/backlog/hooks/useBacklog';
import type { BacklogSnapshot } from '@/features/backlog/types/Game';
import type { EnrichBatch } from '@/features/backlog/services/rawgApi';

import { makeGame } from './fixtures/game';
import { BacklogError } from '@/features/backlog/types/Game';

const A = '76561197960287930';
const B = '76561197960287931';
const snapshot: BacklogSnapshot = { games: [makeGame()], updatedAt: '2026-11-13' };
const deferred = <T,>() => {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((r) => {
    resolve = r;
  });
  return { promise, resolve };
};
const account = (steamId: string | null) =>
  useAuth.setState({
    user: steamId ? { steamId } : null,
    status: steamId ? 'signedIn' : 'signedOut',
  });

const setup = async (deps: BacklogDeps) => {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false, gcTime: Infinity } },
  });
  const unbind = bindAccountQueries(client);
  const wrapper = ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={client}>{children}</QueryClientProvider>
  );
  const rendered = await renderHook(() => useBacklog(deps), { wrapper });
  return { ...rendered, client, unbind };
};
const dependencies = (): BacklogDeps => ({
  library: () => ({ fetchLibrary: jest.fn(async () => snapshot) }),
  enrichment: () => ({ enrichBatch: jest.fn(async () => ({ games: [], remaining: 0 })) }),
  cache: {
    read: jest.fn(async () => null),
    write: jest.fn(async () => undefined),
    clear: jest.fn(async () => undefined),
  },
});

beforeEach(() => account(A));
afterEach(() => account(null));

test('logout aborts import and its late response cannot write disk or query cache', async () => {
  const pending = deferred<BacklogSnapshot>();
  const fetchLibrary = jest.fn((_signal?: AbortSignal) => pending.promise);
  const deps = { ...dependencies(), library: () => ({ fetchLibrary }) };
  const { client, unbind, unmount } = await setup(deps);
  await waitFor(() => expect(fetchLibrary).toHaveBeenCalledTimes(1));
  const signal = fetchLibrary.mock.calls[0]?.[0];
  await act(async () => {
    account(null);
  });
  expect(signal?.aborted).toBe(true);
  await act(async () => {
    pending.resolve(snapshot);
    await pending.promise;
  });
  expect(deps.cache.write).not.toHaveBeenCalled();
  expect(client.getQueryData(backlogKeys.remote(A))).toBeUndefined();
  expect(client.getQueryData(backlogKeys.cache(A))).toBeUndefined();
  await unmount();
  unbind();
  client.clear();
});

test('logout during enrichment discards its batch and does not request the next batch', async () => {
  const batch = deferred<EnrichBatch>();
  const enrichBatch = jest.fn((_signal?: AbortSignal) => batch.promise);
  const deps = { ...dependencies(), enrichment: () => ({ enrichBatch }) };
  const { client, unbind, unmount } = await setup(deps);
  await waitFor(() => expect(enrichBatch).toHaveBeenCalledTimes(1));
  const writesBeforeLogout = jest.mocked(deps.cache.write).mock.calls.length;
  await act(async () => {
    account(null);
  });
  expect(enrichBatch.mock.calls[0]?.[0]?.aborted).toBe(true);
  await act(async () => {
    batch.resolve({ games: [makeGame({ genres: ['rpg'] })], remaining: 20 });
    await batch.promise;
  });
  expect(deps.cache.write).toHaveBeenCalledTimes(writesBeforeLogout);
  expect(enrichBatch).toHaveBeenCalledTimes(1);
  expect(client.getQueryData(backlogKeys.enrichProgress(A))).toBeUndefined();
  await unmount();
  unbind();
  client.clear();
});

test('switching to B cannot display or save the late library of A', async () => {
  const pendingA = deferred<BacklogSnapshot>();
  const snapshotB = { games: [makeGame({ appid: 2, name: 'B library' })], updatedAt: '2026-11-14' };
  const fetchLibrary = jest
    .fn()
    .mockImplementationOnce(() => pendingA.promise)
    .mockResolvedValue(snapshotB);
  const deps = { ...dependencies(), library: () => ({ fetchLibrary }) };
  const { result, client, unbind, unmount } = await setup(deps);
  await waitFor(() => expect(fetchLibrary).toHaveBeenCalledTimes(1));
  await act(async () => {
    account(B);
  });
  await waitFor(() => expect(result.current.games?.[0]?.name).toBe('B library'));
  await act(async () => {
    pendingA.resolve(snapshot);
    await pendingA.promise;
  });
  expect(result.current.games).toEqual(snapshotB.games);
  expect(deps.cache.write).not.toHaveBeenCalledWith(A, expect.anything());
  expect(client.getQueryData(backlogKeys.remote(A))).toBeUndefined();
  await unmount();
  unbind();
  client.clear();
});

test('unfinished metadata is partial and explicit retry resumes without another Steam import', async () => {
  const fetchLibrary = jest.fn(async () => ({ ...snapshot, metadataRemaining: 5 }));
  const enrichBatch = jest
    .fn()
    .mockResolvedValueOnce({ games: [], remaining: 5 })
    .mockResolvedValueOnce({ games: [makeGame({ genres: ['puzzle'] })], remaining: 0 });
  const deps = {
    ...dependencies(),
    library: () => ({ fetchLibrary }),
    enrichment: () => ({ enrichBatch }),
  };
  const { result, client, unbind, unmount } = await setup(deps);
  await waitFor(() => expect(result.current.genresStatus).toBe('partial'));
  expect(result.current.status).toBe('ready');
  expect(result.current.genresRemaining).toBe(5);
  await act(async () => {
    await result.current.retryGenres();
  });
  await waitFor(() => expect(result.current.genresStatus).toBe('done'));
  expect(fetchLibrary).toHaveBeenCalledTimes(1);
  expect(enrichBatch).toHaveBeenCalledTimes(2);
  expect(result.current.games?.[0]?.genres).toEqual(['puzzle']);
  expect(deps.cache.write).toHaveBeenLastCalledWith(
    A,
    expect.objectContaining({ metadataRemaining: 0 }),
  );
  await unmount();
  unbind();
  client.clear();
});

test('RAWG failure keeps the library and unfinished count visible', async () => {
  const warn = jest.spyOn(console, 'warn').mockImplementation(() => undefined);
  const deps = {
    ...dependencies(),
    library: () => ({ fetchLibrary: async () => ({ ...snapshot, metadataRemaining: 3 }) }),
    enrichment: () => ({
      enrichBatch: async () => {
        throw new Error('RAWG unavailable');
      },
    }),
  };
  const { result, client, unbind, unmount } = await setup(deps);
  await waitFor(() => expect(result.current.genresStatus).toBe('error'));
  expect(result.current.status).toBe('ready');
  expect(result.current.games).toEqual(snapshot.games);
  expect(result.current.genresRemaining).toBe(3);
  expect(result.current.errorCode).toBeNull();
  await unmount();
  unbind();
  client.clear();
  warn.mockRestore();
});

test('network failure displays dated cache and metadata can resume without Steam import', async () => {
  const fetchLibrary = jest.fn(async () => {
    throw new BacklogError('network', 'offline');
  });
  const enrichBatch = jest.fn(async () => ({ games: [], remaining: 0 }));
  const deps = {
    ...dependencies(),
    library: () => ({ fetchLibrary }),
    enrichment: () => ({ enrichBatch }),
  };
  deps.cache.read = jest.fn(async () => ({ ...snapshot, metadataRemaining: 11 }));
  const { result, client, unbind, unmount } = await setup(deps);
  await waitFor(() => expect(result.current.errorCode).toBe('network'));
  expect(result.current.isFromCache).toBe(true);
  expect(result.current.updatedAt).toBe(snapshot.updatedAt);
  expect(result.current.games).toEqual(snapshot.games);
  expect(result.current.genresRemaining).toBe(11);
  expect(enrichBatch).not.toHaveBeenCalled();
  await act(async () => {
    await result.current.retryGenres();
  });
  expect(fetchLibrary).toHaveBeenCalledTimes(1);
  expect(result.current.isFromCache).toBe(true);
  await waitFor(() => expect(result.current.genresRemaining).toBe(0));
  await unmount();
  unbind();
  client.clear();
});

test('empty library and private profile remain distinct', async () => {
  for (const privateProfile of [false, true]) {
    const deps = dependencies();
    deps.library = () => ({
      fetchLibrary: async () => {
        if (privateProfile) throw new BacklogError('private_profile', 'private');
        return { games: [], updatedAt: '2026-11-13', metadataRemaining: 0 };
      },
    });
    const { result, client, unbind, unmount } = await setup(deps);
    await waitFor(() => expect(result.current.status).toBe(privateProfile ? 'error' : 'ready'));
    expect(result.current.errorCode).toBe(privateProfile ? 'private_profile' : null);
    expect(result.current.games).toEqual(privateProfile ? undefined : []);
    await unmount();
    unbind();
    client.clear();
  }
});
