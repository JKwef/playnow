import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { act, renderHook, waitFor } from '@testing-library/react-native';
import type { ReactNode } from 'react';

import { useAuth } from '@/features/auth/hooks/useAuth';
import { bindAccountQueries } from '@/features/auth/services/accountQueries';
import { preferenceKeys, useGamePreferences } from '@/features/backlog/hooks/useGamePreferences';
import type { GamePreferencesService } from '@/features/backlog/services/gamePreferences';
import type { GamePreferencesCache } from '@/features/backlog/services/gamePreferencesCache';
import {
  DEFAULT_PREFERENCE,
  isBlockedByPreference,
  type GamePreference,
  type GamePreferences,
} from '@/features/backlog/types/GamePreference';

const A = '76561197960287930';
const B = '76561197960287931';
const initial = () =>
  new Map<number, GamePreference>([[1, { progressStatus: 'playing', excluded: false }]]);

const setup = async (options: { cached?: GamePreferences; offline?: boolean } = {}) => {
  useAuth.setState({ user: { steamId: A }, status: 'signedIn' });
  const server = initial();
  const service: GamePreferencesService = {
    fetch: jest.fn(async (steamId) => {
      if (options.offline) throw new Error('offline');
      return steamId === A ? new Map(server) : new Map();
    }),
    save: jest.fn(async (_steamId, appid, patch) => {
      const next = { ...(server.get(appid) ?? DEFAULT_PREFERENCE), ...patch };
      server.set(appid, next);
      return next;
    }),
  };
  const cache: GamePreferencesCache = {
    read: jest.fn(async () => options.cached ?? null),
    write: jest.fn(async () => undefined),
  };
  const client = new QueryClient({ defaultOptions: { queries: { gcTime: Infinity } } });
  const unbind = bindAccountQueries(client);
  const wrapper = ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={client}>{children}</QueryClientProvider>
  );
  const rendered = await renderHook(() => useGamePreferences(service, cache), { wrapper });
  const dispose = async () => {
    await rendered.unmount();
    unbind();
    client.clear();
  };
  return { ...rendered, client, service, cache, server, dispose };
};
afterEach(() => useAuth.setState({ user: null, status: 'signedOut' }));

test('status and exclusion remain independent; undo restores only the changed field', async () => {
  const { result, dispose } = await setup();
  await waitFor(() => expect(result.current.hasData).toBe(true));
  await act(async () => {
    expect(await result.current.save(1, { progressStatus: 'completed' })).toBe(true);
  });
  await act(async () => {
    expect(await result.current.save(1, { excluded: true })).toBe(true);
  });
  expect(result.current.preferences.get(1)).toEqual({
    progressStatus: 'completed',
    excluded: true,
  });
  await act(async () => {
    expect(await result.current.undo()).toBe(true);
  });
  expect(result.current.preferences.get(1)).toEqual({
    progressStatus: 'completed',
    excluded: false,
  });
  expect(result.current.canUndo).toBe(false);
  expect(result.current.message).toBe('Изменение отменено');
  await dispose();
});

test('undoing exclusion restores eligibility and the previous explicit status', async () => {
  const { result, cache, dispose } = await setup();
  await waitFor(() => expect(result.current.hasData).toBe(true));
  await act(async () => {
    await result.current.save(1, { excluded: true });
  });
  expect(isBlockedByPreference(result.current.preferences.get(1))).toBe(true);
  await act(async () => {
    await result.current.undo();
  });
  expect(result.current.preferences.get(1)).toEqual({ progressStatus: 'playing', excluded: false });
  expect(isBlockedByPreference(result.current.preferences.get(1))).toBe(false);
  expect(cache.write).toHaveBeenLastCalledWith(A, result.current.preferences);
  await dispose();
});

test('write failure preserves the visible preference and never claims success', async () => {
  const { result, service, cache, dispose } = await setup();
  await waitFor(() => expect(result.current.hasData).toBe(true));
  jest.mocked(service.save).mockRejectedValueOnce(new Error('offline'));
  jest.mocked(cache.write).mockClear();
  await act(async () => {
    expect(await result.current.save(1, { excluded: true })).toBe(false);
  });
  expect(result.current.preferences.get(1)).toEqual({ progressStatus: 'playing', excluded: false });
  expect(result.current.message).toBeNull();
  expect(result.current.actionError).toContain('Не удалось');
  expect(result.current.canUndo).toBe(false);
  expect(cache.write).not.toHaveBeenCalled();
  await act(async () => {
    expect(await result.current.save(1, { excluded: true })).toBe(true);
  });
  expect(result.current.canUndo).toBe(true);
  await dispose();
});

test('offline cache preserves completion/exclusion; missing cache blocks availability', async () => {
  const cached = new Map<number, GamePreference>([
    [1, { progressStatus: 'completed', excluded: true }],
  ]);
  for (const snapshot of [cached, undefined]) {
    const { result, dispose } = await setup({ offline: true, cached: snapshot });
    await waitFor(() => expect(result.current.loadError).not.toBeNull());
    expect(result.current.isUnavailable).toBe(snapshot === undefined);
    if (snapshot) {
      expect(result.current.isFromCache).toBe(true);
      expect(isBlockedByPreference(result.current.preferences.get(1))).toBe(true);
    }
    await dispose();
  }
});

test('late mutation cannot repopulate the previous account cache or show an undo to the new account', async () => {
  const { result, client, service, cache, dispose } = await setup();
  await waitFor(() => expect(result.current.hasData).toBe(true));
  let finish!: (value: GamePreference) => void;
  jest.mocked(service.save).mockImplementationOnce(
    () =>
      new Promise((resolve) => {
        finish = resolve;
      }),
  );
  let pending!: Promise<boolean>;
  await act(async () => {
    pending = result.current.save(1, { excluded: true });
  });
  await waitFor(() => expect(service.save).toHaveBeenCalled());
  await act(async () => {
    useAuth.setState({ user: { steamId: B } });
    finish({ progressStatus: 'playing', excluded: true });
    expect(await pending).toBe(false);
  });
  expect(client.getQueryData(preferenceKeys.remote(A))).toBeUndefined();
  expect(
    jest
      .mocked(cache.write)
      .mock.calls.filter(([id, values]) => id === A && values.get(1)?.excluded),
  ).toHaveLength(0);
  expect(result.current.canUndo).toBe(false);
  expect(result.current.message).toBeNull();
  await dispose();
});

test('failed undo remains retryable without displaying a false cancellation', async () => {
  const { result, service, dispose } = await setup();
  await waitFor(() => expect(result.current.hasData).toBe(true));
  await act(async () => {
    await result.current.save(1, { excluded: true });
  });
  jest.mocked(service.save).mockRejectedValueOnce(new Error('offline'));
  await act(async () => {
    expect(await result.current.undo()).toBe(false);
  });
  expect(result.current.preferences.get(1)?.excluded).toBe(true);
  expect(result.current.canUndo).toBe(true);
  expect(result.current.message).toBeNull();
  await act(async () => {
    expect(await result.current.undo()).toBe(true);
  });
  expect(result.current.preferences.get(1)?.excluded).toBe(false);
  await dispose();
});
