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
  navigation: { navigate: jest.fn() },
  route: { name: 'Demo', key: 'demo' },
} as unknown as RootStackScreenProps<'Demo'>;

test('demo accepts and undoes a fictional choice without saving any account data', async () => {
  const storage = jest.mocked(AsyncStorage.setItem);
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
  expect(props.navigation.navigate).toHaveBeenCalledWith('Login');
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

test('swipe mode reviews each card once and returns to the regular demo', async () => {
  const screen = await render(<DemoScreen {...props} />);
  const toggle = screen.getByRole('checkbox', { name: 'Режим свайпа' });
  expect(toggle.props.accessibilityState.checked).toBe(false);
  await fireEvent.press(toggle);

  for (let number = 1; number <= 4; number++) {
    expect(await screen.findByText(`Карточка ${number} из 4`)).toBeTruthy();
    await fireEvent.press(
      screen.getByRole('button', { name: number === 1 ? 'Понравилась игра' : 'Пропустить игру' }),
    );
  }

  expect(await screen.findByText('Понравилось игр: 1 из 4')).toBeTruthy();
  await fireEvent.press(screen.getByRole('button', { name: 'Избранное (1)' }));
  await fireEvent.press(screen.getByRole('button', { name: /Подробнее о/ }));
  expect(screen.getByRole('button', { name: 'Посмотреть цену в Steam' })).toBeTruthy();
  await fireEvent.press(screen.getByRole('button', { name: /Удалить / }));
  expect(screen.getByText('Пока ничего не добавлено.')).toBeTruthy();
  await fireEvent.press(screen.getByRole('button', { name: 'Вернуться к карточкам' }));
  await fireEvent.press(screen.getByRole('button', { name: 'Перемешать и начать заново' }));
  expect(screen.getByText('Карточка 1 из 4')).toBeTruthy();
  await fireEvent.press(screen.getByRole('checkbox', { name: 'Режим свайпа' }));
  expect(screen.getByRole('button', { name: 'Подобрать примерную игру' })).toBeTruthy();
});

test('companion lets the user finish early and wait for other participants', async () => {
  const screen = await render(<DemoScreen {...props} />);
  await fireEvent.press(screen.getByRole('checkbox', { name: 'Режим свайпа' }));
  await fireEvent.press(screen.getByRole('tab', { name: 'Компаньон' }));
  const search = screen.getByLabelText('Поиск друга по нику');
  await fireEvent.changeText(search, ' mINT ');
  expect(screen.queryByRole('checkbox', { name: 'PixelFox' })).toBeNull();
  await fireEvent.press(screen.getByRole('checkbox', { name: 'MintKnight' }));
  await fireEvent.changeText(search, '');
  expect(screen.getByRole('checkbox', { name: 'MintKnight', checked: true })).toBeTruthy();
  await fireEvent.press(screen.getByRole('checkbox', { name: 'PixelFox' }));
  await fireEvent.press(screen.getByRole('button', { name: 'Начать совместный подбор' }));

  expect(screen.getByText('Карточка 1 из 2')).toBeTruthy();
  await fireEvent.press(screen.getByRole('button', { name: 'Понравилась игра' }));
  await screen.findByText('Карточка 2 из 2');
  await fireEvent.press(screen.getByRole('button', { name: 'Завершить голосование' }));
  expect(screen.getByLabelText('Ты сделал свой выбор, путник! Ждем остальных...')).toBeTruthy();
  expect(screen.queryByRole('button', { name: 'Понравилась игра' })).toBeNull();
  await fireEvent.press(screen.getByRole('button', { name: 'Добавить тестовый голос компаньона' }));
  const result = /Это взаимно! \([01]\)/;
  await fireEvent.press(screen.getByRole('button', { name: result }));
  expect(screen.getByRole('header', { name: result })).toBeTruthy();
  await fireEvent.press(screen.getByRole('button', { name: 'Назад к компаньону' }));
  await fireEvent.press(screen.getByRole('button', { name: 'Назад' }));
  expect(screen.getByText('Прошлые дружеские свайпы')).toBeTruthy();
  await fireEvent.press(screen.getByRole('checkbox', { name: /Отметить сессию/ }));
  await fireEvent.press(screen.getByRole('button', { name: /Удалить отмеченные сессии/ }));
  expect(screen.getByText('Завершённых голосований пока нет.')).toBeTruthy();
});

test('a demo companion room resumes at the next card after leaving and reopening', async () => {
  const first = await render(<DemoScreen {...props} />);
  await fireEvent.press(first.getByRole('checkbox', { name: 'Режим свайпа' }));
  await fireEvent.press(first.getByRole('tab', { name: 'Компаньон' }));
  await fireEvent.press(first.getByRole('checkbox', { name: 'MintKnight' }));
  await fireEvent.press(first.getByRole('button', { name: 'Начать совместный подбор' }));
  await fireEvent.press(first.getByRole('button', { name: 'Понравилась игра' }));
  await first.findByText('Карточка 2 из 2');
  await fireEvent.press(first.getByRole('button', { name: 'Назад' }));
  expect(first.getByRole('tab', { name: 'Оконченные', selected: true })).toBeTruthy();
  expect(first.queryByRole('button', { name: 'Продолжить · MintKnight' })).toBeNull();
  await fireEvent.press(first.getByRole('tab', { name: 'Неоконченные' }));
  expect(first.getByRole('tab', { name: 'Неоконченные', selected: true })).toBeTruthy();
  expect(first.getByRole('button', { name: 'Продолжить · MintKnight' })).toBeTruthy();
  await fireEvent.press(first.getByRole('tab', { name: 'Оконченные' }));
  expect(first.queryByRole('button', { name: 'Продолжить · MintKnight' })).toBeNull();
  await fireEvent.press(first.getByRole('checkbox', { name: 'MintKnight' }));
  await fireEvent.press(first.getByRole('checkbox', { name: 'PixelFox' }));
  await fireEvent.press(first.getByRole('button', { name: 'Начать совместный подбор' }));
  expect(first.getByText('Карточка 1 из 2')).toBeTruthy();
  await fireEvent.press(first.getByRole('button', { name: 'Назад' }));
  await first.unmount();

  const second = await render(<DemoScreen {...props} />);
  await fireEvent.press(second.getByRole('checkbox', { name: 'Режим свайпа' }));
  await fireEvent.press(second.getByRole('tab', { name: 'Компаньон' }));
  await fireEvent.press(second.getByRole('tab', { name: 'Неоконченные' }));
  await fireEvent.press(await second.findByRole('button', { name: 'Продолжить · MintKnight' }));
  expect(second.getByText('Карточка 2 из 2')).toBeTruthy();
  await AsyncStorage.removeItem('quaeso:demo-companion-room');
});
