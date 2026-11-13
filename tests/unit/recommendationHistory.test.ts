import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  createRecommendationHistoryStore,
  HISTORY_LIMIT,
  recommendationId,
} from '@/features/picker/services/recommendationHistory';
import type { ChoiceInput } from '@/features/picker/services/acceptedChoice';
import { clearAccountData } from '@/shared/services/accountData';

const input: ChoiceInput = {
  game: { appid: 620, name: 'Portal 2' },
  contextId: 'short-session',
  mode: 'new',
  genreFilter: 'context',
};
const key = (account: string) => `playnow:recommendationHistory:v1:${account}`;
const now = () => new Date('2026-11-13T12:00:00Z');
const deferred = <T>() => {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((done) => {
    resolve = done;
  });
  return { promise, resolve };
};
beforeEach(() => AsyncStorage.clear());

test('installed-only criteria remain distinct from old history and keep their own feedback', async () => {
  const store = createRecommendationHistoryStore(AsyncStorage, now);
  await store.getState().load('A');
  await store.getState().record('A', input);
  await store.getState().record('A', { ...input, installedOnly: true });
  await store
    .getState()
    .setRefusal('A', recommendationId({ ...input, installedOnly: true }), 'other');
  const restored = createRecommendationHistoryStore();
  await restored.getState().load('A');
  expect(restored.getState().entries).toHaveLength(2);
  expect(restored.getState().entries[0]?.installedOnly).toBe(true);
  expect(restored.getState().entries[0]?.refusal?.reason).toBe('other');
  expect(restored.getState().entries[1]?.refusal).toBeUndefined();
});

test('optional refusal persists without changing order, recommendation time or accepted choice', async () => {
  await AsyncStorage.setItem('playnow:acceptedChoice:v1:A', 'confirmed decision');
  const store = createRecommendationHistoryStore(AsyncStorage, now);
  await store.getState().load('A');
  await store.getState().record('A', input);
  await store.getState().record('A', { ...input, game: { appid: 42, name: 'Other' } });
  const before = store.getState().entries;
  expect(await store.getState().setRefusal('A', recommendationId(input), 'not_installed')).toBe(
    true,
  );
  expect(store.getState().entries.map((item) => item.game.appid)).toEqual([42, 620]);
  expect(store.getState().entries[1]).toEqual({
    ...before[1],
    refusal: { reason: 'not_installed', savedAt: now().toISOString() },
  });
  const restored = createRecommendationHistoryStore();
  await restored.getState().load('A');
  expect(restored.getState().entries).toEqual(store.getState().entries);
  await store.getState().record('A', input);
  expect(store.getState().entries[0]?.refusal?.reason).toBe('not_installed');
  await store.getState().setRefusal('A', recommendationId(input), null);
  expect(store.getState().entries[0]?.refusal).toBeUndefined();
  expect(await AsyncStorage.getItem('playnow:acceptedChoice:v1:A')).toBe('confirmed decision');
});

test('failed reason change and removal preserve the previous reason; retry works', async () => {
  const storage = { ...AsyncStorage, setItem: jest.fn(AsyncStorage.setItem) };
  const store = createRecommendationHistoryStore(storage, now);
  await store.getState().load('A');
  await store.getState().record('A', input);
  await store.getState().setRefusal('A', recommendationId(input), 'not_now');
  storage.setItem.mockRejectedValueOnce(new Error('full'));
  expect(await store.getState().setRefusal('A', recommendationId(input), 'other')).toBe(false);
  expect(store.getState().entries[0]?.refusal?.reason).toBe('not_now');
  storage.setItem.mockRejectedValueOnce(new Error('full'));
  expect(await store.getState().setRefusal('A', recommendationId(input), null)).toBe(false);
  expect(store.getState().entries[0]?.refusal?.reason).toBe('not_now');
  expect(await store.getState().setRefusal('A', recommendationId(input), null)).toBe(true);
});

test('reason never recreates cleared history and invalid reasons or old accounts cannot write', async () => {
  const store = createRecommendationHistoryStore();
  await store.getState().load('A');
  await store.getState().record('A', input);
  expect(
    await store.getState().setRefusal('A', recommendationId(input), '__proto__' as never),
  ).toBe(false);
  expect(await store.getState().setRefusal('B', recommendationId(input), 'not_now')).toBe(false);
  await store.getState().clear('A');
  expect(await store.getState().setRefusal('A', recommendationId(input), 'not_now')).toBe(false);
  expect(await AsyncStorage.getItem(key('A'))).toBeNull();
});

test.each([
  { reason: 'unknown', savedAt: now().toISOString() },
  { reason: 'other', savedAt: 'bad date' },
])('invalid persisted refusal is not silently overwritten', async (refusal) => {
  const raw = JSON.stringify([{ ...input, shownAt: now().toISOString(), refusal }]);
  await AsyncStorage.setItem(key('A'), raw);
  const store = createRecommendationHistoryStore();
  await store.getState().load('A');
  expect(store.getState().isReady).toBe(false);
  expect(await store.getState().setRefusal('A', recommendationId(input), 'other')).toBe(false);
  expect(await AsyncStorage.getItem(key('A'))).toBe(raw);
});

test('late reason save cannot restore a deleted account or replace another account', async () => {
  await AsyncStorage.setItem(
    key('A'),
    JSON.stringify([{ ...input, shownAt: now().toISOString() }]),
  );
  const started = deferred<void>();
  const release = deferred<void>();
  const store = createRecommendationHistoryStore({
    ...AsyncStorage,
    setItem: async (name, value) => {
      started.resolve();
      await release.promise;
      await AsyncStorage.setItem(name, value);
    },
  });
  await store.getState().load('A');
  const pending = store.getState().setRefusal('A', recommendationId(input), 'other');
  await started.promise;
  const clear = clearAccountData('A');
  store.getState().reset();
  await store.getState().load('B');
  release.resolve();
  expect(await pending).toBe(false);
  await clear;
  expect(await AsyncStorage.getItem(key('A'))).toBeNull();
  expect(store.getState().entries).toEqual([]);
});

test('a fast next result during initial disk loading preserves both shown recommendations', async () => {
  const read = deferred<string | null>();
  const store = createRecommendationHistoryStore(
    { ...AsyncStorage, getItem: () => read.promise },
    now,
  );
  const loading = store.getState().load('A');
  const first = store.getState().record('A', input);
  const second = store.getState().record('A', { ...input, game: { appid: 42, name: 'Next' } });
  read.resolve(null);
  await loading;
  expect(await first).toBe(true);
  expect(await second).toBe(true);
  expect(store.getState().entries.map((entry) => entry.game.appid)).toEqual([42, 620]);
});

test('persists snapshots and exact criteria without replacing the accepted choice; deduplicates only identical criteria', async () => {
  await AsyncStorage.setItem('playnow:acceptedChoice:v1:A', 'previous decision');
  const store = createRecommendationHistoryStore(AsyncStorage, now);
  await store.getState().load('A');
  await store.getState().record('A', input);
  await store.getState().record('A', { ...input, mode: 'continue', genreFilter: 'any' });
  await store.getState().record('A', { ...input, game: { ...input.game, name: 'Updated' } });
  expect(store.getState().entries).toHaveLength(2);
  expect(store.getState().entries[0]).toEqual({
    ...input,
    game: { ...input.game, name: 'Updated' },
    shownAt: now().toISOString(),
  });
  const restored = createRecommendationHistoryStore();
  await restored.getState().load('A');
  expect(restored.getState().entries).toEqual(store.getState().entries);
  expect(await AsyncStorage.getItem('playnow:acceptedChoice:v1:A')).toBe('previous decision');
});

test('serializes rapid writes, retains only the newest 20 and snapshots input before queuing', async () => {
  const store = createRecommendationHistoryStore(AsyncStorage, now);
  await store.getState().load('A');
  const mutable = { ...input, game: { ...input.game } };
  const pending = store.getState().record('A', mutable);
  mutable.game.name = 'Mutated';
  await pending;
  expect(store.getState().entries[0]?.game.name).toBe('Portal 2');
  await Promise.all(
    Array.from({ length: 25 }, (_, index) =>
      store
        .getState()
        .record('A', { ...input, game: { appid: index + 1, name: `Game ${index + 1}` } }),
    ),
  );
  expect(store.getState().entries).toHaveLength(HISTORY_LIMIT);
  expect(store.getState().entries.map((item) => item.game.appid)).toEqual(
    Array.from({ length: 20 }, (_, index) => 25 - index),
  );
  expect(store.getState().pending).toBe(0);
});

test('read failure blocks automatic overwrite; retry, failed write and failed clear preserve confirmed data', async () => {
  const storage = {
    getItem: jest.fn(AsyncStorage.getItem),
    setItem: jest.fn(AsyncStorage.setItem),
    removeItem: jest.fn(AsyncStorage.removeItem),
  };
  storage.getItem.mockRejectedValueOnce(new Error('read failed'));
  const store = createRecommendationHistoryStore(storage, now);
  await store.getState().load('A');
  expect(store.getState().isReady).toBe(false);
  expect(await store.getState().record('A', input)).toBe(false);
  expect(storage.setItem).not.toHaveBeenCalled();
  await store.getState().load('A', true);
  await store.getState().record('A', input);
  const confirmed = store.getState().entries;
  storage.setItem.mockRejectedValueOnce(new Error('disk full'));
  expect(await store.getState().record('A', { ...input, mode: 'continue' })).toBe(false);
  expect(store.getState().entries).toBe(confirmed);
  expect(store.getState().error).toMatch(/сохранить/);
  storage.removeItem.mockRejectedValueOnce(new Error('disk full'));
  expect(await store.getState().clear('A')).toBe(false);
  expect(store.getState().entries).toBe(confirmed);
  expect(await store.getState().clear('A')).toBe(true);
  expect(await AsyncStorage.getItem(key('A'))).toBeNull();
});

test.each([
  '{}',
  '[{"game":{"appid":1}}]',
  JSON.stringify([{ ...input, shownAt: 'invalid' }]),
  JSON.stringify([{ ...input, contextId: 'missing', shownAt: now().toISOString() }]),
])('corrupt history is not silently replaced: %s', async (raw) => {
  await AsyncStorage.setItem(key('A'), raw);
  const store = createRecommendationHistoryStore();
  await store.getState().load('A');
  expect(store.getState().error).toMatch(/прочитать/);
  expect(await store.getState().record('A', input)).toBe(false);
  expect(await AsyncStorage.getItem(key('A'))).toBe(raw);
  expect(await store.getState().clear('A')).toBe(true);
  expect(store.getState().isReady).toBe(true);
  expect(await store.getState().record('A', input)).toBe(true);
});

test('late A restore cannot replace B and old-account callbacks cannot write to B', async () => {
  const readA = deferred<string | null>();
  const store = createRecommendationHistoryStore({
    ...AsyncStorage,
    getItem: (name) => (name === key('A') ? readA.promise : AsyncStorage.getItem(name)),
  });
  const loadA = store.getState().load('A');
  await store.getState().load('B');
  readA.resolve(JSON.stringify([{ ...input, shownAt: now().toISOString() }]));
  await loadA;
  expect(store.getState().account).toBe('B');
  expect(store.getState().entries).toEqual([]);
  expect(await store.getState().record('A', input)).toBe(false);
  expect(await store.getState().clear('A')).toBe(false);
});

test('deletion waits for an already started write and late work cannot restore cleared account data', async () => {
  const started = deferred<void>();
  const release = deferred<void>();
  const store = createRecommendationHistoryStore({
    ...AsyncStorage,
    setItem: async (name, value) => {
      started.resolve();
      await release.promise;
      await AsyncStorage.setItem(name, value);
    },
  });
  await store.getState().load('A');
  const pending = store.getState().record('A', input);
  await started.promise;
  const clear = clearAccountData('A');
  store.getState().reset();
  await store.getState().load('B');
  release.resolve();
  expect(await pending).toBe(false);
  await clear;
  expect(await AsyncStorage.getItem(key('A'))).toBeNull();
  expect(store.getState().entries).toEqual([]);
});
