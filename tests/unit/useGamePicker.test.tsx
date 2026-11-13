import { act, renderHook } from '@testing-library/react-native';

import { useGamePicker } from '@/features/picker/hooks/useGamePicker';
import { findContext } from '@/features/picker/utils/contexts';
import type { GamePreference } from '@/features/backlog/types/GamePreference';

import { makeGame } from './fixtures/game';

const game = makeGame({ genres: ['action'] });
const mockBacklog = {
  games: [game],
  status: 'ready',
  errorCode: null,
  errorMessage: null,
  isRefreshing: false,
  refresh: jest.fn(async () => undefined),
};
const mockBlacklist = {
  postponed: new Map<number, number>(),
  isLoading: false,
  errorMessage: null as string | null,
  retry: jest.fn(async () => undefined),
  postpone: jest.fn(async (_appid: number, _duration?: string) => undefined),
};
const mockPreferences = {
  preferences: new Map<number, GamePreference>(),
  isLoading: false,
  isUnavailable: false,
  isRefreshing: false,
  loadError: null as string | null,
  retry: jest.fn(async () => undefined),
};
jest.mock('@/features/backlog/hooks/useBacklog', () => ({ useBacklog: () => mockBacklog }));
jest.mock('@/features/backlog/hooks/useGamePreferences', () => ({
  useGamePreferences: () => mockPreferences,
}));
jest.mock('@/features/picker/hooks/useBlacklist', () => ({ useBlacklist: () => mockBlacklist }));

beforeEach(() => {
  jest.clearAllMocks();
  mockBlacklist.postponed = new Map();
  mockBlacklist.errorMessage = null;
  mockPreferences.preferences = new Map();
  mockPreferences.isLoading = false;
  mockPreferences.isUnavailable = false;
  mockPreferences.loadError = null;
});

test('failed postponement keeps the same game available and reports the failure', async () => {
  mockBlacklist.postpone.mockRejectedValueOnce(new Error('disk full'));
  const { result } = await renderHook(() => useGamePicker(findContext('action')!));
  await act(async () => {
    expect(await result.current.postpone('tomorrow')).toBe(false);
  });
  expect(result.current.game?.appid).toBe(game.appid);
  expect(result.current.status).toBe('ready');
  expect(result.current.postponedCount).toBe(0);
  expect(result.current.actionError).toContain('Не удалось');
});

test('completed and permanent exclusions filter results independently of playtime', async () => {
  for (const preference of [
    { progressStatus: 'completed', excluded: false },
    { progressStatus: 'playing', excluded: true },
  ] as const) {
    mockPreferences.preferences = new Map([[1, preference]]);
    const { result, unmount } = await renderHook(() => useGamePicker(findContext('action')!));
    expect(result.current.game).toBeNull();
    expect(result.current.status).toBe('empty');
    expect(result.current.excludedCount).toBe(1);
    expect(mockBacklog.games).toHaveLength(1);
    await unmount();
  }
});

test('unavailable preference or postponement data cannot silently bypass exclusions', async () => {
  mockPreferences.isUnavailable = true;
  mockPreferences.loadError = 'Статусы недоступны';
  const { result } = await renderHook(() => useGamePicker(findContext('action')!));
  expect(result.current.status).toBe('error');
  await act(async () => {
    await result.current.refresh();
  });
  expect(mockPreferences.retry).toHaveBeenCalledTimes(1);
  expect(mockBacklog.refresh).not.toHaveBeenCalled();
});
