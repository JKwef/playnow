import { fireEvent, render } from '@testing-library/react-native';
import { Linking, Platform } from 'react-native';
import * as Clipboard from 'expo-clipboard';
import { SteamActions } from '@/features/launch/components/SteamActions';
import { isDesktopBrowser, createSteamLauncher } from '@/features/launch/services/steamLauncher';

jest.mock('expo-clipboard', () => ({ setStringAsync: jest.fn(async () => true) }));
beforeEach(() => jest.restoreAllMocks());

test('phone opens HTTPS and copy is a separate action; success never claims gameplay', async () => {
  const open = jest.spyOn(Linking, 'openURL').mockResolvedValue(undefined);
  const screen = await render(<SteamActions appid={620} />);
  await fireEvent.press(screen.getByRole('button', { name: 'Открыть страницу Steam' }));
  expect(open).toHaveBeenCalledWith('https://store.steampowered.com/app/620/');
  expect(screen.getByText(/Фактический запуск игры не проверяется/)).toBeTruthy();
  await fireEvent.press(screen.getByRole('button', { name: 'Скопировать ссылку' }));
  expect(Clipboard.setStringAsync).toHaveBeenCalledWith('https://store.steampowered.com/app/620/');
  expect(screen.getByText('Ссылка скопирована.')).toBeTruthy();
});

test('open failure leaves copy and selectable URL; failed copy does not report success', async () => {
  jest.spyOn(Linking, 'openURL').mockRejectedValue(new Error('unknown failure'));
  const screen = await render(<SteamActions appid={620} />);
  await fireEvent.press(screen.getByRole('button', { name: 'Открыть страницу Steam' }));
  expect(screen.getByText(/Не удалось открыть ссылку/)).toBeTruthy();
  expect(screen.getByText('https://store.steampowered.com/app/620/').props.selectable).toBe(true);
  jest.mocked(Clipboard.setStringAsync).mockResolvedValueOnce(false);
  await fireEvent.press(screen.getByRole('button', { name: 'Скопировать ссылку' }));
  expect(screen.getByText(/Не удалось скопировать/)).toBeTruthy();
  expect(screen.queryByText('Ссылка скопирована.')).toBeNull();
});

test('manual game explains absent URL and offers no external action', async () => {
  const screen = await render(<SteamActions appid={2000000001} />);
  expect(screen.getByText(/Выбор можно сохранить, но ссылки Steam у неё нет/)).toBeTruthy();
  expect(screen.queryAllByRole('button')).toHaveLength(0);
});

test('desktop target hands steam link to system and mobile browser detection stays conservative', async () => {
  const openURL = jest.fn(async () => undefined);
  await createSteamLauncher({ openURL }).launch(620, 'desktop');
  expect(openURL).toHaveBeenCalledWith('steam://run/620');
  expect(isDesktopBrowser('Mozilla Windows NT 10')).toBe(true);
  expect(isDesktopBrowser('Macintosh Mobile')).toBe(false);
  expect(isDesktopBrowser('Android')).toBe(false);
  expect(isDesktopBrowser('')).toBe(false);
  expect(Platform.OS).toBeDefined();
});
