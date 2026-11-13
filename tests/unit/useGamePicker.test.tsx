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
  genresStatus: 'done',
  retryGenres: jest.fn(async () => undefined),
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
  mockBacklog.games = [game];
  mockBacklog.genresStatus = 'done';
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

test('a series uses the best unseen tier first, never repeats, and waits for explicit restart', async () => {
  mockBacklog.games = [
    makeGame({ appid: 1, genres: ['action'], playtimeMinutes: 500 }),
    makeGame({ appid: 2, genres: ['action'], playtimeMinutes: 900 }),
    makeGame({ appid: 3, genres: ['action'] }),
  ];
  mockPreferences.preferences = new Map([
    [1, { progressStatus: 'not_started', excluded: false }],
    [2, { progressStatus: 'not_started', excluded: false }],
  ]);
  const { result } = await renderHook(() => useGamePicker(findContext('action')!));
  const shown: number[] = [];
  for (let index = 0; index < 3; index++) {
    const appid = result.current.game!.appid;
    if (index < 2) expect([1, 2]).toContain(appid);
    else expect(appid).toBe(3);
    shown.push(appid);
    if (index < 2)
      await act(async () => {
        result.current.next();
      });
  }
  expect(new Set(shown).size).toBe(3);
  expect(result.current.isSeriesExhausted).toBe(true);
  await act(async () => {
    result.current.next();
  });
  expect(result.current.game?.appid).toBe(3);
  await act(async () => {
    result.current.restart();
  });
  expect([1, 2]).toContain(result.current.game?.appid);
  expect(result.current.isSeriesExhausted).toBe(false);
});

test('metadata updates retain a result, record replacements, and do not repeat displayed games', async () => {
  mockBacklog.games = [
    makeGame({ appid: 1, genres: ['action'] }),
    makeGame({ appid: 2, genres: ['action'] }),
  ];
  const { result, rerender } = await renderHook(() => useGamePicker(findContext('action')!));
  const first = result.current.game!.appid;
  mockBacklog.games = mockBacklog.games.map((item) => ({
    ...item,
    coverUrl: 'https://example.com/cover.jpg',
  }));
  await rerender(undefined);
  expect(result.current.game?.appid).toBe(first);
  mockBacklog.games = [
    ...mockBacklog.games,
    makeGame({ appid: 3, genres: ['action'], playtimeMinutes: 60 }),
  ];
  mockPreferences.preferences = new Map([[3, { progressStatus: 'not_started', excluded: false }]]);
  await rerender(undefined);
  expect(result.current.game?.appid).toBe(3);
  await act(async () => {
    result.current.next();
  });
  expect(result.current.game?.appid).not.toBe(first);
  expect(result.current.game?.appid).not.toBe(3);
});

test('loading states do not consume unseen candidates and mode changes start a scoped series', async () => {
  mockBacklog.games = [
    makeGame({ appid: 1, genres: ['action'] }),
    makeGame({ appid: 2, genres: ['action'], playtimeMinutes: 70 }),
  ];
  mockPreferences.isLoading = true;
  mockPreferences.preferences = new Map([
    [1, { progressStatus: 'playing', excluded: false }],
    [2, { progressStatus: 'not_started', excluded: false }],
  ]);
  const { result, rerender } = await renderHook(
    ({ mode }: { mode: 'new' | 'continue' }) => useGamePicker(findContext('action')!, { mode }),
    { initialProps: { mode: 'new' } },
  );
  expect(result.current.game).toBeNull();
  mockPreferences.isLoading = false;
  await rerender({ mode: 'new' });
  expect(result.current.game?.appid).toBe(2);
  await rerender({ mode: 'continue' });
  expect(result.current.game?.appid).toBe(1);
  expect(result.current.reasons.join(' ')).toContain('Играю');
});

test('explicit genre relaxation preserves exclusions and retries only metadata', async () => {
  mockBacklog.games = [
    makeGame({ appid: 1, genres: [] }),
    makeGame({ appid: 2, genres: [] }),
    makeGame({ appid: 3, genres: [] }),
  ];
  mockBacklog.genresStatus = 'partial';
  mockPreferences.preferences = new Map([
    [1, { progressStatus: 'completed', excluded: false }],
    [2, { progressStatus: 'not_started', excluded: true }],
  ]);
  const { result, rerender } = await renderHook(
    ({ relaxed }: { relaxed: boolean }) =>
      useGamePicker(findContext('action')!, { ignoreGenres: relaxed }),
    { initialProps: { relaxed: false } },
  );
  expect(result.current.status).toBe('empty');
  expect(result.current.canRelaxGenres).toBe(true);
  await act(async () => {
    await result.current.retryMetadata();
  });
  expect(mockBacklog.retryGenres).toHaveBeenCalled();
  expect(mockBacklog.refresh).not.toHaveBeenCalled();
  await rerender({ relaxed: true });
  expect(result.current.game?.appid).toBe(3);
  expect(result.current.reasons.join(' ')).toContain('Фильтр жанров отключён');
});
