import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { act, renderHook } from '@testing-library/react-native';
import type { ReactNode } from 'react';

import { useAuth } from '@/features/auth/hooks/useAuth';
import { backlogKeys } from '@/features/backlog/hooks/useBacklog';
import { useGenreOverrides } from '@/features/backlog/hooks/useGenreOverrides';
import type { BacklogCache } from '@/features/backlog/services/backlogCache';
import type { GenreOverridesService } from '@/features/backlog/services/genreOverrides';

import { makeGame } from './fixtures/game';

const A = '76561197960287930';
const original = makeGame({ genres: ['action'] });
const corrected = makeGame({
  genres: ['puzzle'],
  importedGenres: ['action'],
  genresOverride: ['puzzle'],
});
const setup = async (service: GenreOverridesService, failedCache = false) => {
  useAuth.setState({ user: { steamId: A }, status: 'signedIn' });
  const client = new QueryClient();
  const snapshot = { games: [original], updatedAt: '2026-11-13', metadataRemaining: 12 };
  client.setQueryData(backlogKeys.remote(A), snapshot);
  const cache: BacklogCache = {
    read: jest.fn(async () => null),
    clear: jest.fn(async () => undefined),
    write: jest.fn(async () => {
      if (failedCache) throw new Error('disk full');
    }),
  };
  const factory = () => service;
  const wrapper = ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={client}>{children}</QueryClientProvider>
  );
  const hook = await renderHook(() => useGenreOverrides(factory, cache), { wrapper });
  return { ...hook, client, cache, snapshot };
};
afterEach(() => useAuth.setState({ user: null, status: 'signedOut' }));

test('server-confirmed correction updates both caches and preserves metadata progress', async () => {
  const { result, client, cache, unmount } = await setup({ save: async () => corrected });
  await act(async () => {
    expect(await result.current.save(1, ['puzzle'])).toBe(true);
  });
  expect(client.getQueryData(backlogKeys.remote(A))).toEqual({
    games: [corrected],
    updatedAt: '2026-11-13',
    metadataRemaining: 12,
  });
  expect(cache.write).toHaveBeenCalledWith(A, client.getQueryData(backlogKeys.remote(A)));
  expect(result.current.saved).toBe(true);
  await unmount();
  client.clear();
});

test('failed server write preserves the previous game and exposes retryable error', async () => {
  const { result, client, cache, snapshot, unmount } = await setup({
    save: async () => {
      throw new Error('offline');
    },
  });
  await act(async () => {
    expect(await result.current.save(1, ['puzzle'])).toBe(false);
  });
  expect(client.getQueryData(backlogKeys.remote(A))).toEqual(snapshot);
  expect(cache.write).not.toHaveBeenCalled();
  expect(result.current.saved).toBe(false);
  expect(result.current.errorMessage).toContain('подключение');
  await unmount();
  client.clear();
});

test('a late response from a previous account does not write local data', async () => {
  let finish!: () => void;
  const pending = new Promise<void>((resolve) => {
    finish = resolve;
  });
  const { result, client, cache, unmount } = await setup({
    save: async () => {
      await pending;
      return corrected;
    },
  });
  await act(async () => {
    const saving = result.current.save(1, ['puzzle']);
    useAuth.setState({ user: { steamId: '76561197960287931' } });
    finish();
    expect(await saving).toBe(false);
  });
  expect(cache.write).not.toHaveBeenCalled();
  expect(result.current.saved).toBe(false);
  await unmount();
  client.clear();
});

test('disk failure is distinguished from successful account storage', async () => {
  const { result, client, unmount } = await setup({ save: async () => corrected }, true);
  await act(async () => {
    expect(await result.current.save(1, ['puzzle'])).toBe(true);
  });
  expect(result.current.errorMessage).toContain('сохранены в аккаунте');
  expect(result.current.errorMessage).toContain('кэш');
  await unmount();
  client.clear();
});
