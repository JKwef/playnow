import { fireEvent, render } from '@testing-library/react-native';
import type { ReactNode } from 'react';

import { PickerScreen } from '@/features/picker/screens/PickerScreen';
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

jest.mock('@/features/backlog/hooks/useBacklog', () => ({ useBacklog: () => mockBacklog }));
jest.mock('@/features/picker/hooks/useBlacklist', () => ({ useBlacklist: () => mockBlacklist }));
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
  return { ...(await render(<PickerScreen {...props} />)), navigate };
};

it('selects a mood before navigating and counts only available games', async () => {
  const screen = await renderPicker();
  const action = screen.getByRole('radio', { name: /Больше драйва.*Доступно игр: 1/ });
  await fireEvent.press(action);
  expect(screen.navigate).not.toHaveBeenCalled();
  expect(action.props.accessibilityState.checked).toBe(true);
  await fireEvent.press(screen.getByRole('button', { name: 'Подобрать игру  →' }));
  expect(screen.navigate).toHaveBeenCalledWith('Result', { contextId: 'action' });
});

it('disables selection submission when the chosen mood has no candidates', async () => {
  const screen = await renderPicker();
  await fireEvent.press(screen.getByRole('radio', { name: /Погрузиться в мир/ }));
  expect(
    screen.getByRole('button', { name: 'Подобрать игру  →' }).props.accessibilityState.disabled,
  ).toBe(true);
  expect(screen.getByText(/Пока нет подходящих игр/)).toBeTruthy();
  expect(screen.navigate).not.toHaveBeenCalled();
});
