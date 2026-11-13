import { fireEvent, render, waitFor } from '@testing-library/react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useAuth } from '@/features/auth/hooks/useAuth';
import { InstalledGameControl } from '@/features/backlog/components/InstalledGameControl';

const label = 'Установлено на моём игровом компьютере';
const key = 'playnow:installedGames:v1:A';
beforeEach(async () => {
  useAuth.setState({ user: null, status: 'signedOut' });
  await AsyncStorage.clear();
  useAuth.setState({ user: { steamId: 'A' }, status: 'signedIn' });
});
afterEach(() => useAuth.setState({ user: null, status: 'signedOut' }));

test('only a confirmed disk write checks the manual mark and it can be removed offline', async () => {
  const screen = await render(<InstalledGameControl appid={620} />);
  await waitFor(() =>
    expect(screen.getByRole('checkbox', { name: label }).props.accessibilityState.disabled).toBe(
      false,
    ),
  );
  expect(screen.getByRole('checkbox', { name: label }).props.accessibilityState.checked).toBe(
    false,
  );
  const write = jest.spyOn(AsyncStorage, 'setItem').mockRejectedValueOnce(new Error('full'));
  await fireEvent.press(screen.getByRole('checkbox', { name: label }));
  expect(screen.getByText(/Не удалось сохранить отметку/)).toBeTruthy();
  expect(screen.getByRole('checkbox', { name: label }).props.accessibilityState.checked).toBe(
    false,
  );
  await fireEvent.press(screen.getByRole('checkbox', { name: label }));
  expect(screen.getByRole('checkbox', { name: label }).props.accessibilityState.checked).toBe(true);
  expect(JSON.parse((await AsyncStorage.getItem(key))!)).toEqual([620]);
  await fireEvent.press(screen.getByRole('checkbox', { name: label }));
  expect(JSON.parse((await AsyncStorage.getItem(key))!)).toEqual([]);
  write.mockRestore();
});
