import { fireEvent, render } from '@testing-library/react-native';
import * as Linking from 'expo-linking';

import { BacklogStatusNotice } from '@/features/backlog/components/BacklogStatusNotice';
import type { UseBacklogResult } from '@/features/backlog/hooks/useBacklog';
import { STEAM_PRIVACY_SETTINGS_URL } from '@/features/backlog/services/backlogErrors';

import { makeGame } from './fixtures/game';

jest.mock('expo-linking', () => ({ openURL: jest.fn(async () => undefined) }));

const backlog = (extra: Partial<UseBacklogResult> = {}): UseBacklogResult => ({
  games: [makeGame()],
  status: 'ready',
  genresStatus: 'partial',
  genresRemaining: 5,
  errorCode: null,
  errorMessage: null,
  isFromCache: false,
  isRefreshing: false,
  updatedAt: '2026-11-13T10:00:00Z',
  refresh: jest.fn(async () => undefined),
  retryGenres: jest.fn(async () => undefined),
  ...extra,
});

test('partial metadata explains unfinished work and retries metadata without reimporting', async () => {
  const data = backlog();
  const screen = await render(<BacklogStatusNotice backlog={data} />);
  expect(screen.getByText(/Осталось игр: 5/)).toBeTruthy();
  await fireEvent.press(screen.getByRole('button', { name: 'Продолжить загрузку жанров' }));
  expect(data.retryGenres).toHaveBeenCalledTimes(1);
  expect(data.refresh).not.toHaveBeenCalled();
});

test('RAWG error is shown as metadata failure, not empty Steam library', async () => {
  const screen = await render(<BacklogStatusNotice backlog={backlog({ genresStatus: 'error' })} />);
  expect(screen.getByText(/Не удалось загрузить метаданные/)).toBeTruthy();
  expect(screen.getByText(/Игры остаются в библиотеке/)).toBeTruthy();
  expect(screen.queryByText('В библиотеке пока нет игр')).toBeNull();
});

test('private profile with dated cache has privacy instructions, settings link and import retry', async () => {
  const data = backlog({
    isFromCache: true,
    errorCode: 'private_profile',
    errorMessage: 'Игровые данные Steam скрыты',
  });
  const screen = await render(<BacklogStatusNotice backlog={data} />);
  expect(screen.getByText(/Показана сохранённая библиотека/)).toBeTruthy();
  expect(screen.getByText(/Игровая информация/)).toBeTruthy();
  await fireEvent.press(screen.getByRole('button', { name: 'Открыть настройки приватности' }));
  expect(Linking.openURL).toHaveBeenCalledWith(STEAM_PRIVACY_SETTINGS_URL);
  await fireEvent.press(screen.getByRole('button', { name: 'Повторить' }));
  expect(data.refresh).toHaveBeenCalledTimes(1);
});

test('completed processing with unidentified genres offers manual correction guidance', async () => {
  const screen = await render(
    <BacklogStatusNotice backlog={backlog({ genresStatus: 'done', genresRemaining: 0 })} />,
  );
  expect(screen.getByText(/Жанры не распознаны у 1 игр/)).toBeTruthy();
  expect(screen.queryByRole('button', { name: 'Продолжить загрузку жанров' })).toBeNull();
});
