import { fireEvent, render, waitFor } from '@testing-library/react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useAuth } from '@/features/auth/hooks/useAuth';
import { RecommendationRecorder } from '@/features/picker/components/RecommendationRecorder';
import type { ChoiceInput } from '@/features/picker/services/acceptedChoice';

let mockFocused = true;
jest.mock('@react-navigation/native', () => ({
  ...jest.requireActual('@react-navigation/native'),
  useIsFocused: () => mockFocused,
}));
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
  mockFocused = true;
  useAuth.setState({ user: { steamId: 'A' }, status: 'signedIn' });
});
afterEach(() => useAuth.setState({ user: null, status: 'signedOut' }));

test('records visible results, not ordinary rerenders; recording never accepts a game', async () => {
  const screen = await render(<RecommendationRecorder input={input} />);
  await waitFor(async () => expect(await AsyncStorage.getItem(key)).not.toBeNull());
  const first = await AsyncStorage.getItem(key);
  await screen.rerender(<RecommendationRecorder input={{ ...input, game: { ...input.game } }} />);
  expect(await AsyncStorage.getItem(key)).toBe(first);
  await screen.rerender(
    <RecommendationRecorder input={{ ...input, game: { appid: 42, name: 'Next' } }} />,
  );
  await waitFor(async () => expect(JSON.parse((await AsyncStorage.getItem(key))!)).toHaveLength(2));
  expect(await AsyncStorage.getItem('playnow:acceptedChoice:v1:A')).toBeNull();
});

test('background result does not add history entries until focused', async () => {
  mockFocused = false;
  const screen = await render(<RecommendationRecorder input={input} />);
  expect(await AsyncStorage.getItem(key)).toBeNull();
  mockFocused = true;
  await screen.rerender(<RecommendationRecorder input={input} />);
  await waitFor(async () => expect(await AsyncStorage.getItem(key)).not.toBeNull());
});

test('history write failure is visible and can be retried without accepting the game', async () => {
  const write = jest.spyOn(AsyncStorage, 'setItem').mockRejectedValueOnce(new Error('full'));
  const screen = await render(<RecommendationRecorder input={input} />);
  await waitFor(() => expect(screen.getByText(/Не удалось сохранить рекомендацию/)).toBeTruthy());
  expect(await AsyncStorage.getItem(key)).toBeNull();
  await fireEvent.press(screen.getByRole('button', { name: 'Повторить сохранение в историю' }));
  await waitFor(async () => expect(await AsyncStorage.getItem(key)).not.toBeNull());
  expect(await AsyncStorage.getItem('playnow:acceptedChoice:v1:A')).toBeNull();
  write.mockRestore();
});
