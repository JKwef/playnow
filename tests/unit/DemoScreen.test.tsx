import { fireEvent, render } from '@testing-library/react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import type { ReactNode } from 'react';
import { DemoScreen } from '@/features/demo/screens/DemoScreen';
import type { RootStackScreenProps } from '@/navigation/types';

jest.mock('@/shared/components/Screen', () => ({
  Screen: ({ children, footer }: { children: ReactNode; footer: ReactNode }) => (
    <>
      {children}
      {footer}
    </>
  ),
}));

const props = {
  navigation: { goBack: jest.fn() },
  route: { name: 'Demo', key: 'demo' },
} as unknown as RootStackScreenProps<'Demo'>;

test('demo accepts and undoes a fictional choice without saving any account data', async () => {
  const storage = jest.spyOn(AsyncStorage, 'setItem');
  storage.mockClear();
  const screen = await render(<DemoScreen {...props} />);
  expect(screen.getByText(/8 вымышленных игр/)).toBeTruthy();
  await fireEvent.press(screen.getByRole('button', { name: 'Подобрать примерную игру' }));
  await fireEvent.press(screen.getByRole('button', { name: 'Выбираю эту примерную игру' }));
  expect(screen.getByText(/Примерный выбор принят только в демо/)).toBeTruthy();
  await fireEvent.press(screen.getByRole('button', { name: 'Отменить примерный выбор' }));
  expect(screen.queryByText(/Примерный выбор принят только в демо/)).toBeNull();
  expect(storage).not.toHaveBeenCalled();
  await fireEvent.press(screen.getByRole('button', { name: 'Вернуться ко входу в Steam' }));
  expect(props.navigation.goBack).toHaveBeenCalledTimes(1);
  storage.mockRestore();
});

test('mode change clears the example result and exhausted series needs an explicit restart', async () => {
  const random = jest.spyOn(Math, 'random').mockReturnValue(0);
  const screen = await render(<DemoScreen {...props} />);
  await fireEvent.press(screen.getByRole('button', { name: 'Подобрать примерную игру' }));
  expect(screen.getByText('Лабиринт')).toBeTruthy();
  await fireEvent.press(screen.getByRole('button', { name: 'Другая примерная игра' }));
  expect(screen.getByText(/Примерная серия закончилась/)).toBeTruthy();
  await fireEvent.press(screen.getByRole('button', { name: 'Новый примерный круг' }));
  expect(screen.queryByText('Лабиринт')).toBeNull();
  await fireEvent.press(screen.getByRole('button', { name: 'Продолжить' }));
  await fireEvent.press(screen.getByRole('button', { name: 'Подобрать примерную игру' }));
  expect(screen.getByText('Лабиринт: продолжение')).toBeTruthy();
  await fireEvent.press(screen.getByRole('radio', { name: /Больше драйва/ }));
  expect(screen.queryByText('Лабиринт: продолжение')).toBeNull();
  random.mockRestore();
});
