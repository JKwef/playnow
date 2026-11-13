import { fireEvent, render, waitFor } from '@testing-library/react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import type { ReactNode } from 'react';

import { PickerScreen } from '@/features/picker/screens/PickerScreen';
import { useAuth } from '@/features/auth/hooks/useAuth';
import type { RootStackScreenProps } from '@/navigation/types';

import { makeGame } from './fixtures/game';

const mockBacklog = {
  games: [
    makeGame({ appid: 1, genres: ['action'] }),
    makeGame({ appid: 2, genres: ['action'] }),
    makeGame({ appid: 3, genres: ['puzzle'] }),
  ],
  status: 'ready',
  genresStatus: 'done',
  errorMessage: null,
  refresh: jest.fn(),
  isRefreshing: false,
};
const mockBlacklist = { postponed: new Map([[1, Date.now() + 86_400_000]]), isLoading: false };
const mockPreferences = {
  preferences: new Map(),
  isLoading: false,
  isUnavailable: false,
  isFromCache: false,
  loadError: null,
  isRefreshing: false,
  retry: jest.fn(),
};

jest.mock('@/features/backlog/hooks/useBacklog', () => ({ useBacklog: () => mockBacklog }));
jest.mock('@/features/picker/hooks/useBlacklist', () => ({ useBlacklist: () => mockBlacklist }));
jest.mock('@/features/backlog/hooks/useGamePreferences', () => ({
  useGamePreferences: () => mockPreferences,
}));
jest.mock('@/shared/components/Screen', () => ({
  Screen: ({ children, footer }: { children: ReactNode; footer: ReactNode }) => (
    <>
      {children}
      {footer}
    </>
  ),
}));

const renderPicker = async () => {
  const navigate = jest.fn();
  const props = {
    navigation: { navigate },
    route: { key: 'picker', name: 'Picker' },
  } as unknown as RootStackScreenProps<'Picker'>;
  const screen = await render(<PickerScreen {...props} />);
  await waitFor(() =>
    expect(screen.getByRole('radio', { name: 'Новое' }).props.accessibilityState.disabled).toBe(
      false,
    ),
  );
  return { ...screen, navigate };
};

beforeEach(async () => {
  useAuth.setState({ user: null, status: 'signedOut' });
  await AsyncStorage.clear();
  mockPreferences.preferences = new Map();
  useAuth.setState({ user: { steamId: '76561197960287930' }, status: 'signedIn' });
});
afterEach(() => useAuth.setState({ user: null, status: 'signedOut' }));

it('explicitly enables the installed-only filter and passes it to the result', async () => {
  const screen = await renderPicker();
  await fireEvent.press(screen.getByRole('checkbox', { name: 'Только отмеченные установленными' }));
  await waitFor(() =>
    expect(
      screen.getByRole('button', { name: 'Подобрать игру  →' }).props.accessibilityState.disabled,
    ).toBe(false),
  );
  await fireEvent.press(screen.getByRole('button', { name: 'Подобрать игру  →' }));
  expect(screen.navigate).toHaveBeenCalledWith(
    'Result',
    expect.objectContaining({ installedOnly: true }),
  );
});

it('selects a mood before navigating and counts only available games', async () => {
  const screen = await renderPicker();
  const action = screen.getByRole('radio', { name: /Больше драйва.*Доступно игр: 1/ });
  await fireEvent.press(action);
  expect(screen.navigate).not.toHaveBeenCalled();
  expect(action.props.accessibilityState.checked).toBe(true);
  await fireEvent.press(screen.getByRole('button', { name: 'Подобрать игру  →' }));
  expect(screen.navigate).toHaveBeenCalledWith('Result', {
    contextId: 'action',
    mode: 'new',
    genreFilter: 'context',
  });
});

it('preserves an empty context and opens its diagnosis instead of silently replacing it', async () => {
  const screen = await renderPicker();
  await fireEvent.press(screen.getByRole('radio', { name: /Погрузиться в мир/ }));
  expect(
    screen.getByRole('button', { name: 'Подобрать игру  →' }).props.accessibilityState.disabled,
  ).toBe(false);
  expect(screen.getByText(/Под выбранные условия пока нет игр/)).toBeTruthy();
  await fireEvent.press(screen.getByRole('button', { name: 'Подобрать игру  →' }));
  expect(screen.navigate).toHaveBeenCalledWith('Result', {
    contextId: 'story',
    mode: 'new',
    genreFilter: 'context',
  });
});

it('counts exclude completed and permanently excluded games without removing library records', async () => {
  mockPreferences.preferences = new Map([[2, { progressStatus: 'completed', excluded: false }]]);
  const screen = await renderPicker();
  expect(screen.getByRole('radio', { name: /Больше драйва.*Доступно игр: 0/ })).toBeTruthy();
  expect(mockBacklog.games).toHaveLength(3);
  mockPreferences.preferences = new Map();
});

it('restores the accepted choice on home; another pick does not overwrite it; missing games and account switch are safe', async () => {
  const stored = JSON.stringify({
    game: { appid: 3, name: 'Сохранённая игра' },
    contextId: 'short-session',
    mode: 'new',
    genreFilter: 'context',
    acceptedAt: '2026-11-13T12:00:00Z',
  });
  await AsyncStorage.setItem('playnow:acceptedChoice:v1:76561197960287930', stored);
  const screen = await renderPicker();
  await waitFor(() => expect(screen.getByText('Последний принятый выбор')).toBeTruthy());
  await fireEvent.press(screen.getByRole('button', { name: 'Подобрать другое' }));
  expect(screen.navigate).toHaveBeenCalledWith('Result', expect.objectContaining({ mode: 'new' }));
  expect(await AsyncStorage.getItem('playnow:acceptedChoice:v1:76561197960287930')).toBe(stored);
  const previousGames = mockBacklog.games;
  mockBacklog.games = [];
  await screen.rerender(
    <PickerScreen
      navigation={{ navigate: screen.navigate } as never}
      route={{ key: 'picker', name: 'Picker' }}
    />,
  );
  expect(screen.getByText(/Выбранной игры больше нет/)).toBeTruthy();
  expect(screen.queryByRole('button', { name: 'Открыть' })).toBeNull();
  useAuth.setState({ user: { steamId: 'B' }, status: 'signedIn' });
  await waitFor(() => expect(screen.queryByText('Последний принятый выбор')).toBeNull());
  mockBacklog.games = previousGames;
});
