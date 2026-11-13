import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  createAcceptedChoiceStore,
  type ChoiceInput,
} from '@/features/picker/services/acceptedChoice';
import { clearAccountData } from '@/shared/services/accountData';

const input: ChoiceInput = {
  game: { appid: 620, name: 'Portal 2' },
  mode: 'continue',
  contextId: 'action',
  genreFilter: 'any',
};
const now = () => new Date('2026-11-13T12:00:00.000Z');
beforeEach(() => AsyncStorage.clear());

test('accept persists exact criteria/time and restart restores; undo restores the previous accepted choice', async () => {
  const store = createAcceptedChoiceStore(AsyncStorage, now);
  await store.getState().load('A');
  expect(await store.getState().accept('A', input)).toBe(true);
  const original = { ...input, acceptedAt: now().toISOString() };
  expect(store.getState().choice).toEqual(original);
  const restarted = createAcceptedChoiceStore(AsyncStorage, now);
  await restarted.getState().load('A');
  expect(restarted.getState().choice).toEqual(original);
  await restarted.getState().accept('A', { ...input, game: { appid: 42, name: 'Other' } });
  await restarted.getState().undo('A');
  expect(restarted.getState().choice).toEqual(original);
  expect(restarted.getState().canUndo).toBe(false);
  const restored = createAcceptedChoiceStore(AsyncStorage);
  await restored.getState().load('A');
  expect(restored.getState().choice).toEqual(original);
});

test('undo first acceptance removes it from disk, and manual games can be accepted', async () => {
  const store = createAcceptedChoiceStore();
  await store.getState().load('A');
  await store.getState().accept('A', { ...input, game: { appid: 2000000001, name: 'Manual' } });
  expect(store.getState().choice?.game.name).toBe('Manual');
  await store.getState().undo('A');
  expect(await AsyncStorage.getItem('playnow:acceptedChoice:v1:A')).toBeNull();
});

test('failed accept/undo preserves the confirmed choice and supports retry', async () => {
  const storage = {
    getItem: jest.fn(async () => null),
    setItem: jest.fn(async () => {}),
    removeItem: jest.fn(async () => {}),
  };
  const store = createAcceptedChoiceStore(storage, now);
  await store.getState().load('A');
  await store.getState().accept('A', input);
  const previous = store.getState().choice;
  storage.setItem.mockRejectedValueOnce(new Error('full'));
  expect(await store.getState().accept('A', { ...input, game: { appid: 2, name: 'New' } })).toBe(
    false,
  );
  expect(store.getState().choice).toBe(previous);
  expect(store.getState().error).toMatch(/Не удалось сохранить/);
  storage.removeItem.mockRejectedValueOnce(new Error('full'));
  expect(await store.getState().undo('A')).toBe(false);
  expect(store.getState().choice).toBe(previous);
  expect(store.getState().canUndo).toBe(true);
  expect(await store.getState().undo('A')).toBe(true);
});

test('late account A restore cannot replace B; missing and corrupt data are distinct', async () => {
  let resolveA!: (value: string | null) => void;
  const storage = {
    getItem: jest.fn((key: string): Promise<string | null> =>
      key.endsWith(':A')
        ? new Promise((resolve) => {
            resolveA = resolve;
          })
        : Promise.resolve(null),
    ),
    setItem: jest.fn(async () => {}),
    removeItem: jest.fn(async () => {}),
  };
  const store = createAcceptedChoiceStore(storage);
  const pending = store.getState().load('A');
  await store.getState().load('B');
  resolveA(JSON.stringify({ ...input, acceptedAt: now().toISOString() }));
  await pending;
  expect(store.getState().account).toBe('B');
  expect(store.getState().choice).toBeNull();
  expect(store.getState().isReady).toBe(true);
  storage.getItem.mockResolvedValueOnce('{');
  await store.getState().load('C');
  expect(store.getState().isReady).toBe(false);
  expect(await store.getState().accept('C', input)).toBe(false);
  store.getState().reset();
  await store.getState().load('C');
  expect(store.getState().isReady).toBe(true);
});

test('account deletion invalidates queued writes and removes choice while retaining theme', async () => {
  const store = createAcceptedChoiceStore();
  await store.getState().load('A');
  await AsyncStorage.setItem('quaeso:theme', 'light');
  const pending = store.getState().accept('A', input);
  await clearAccountData('A');
  expect(await pending).toBe(false);
  expect(await AsyncStorage.getItem('playnow:acceptedChoice:v1:A')).toBeNull();
  expect(await AsyncStorage.getItem('quaeso:theme')).toBe('light');
});

test('double acceptance is serialized; a pending save after account switch cannot show A on B', async () => {
  let finish!: () => void;
  const storage = {
    getItem: jest.fn(async () => null),
    setItem: jest.fn(
      () =>
        new Promise<void>((resolve) => {
          finish = resolve;
        }),
    ),
    removeItem: jest.fn(async () => {}),
  };
  const store = createAcceptedChoiceStore(storage);
  await store.getState().load('A');
  const pending = store.getState().accept('A', input);
  expect(await store.getState().accept('A', input)).toBe(false);
  await Promise.resolve();
  await Promise.resolve();
  await store.getState().load('B');
  finish();
  await pending;
  expect(store.getState().account).toBe('B');
  expect(store.getState().choice).toBeNull();
});
