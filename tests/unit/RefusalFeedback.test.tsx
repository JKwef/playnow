import { fireEvent, render, waitFor } from '@testing-library/react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useAuth } from '@/features/auth/hooks/useAuth';
import { RefusalFeedback } from '@/features/picker/components/RefusalFeedback';
import type { ChoiceInput } from '@/features/picker/services/acceptedChoice';

const input: ChoiceInput = {
  game: { appid: 620, name: 'Portal 2' },
  contextId: 'short-session',
  mode: 'new',
  genreFilter: 'context',
};
const key = 'playnow:recommendationHistory:v1:A';
beforeEach(async () => {
  useAuth.setState({ user: null, status: 'signedOut' });
  await AsyncStorage.clear();
  await AsyncStorage.setItem(key, JSON.stringify([{ ...input, shownAt: '2026-11-13T12:00:00Z' }]));
  useAuth.setState({ user: { steamId: 'A' }, status: 'signedIn' });
});
afterEach(() => useAuth.setState({ user: null, status: 'signedOut' }));

test('does not write unless a reason is explicitly chosen; choice is confirmed, persisted and removable', async () => {
  const original = await AsyncStorage.getItem(key);
  const screen = await render(<RefusalFeedback input={input} />);
  expect(screen.queryByRole('radio', { name: 'Не установлена' })).toBeNull();
  expect(await AsyncStorage.getItem(key)).toBe(original);
  await fireEvent.press(screen.getByRole('button', { name: 'Указать причину (необязательно)' }));
  await waitFor(() =>
    expect(
      screen.getByRole('radio', { name: 'Не установлена' }).props.accessibilityState.disabled,
    ).toBe(false),
  );
  await fireEvent.press(screen.getByRole('radio', { name: 'Не установлена' }));
  await waitFor(() =>
    expect(screen.getByText(/Последняя сохранённая причина: Не установлена/)).toBeTruthy(),
  );
  expect(JSON.parse((await AsyncStorage.getItem(key))!)[0].refusal.reason).toBe('not_installed');
  expect(await AsyncStorage.getItem('playnow:acceptedChoice:v1:A')).toBeNull();
  await fireEvent.press(screen.getByRole('button', { name: 'Удалить причину отказа' }));
  await waitFor(() => expect(screen.queryByText(/Последняя сохранённая причина:/)).toBeNull());
  expect(JSON.parse((await AsyncStorage.getItem(key))!)[0].refusal).toBeUndefined();
});

test('failed save shows an error rather than success and the same reason can be retried', async () => {
  const screen = await render(<RefusalFeedback input={input} />);
  await fireEvent.press(screen.getByRole('button', { name: 'Указать причину (необязательно)' }));
  await waitFor(() =>
    expect(
      screen.getByRole('radio', { name: 'Не хочется сейчас' }).props.accessibilityState.disabled,
    ).toBe(false),
  );
  const write = jest.spyOn(AsyncStorage, 'setItem').mockRejectedValueOnce(new Error('full'));
  await fireEvent.press(screen.getByRole('radio', { name: 'Не хочется сейчас' }));
  expect(screen.getByText(/Не удалось сохранить изменение причины/)).toBeTruthy();
  expect(screen.queryByText(/Последняя сохранённая причина:/)).toBeNull();
  await fireEvent.press(screen.getByRole('radio', { name: 'Не хочется сейчас' }));
  expect(screen.getByText(/Последняя сохранённая причина: Не хочется сейчас/)).toBeTruthy();
  write.mockRestore();
});
