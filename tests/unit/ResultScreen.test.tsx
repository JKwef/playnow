import { fireEvent, render } from '@testing-library/react-native';
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
};
const mockRestore = jest.fn(async (_appid: number) => undefined);
jest.mock('@/features/picker/hooks/useGamePicker', () => ({ useGamePicker: () => mockPicker }));
jest.mock('@/features/picker/hooks/useBlacklist', () => ({
  useBlacklist: () => ({ restore: mockRestore }),
}));
jest.mock('@/features/auth/hooks/useAuth', () => ({
  useAuth: (select: (state: unknown) => unknown) =>
    select({ user: { steamId: 'A' }, signOut: jest.fn() }),
}));
jest.mock('@/features/launch/hooks/useLaunchGame', () => ({
  useLaunchGame: () => ({ launch: jest.fn(), isLaunching: false }),
}));
jest.mock('@/shared/components/Screen', () => ({
  Screen: ({ children }: { children: ReactNode }) => children,
}));

const props = {
  route: { params: { contextId: 'action' } },
  navigation: { goBack: jest.fn(), navigate: jest.fn() },
} as unknown as RootStackScreenProps<'Result'>;
beforeEach(() => {
  jest.clearAllMocks();
  mockPicker.status = 'ready';
  mockPicker.game = mockGame;
  mockPicker.postponedCount = 0;
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
