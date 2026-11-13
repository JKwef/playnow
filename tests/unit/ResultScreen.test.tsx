import AsyncStorage from '@react-native-async-storage/async-storage';
import { Linking } from 'react-native';
import { useAuth } from '@/features/auth/hooks/useAuth';
import { fireEvent, render, waitFor } from '@testing-library/react-native';
import type { ReactNode } from 'react';

import { ResultScreen } from '@/features/picker/screens/ResultScreen';
import type { RootStackScreenProps } from '@/navigation/types';
import { makeGame } from './fixtures/game';

const mockGame = makeGame({ name: 'Последняя игра', genres: ['action'] });
const mockPicker = {
  status: 'ready',
  game: mockGame as typeof mockGame | null,
  postponedCount: 0,
  excludedCount: 0,
  next: jest.fn(),
  postpone: jest.fn(async (_duration: string) => true),
  isLastOption: true,
  actionError: null,
  errorCode: null,
  errorMessage: null,
  isRetrying: false,
  refresh: jest.fn(),
  reasons: ['Выбрана по указанным условиям'],
  isSeriesExhausted: false,
  restart: jest.fn(),
  emptyReason: 'Нет игр под выбранные условия',
  canRelaxGenres: false,
  metadataIncomplete: false,
  retryMetadata: jest.fn(),
  isRetryingMetadata: false,
};
const mockRestore = jest.fn(async (_appid: number) => undefined);
jest.mock('@/features/picker/hooks/useGamePicker', () => ({ useGamePicker: () => mockPicker }));
jest.mock('@/features/picker/hooks/useBlacklist', () => ({
  useBlacklist: () => ({ restore: mockRestore }),
}));
jest.mock('@/shared/components/Screen', () => ({
  Screen: ({ children }: { children: ReactNode }) => children,
}));

const props = {
  route: { params: { contextId: 'action' } },
  navigation: { goBack: jest.fn(), navigate: jest.fn(), replace: jest.fn() },
} as unknown as RootStackScreenProps<'Result'>;
beforeEach(async () => {
  useAuth.setState({ user: null, status: 'signedOut' });
  await AsyncStorage.clear();
  useAuth.setState({ user: { steamId: 'A' }, status: 'signedIn' });
  jest.clearAllMocks();
  mockPicker.status = 'ready';
  mockPicker.game = mockGame;
  mockPicker.postponedCount = 0;
  mockPicker.isSeriesExhausted = false;
  mockPicker.canRelaxGenres = false;
  mockPicker.metadataIncomplete = false;
  mockPicker.postpone.mockImplementation(async () => {
    mockPicker.status = 'empty';
    mockPicker.game = null;
    mockPicker.postponedCount = 1;
    return true;
  });
  mockRestore.mockImplementation(async () => {
    mockPicker.status = 'ready';
    mockPicker.game = mockGame;
  });
});

test('postponing the last candidate still shows confirmation and undo on the empty result', async () => {
  const screen = await render(<ResultScreen {...props} />);
  await fireEvent.press(screen.getByRole('button', { name: 'До завтра' }));
  expect(mockPicker.postpone).toHaveBeenCalledWith('tomorrow');
  expect(screen.getByText(/«Последняя игра» отложена/)).toBeTruthy();
  await fireEvent.press(screen.getByRole('button', { name: 'Отменить откладывание' }));
  expect(mockRestore).toHaveBeenCalledWith(mockGame.appid);
  expect(screen.queryByText(/«Последняя игра» отложена/)).toBeNull();
  expect(screen.getByRole('button', { name: 'На неделю' })).toBeTruthy();
});

test('failed undo stays visible and can be retried', async () => {
  const screen = await render(<ResultScreen {...props} />);
  await fireEvent.press(screen.getByRole('button', { name: 'На неделю' }));
  mockRestore.mockRejectedValueOnce(new Error('disk full'));
  await fireEvent.press(screen.getByRole('button', { name: 'Отменить откладывание' }));
  expect(screen.getByText(/Не удалось отменить/)).toBeTruthy();
  expect(screen.getByRole('button', { name: 'Отменить откладывание' })).toBeTruthy();
  await fireEvent.press(screen.getByRole('button', { name: 'Отменить откладывание' }));
  expect(screen.queryByText(/«Последняя игра» отложена/)).toBeNull();
});

test('the last result announces series exhaustion before a user starts the next round', async () => {
  mockPicker.isSeriesExhausted = true;
  const screen = await render(<ResultScreen {...props} />);
  expect(screen.getByText(/Новый круг начнётся только по нажатию/)).toBeTruthy();
  expect(mockPicker.restart).not.toHaveBeenCalled();
  await fireEvent.press(screen.getByRole('button', { name: 'Начать новый круг' }));
  expect(mockPicker.restart).toHaveBeenCalledTimes(1);
  expect(mockPicker.next).not.toHaveBeenCalled();
});

test('empty-result actions retry metadata, open the library, and relax genres explicitly without changing mode', async () => {
  mockPicker.status = 'empty';
  mockPicker.game = null;
  mockPicker.metadataIncomplete = true;
  mockPicker.canRelaxGenres = true;
  const screen = await render(
    <ResultScreen
      {...props}
      route={{
        ...props.route,
        params: { contextId: 'action', mode: 'continue', genreFilter: 'context' },
      }}
    />,
  );
  await fireEvent.press(screen.getByRole('button', { name: 'Повторить загрузку метаданных' }));
  expect(mockPicker.retryMetadata).toHaveBeenCalledTimes(1);
  expect(mockPicker.refresh).not.toHaveBeenCalled();
  await fireEvent.press(
    screen.getByRole('button', { name: 'Проверить статусы и исключения в библиотеке' }),
  );
  expect(props.navigation.navigate).toHaveBeenCalledWith('Backlog');
  await fireEvent.press(screen.getByRole('button', { name: 'Любая игра без фильтра жанров' }));
  expect(props.navigation.replace).toHaveBeenCalledWith('Result', {
    contextId: 'action',
    mode: 'continue',
    genreFilter: 'any',
  });
});

test('invalid deep-link conditions are rejected instead of silently choosing another mode', async () => {
  const screen = await render(
    <ResultScreen
      {...props}
      route={{ ...props.route, params: { contextId: 'action', mode: 'invalid' as never } }}
    />,
  );
  expect(screen.getByText('Неизвестные условия подбора')).toBeTruthy();
});

afterEach(() => useAuth.setState({ user: null, status: 'signedOut' }));

test('acceptance persists separately from browsing and undo restores the previous choice', async () => {
  const screen = await render(<ResultScreen {...props} />);
  await waitFor(() =>
    expect(
      screen.getByRole('button', { name: 'Выбираю эту игру' }).props.accessibilityState.disabled,
    ).toBe(false),
  );
  expect(await AsyncStorage.getItem('playnow:acceptedChoice:v1:A')).toBeNull();
  await fireEvent.press(screen.getByRole('button', { name: 'Выбираю эту игру' }));
  const stored = await AsyncStorage.getItem('playnow:acceptedChoice:v1:A');
  expect(JSON.parse(stored!).game.name).toBe('Последняя игра');
  const open = jest.spyOn(Linking, 'openURL').mockRejectedValueOnce(new Error('Cannot open'));
  await fireEvent.press(screen.getByRole('button', { name: 'Открыть страницу Steam' }));
  expect(screen.getByText(/Не удалось открыть ссылку/)).toBeTruthy();
  expect(screen.getByRole('button', { name: 'Скопировать ссылку' })).toBeTruthy();
  expect(await AsyncStorage.getItem('playnow:acceptedChoice:v1:A')).toBe(stored);
  open.mockRestore();
  mockPicker.game = makeGame({ appid: 42, name: 'Другая рекомендация', genres: ['action'] });
  await screen.rerender(<ResultScreen {...props} />);
  await fireEvent.press(screen.getByRole('button', { name: 'Показать другую игру' }));
  expect(await AsyncStorage.getItem('playnow:acceptedChoice:v1:A')).toBe(stored);
  await fireEvent.press(screen.getByRole('button', { name: 'Выбираю эту игру' }));
  expect(JSON.parse((await AsyncStorage.getItem('playnow:acceptedChoice:v1:A'))!).game.appid).toBe(
    42,
  );
  await fireEvent.press(screen.getByRole('button', { name: 'Отменить принятие выбора' }));
  expect(await AsyncStorage.getItem('playnow:acceptedChoice:v1:A')).toBe(stored);
});
