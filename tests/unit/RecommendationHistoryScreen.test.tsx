import { fireEvent, render } from '@testing-library/react-native';
import type { ReactNode } from 'react';
import { RecommendationHistoryScreen } from '@/features/picker/screens/RecommendationHistoryScreen';
import type { RootStackScreenProps } from '@/navigation/types';
import type { Game } from '@/features/backlog/types/Game';
import type { GamePreferences } from '@/features/backlog/types/GamePreference';
import type { Recommendation } from '@/features/picker/services/recommendationHistory';
import { makeGame } from './fixtures/game';

const mockHistory = {
  entries: [
    {
      game: { appid: 620, name: 'Portal 2' },
      contextId: 'short-session',
      mode: 'new',
      genreFilter: 'context',
      shownAt: '2026-11-13T12:00:00Z',
    },
  ] as Recommendation[],
  isReady: true,
  isSaving: false,
  error: null,
  retry: jest.fn(),
  clear: jest.fn(async () => true),
  setRefusal: jest.fn(async () => true),
};
const mockBacklog = {
  games: [makeGame({ appid: 620, name: 'Portal 2', genres: ['puzzle'] })] as Game[] | undefined,
  refresh: jest.fn(),
};
const mockPreferences = {
  preferences: new Map() as GamePreferences,
  isLoading: false,
  isUnavailable: false,
  retry: jest.fn(),
};
const mockBlacklist = {
  postponed: new Map(),
  isLoading: false,
  errorMessage: null,
  retry: jest.fn(),
};
const mockAccepted = {
  accept: jest.fn(),
  choice: null,
  isReady: true,
  isSaving: false,
  canUndo: false,
  error: null,
};
const mockInstalled = { marked: new Set<number>(), isReady: true, retry: jest.fn() };
jest.mock('@/features/backlog/hooks/useInstalledGames', () => ({
  useInstalledGames: () => mockInstalled,
}));
const mockConfirm = jest.fn(async () => true);
jest.mock('@/features/picker/hooks/useRecommendationHistory', () => ({
  useRecommendationHistory: () => mockHistory,
}));
jest.mock('@/features/backlog/hooks/useBacklog', () => ({ useBacklog: () => mockBacklog }));
jest.mock('@/features/backlog/hooks/useGamePreferences', () => ({
  useGamePreferences: () => mockPreferences,
}));
jest.mock('@/features/picker/hooks/useBlacklist', () => ({ useBlacklist: () => mockBlacklist }));
jest.mock('@/features/picker/hooks/useAcceptedChoice', () => ({
  useAcceptedChoice: () => mockAccepted,
}));
jest.mock('@/shared/utils/confirm', () => ({ confirmAction: () => mockConfirm() }));
jest.mock('@/shared/components/Screen', () => ({
  Screen: ({ children }: { children: ReactNode }) => children,
}));
const props = {
  navigation: { navigate: jest.fn(), popTo: jest.fn() },
} as unknown as RootStackScreenProps<'RecommendationHistory'>;
beforeEach(() => {
  jest.clearAllMocks();
  mockHistory.entries.forEach((entry) => {
    delete entry.refusal;
    delete entry.installedOnly;
  });
  mockInstalled.marked = new Set();
  mockInstalled.isReady = true;
  mockBacklog.games = [makeGame({ appid: 620, name: 'Portal 2', genres: ['puzzle'] })];
  mockPreferences.preferences = new Map();
  mockBlacklist.postponed = new Map();
  mockConfirm.mockResolvedValue(true);
});

test('history rechecks installation marks and preserves the original installed-only criteria when accepted', async () => {
  mockHistory.entries[0]!.installedOnly = true;
  const screen = await render(<RecommendationHistoryScreen {...props} />);
  await fireEvent.press(screen.getByRole('button', { name: 'Открыть рекомендацию Portal 2' }));
  await fireEvent.press(screen.getByRole('button', { name: 'Выбираю эту игру из истории' }));
  expect(mockAccepted.accept).not.toHaveBeenCalled();
  mockInstalled.marked = new Set([620]);
  await screen.rerender(<RecommendationHistoryScreen {...props} />);
  await fireEvent.press(screen.getByRole('button', { name: 'Выбираю эту игру из истории' }));
  expect(mockAccepted.accept).toHaveBeenCalledWith(
    expect.objectContaining({ installedOnly: true }),
  );
});

test('saved refusal is visible after reopening history and can be removed without accepting the game', async () => {
  mockHistory.entries[0]!.refusal = { reason: 'already_played', savedAt: '2026-11-13T12:01:00Z' };
  const screen = await render(<RecommendationHistoryScreen {...props} />);
  expect(screen.getByText(/Последняя причина отказа: Уже проходил/)).toBeTruthy();
  await fireEvent.press(screen.getByRole('button', { name: 'Открыть рекомендацию Portal 2' }));
  await fireEvent.press(screen.getByRole('button', { name: 'Удалить причину отказа' }));
  expect(mockHistory.setRefusal).toHaveBeenCalledWith('620:short-session:new:context', null);
  expect(mockAccepted.accept).not.toHaveBeenCalled();
});

test('browsing does not accept; explicit acceptance restores the saved criteria', async () => {
  const screen = await render(<RecommendationHistoryScreen {...props} />);
  await fireEvent.press(screen.getByRole('button', { name: 'Открыть рекомендацию Portal 2' }));
  expect(mockAccepted.accept).not.toHaveBeenCalled();
  await fireEvent.press(screen.getByRole('button', { name: 'Выбираю эту игру из истории' }));
  expect(mockAccepted.accept).toHaveBeenCalledWith({
    game: { appid: 620, name: 'Portal 2' },
    contextId: 'short-session',
    mode: 'new',
    genreFilter: 'context',
  });
  await fireEvent.press(screen.getByRole('button', { name: 'Карточка в библиотеке' }));
  expect(props.navigation.navigate).toHaveBeenCalledWith('GameDetails', { appid: 620 });
});

test.each(['completed', 'excluded', 'postponed', 'missing', 'unavailable'] as const)(
  'cannot accept stale history when %s',
  async (condition) => {
    if (condition === 'completed')
      mockPreferences.preferences = new Map([
        [620, { progressStatus: 'completed', excluded: false }],
      ]);
    if (condition === 'excluded')
      mockPreferences.preferences = new Map([
        [620, { progressStatus: 'unspecified', excluded: true }],
      ]);
    if (condition === 'postponed')
      mockBlacklist.postponed = new Map([[620, Date.now() + 86400000]]);
    if (condition === 'missing') mockBacklog.games = [];
    if (condition === 'unavailable') mockBacklog.games = undefined;
    const screen = await render(<RecommendationHistoryScreen {...props} />);
    await fireEvent.press(screen.getByRole('button', { name: 'Открыть рекомендацию Portal 2' }));
    await fireEvent.press(screen.getByRole('button', { name: 'Выбираю эту игру из истории' }));
    expect(mockAccepted.accept).not.toHaveBeenCalled();
    if (condition === 'missing') expect(screen.getByText(/Игры больше нет/)).toBeTruthy();
    if (condition === 'unavailable')
      expect(screen.getByText(/Пока не удалось проверить/)).toBeTruthy();
  },
);

test('cancelled clearing preserves history; confirmed clearing never clears accepted choice', async () => {
  const screen = await render(<RecommendationHistoryScreen {...props} />);
  mockConfirm.mockResolvedValueOnce(false);
  await fireEvent.press(screen.getByRole('button', { name: 'Очистить историю рекомендаций' }));
  expect(mockHistory.clear).not.toHaveBeenCalled();
  await fireEvent.press(screen.getByRole('button', { name: 'Очистить историю рекомендаций' }));
  expect(mockHistory.clear).toHaveBeenCalledTimes(1);
  expect(mockAccepted.accept).not.toHaveBeenCalled();
});
