import AsyncStorage from '@react-native-async-storage/async-storage';
import { createInstalledGamesStore } from '@/features/backlog/services/installedGames';
import { createBacklogCache } from '@/features/backlog/services/backlogCache';
import { clearAccountData } from '@/shared/services/accountData';

const key = (account: string) => `playnow:installedGames:v1:${account}`;
const deferred = <T>() => {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((done) => {
    resolve = done;
  });
  return { promise, resolve };
};
beforeEach(() => AsyncStorage.clear());

test('manual and Steam ids persist independently from library imports and are account scoped', async () => {
  const store = createInstalledGamesStore();
  await store.getState().load('A');
  expect(store.getState().marked.size).toBe(0);
  await store.getState().setMarked('A', 620, true);
  await store.getState().setMarked('A', 2000000001, true);
  await createBacklogCache().write('A', { games: [], updatedAt: '2026-11-13T00:00:00Z' });
  const restored = createInstalledGamesStore();
  await restored.getState().load('A');
  expect([...restored.getState().marked]).toEqual([620, 2000000001]);
  await restored.getState().setMarked('A', 620, false);
  expect([...restored.getState().marked]).toEqual([2000000001]);
  await restored.getState().load('B');
  expect(restored.getState().marked.size).toBe(0);
  expect(await restored.getState().setMarked('A', 42, true)).toBe(false);
});

test('concurrent changes are serialized without losing marks and failed writes preserve confirmed state', async () => {
  const storage = { ...AsyncStorage, setItem: jest.fn(AsyncStorage.setItem) };
  const store = createInstalledGamesStore(storage);
  await store.getState().load('A');
  await Promise.all([
    store.getState().setMarked('A', 1, true),
    store.getState().setMarked('A', 2, true),
    store.getState().setMarked('A', 1, false),
  ]);
  expect([...store.getState().marked]).toEqual([2]);
  storage.setItem.mockRejectedValueOnce(new Error('full'));
  expect(await store.getState().setMarked('A', 2, false)).toBe(false);
  expect(store.getState().marked.has(2)).toBe(true);
  expect(store.getState().error).toMatch(/сохранить/);
  expect(await store.getState().setMarked('A', 2, false)).toBe(true);
  expect(store.getState().pending).toBe(0);
});

test.each(['{}', '[0]', '["620"]', '[1.5]'])(
  'corrupt marks cannot be silently overwritten: %s',
  async (raw) => {
    await AsyncStorage.setItem(key('A'), raw);
    const store = createInstalledGamesStore();
    await store.getState().load('A');
    expect(store.getState().isReady).toBe(false);
    expect(await store.getState().setMarked('A', 620, true)).toBe(false);
    expect(await AsyncStorage.getItem(key('A'))).toBe(raw);
  },
);

test('transient read error can be retried and invalid ids cannot be marked', async () => {
  const storage = { ...AsyncStorage, getItem: jest.fn(AsyncStorage.getItem) };
  storage.getItem.mockRejectedValueOnce(new Error('read'));
  const store = createInstalledGamesStore(storage);
  await store.getState().load('A');
  expect(store.getState().isReady).toBe(false);
  await store.getState().load('A', true);
  expect(store.getState().isReady).toBe(true);
  expect(await store.getState().setMarked('A', -1, true)).toBe(false);
});

test('late account restore cannot replace the next account', async () => {
  const read = deferred<string | null>();
  const store = createInstalledGamesStore({
    ...AsyncStorage,
    getItem: (name) => (name === key('A') ? read.promise : AsyncStorage.getItem(name)),
  });
  const loading = store.getState().load('A');
  await store.getState().load('B');
  read.resolve('[620]');
  await loading;
  expect(store.getState().account).toBe('B');
  expect(store.getState().marked.size).toBe(0);
});

test('account deletion waits for an in-flight mark write, preserves device theme and blocks late restore', async () => {
  const started = deferred<void>();
  const release = deferred<void>();
  await AsyncStorage.setItem('quaeso:theme', 'light');
  const store = createInstalledGamesStore({
    ...AsyncStorage,
    setItem: async (name, value) => {
      started.resolve();
      await release.promise;
      await AsyncStorage.setItem(name, value);
    },
  });
  await store.getState().load('A');
  const pending = store.getState().setMarked('A', 620, true);
  await started.promise;
  const clearing = clearAccountData('A');
  store.getState().reset();
  await store.getState().load('B');
  release.resolve();
  expect(await pending).toBe(false);
  await clearing;
  expect(await AsyncStorage.getItem(key('A'))).toBeNull();
  expect(await AsyncStorage.getItem('quaeso:theme')).toBe('light');
  expect(store.getState().marked.size).toBe(0);
});
