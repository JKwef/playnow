import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { act, renderHook } from '@testing-library/react-native';
import type { ReactNode } from 'react';
import { AppState, type AppStateStatus } from 'react-native';

import { useAuth } from '@/features/auth/hooks/useAuth';
import { blacklistKey, useBlacklist } from '@/features/picker/hooks/useBlacklist';
import type { BlacklistService } from '@/features/picker/services/blacklist';

const A = '76561197960287930';
const setup = async () => {
  useAuth.setState({ user: { steamId: A }, status: 'signedIn' });
  const client = new QueryClient({ defaultOptions: { queries: { gcTime: Infinity } } });
  client.setQueryData(
    blacklistKey(A),
    new Map([
      [1, Date.now() + 1000],
      [2, Date.now() + 2000],
    ]),
  );
  let onStateChange!: (state: AppStateStatus) => void;
  const remove = jest.fn();
  jest.spyOn(AppState, 'addEventListener').mockImplementation((_event, listener) => {
    onStateChange = listener;
    return { remove };
  });
  const service: BlacklistService = {
    read: jest.fn(async () => new Map()),
    add: jest.fn(async () => new Map()),
    remove: jest.fn(async () => new Map()),
    clear: jest.fn(async () => undefined),
  };
  const wrapper = ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={client}>{children}</QueryClientProvider>
  );
  const hook = await renderHook(() => useBlacklist(service), { wrapper });
  return { ...hook, client, remove, foreground: () => onStateChange('active') };
};
beforeEach(() => {
  jest.useFakeTimers();
  jest.setSystemTime(new Date('2026-11-13T10:00:00Z'));
});
afterEach(() => {
  jest.restoreAllMocks();
  jest.useRealTimers();
  useAuth.setState({ user: null, status: 'signedOut' });
});

test('expired postponements disappear while the app stays open without a restart', async () => {
  const { result, client, unmount, remove } = await setup();
  await act(async () => {
    await jest.advanceTimersByTimeAsync(1001);
  });
  expect(result.current.postponed.has(1)).toBe(false);
  expect(result.current.postponed.has(2)).toBe(true);
  await act(async () => {
    await jest.advanceTimersByTimeAsync(1001);
  });
  expect(result.current.postponed.size).toBe(0);
  await unmount();
  client.clear();
  expect(remove).toHaveBeenCalled();
});

test('returning from the background prunes expirations immediately even if timers did not run', async () => {
  const { result, client, unmount, foreground } = await setup();
  jest.setSystemTime(new Date('2026-11-13T10:00:05Z'));
  await act(async () => {
    foreground();
    await jest.advanceTimersByTimeAsync(0);
  });
  expect(result.current.postponed.size).toBe(0);
  await unmount();
  client.clear();
});
