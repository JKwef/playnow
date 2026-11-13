import { createBacklogCache } from '@/features/backlog/services/backlogCache';
import { createBlacklistService } from '@/features/picker/services/blacklist';
import { clearAccountData } from '@/shared/services/accountData';
import {
  accountRevision,
  invalidateAccount,
  queueAccountWrite,
} from '@/shared/services/accountScope';

const A = '76561197960287930';
const B = '76561197960287931';
const deferred = <T>() => {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((r) => {
    resolve = r;
  });
  return { promise, resolve };
};

const memory = () => {
  const values = new Map<string, string>();
  return {
    values,
    getItem: async (key: string) => values.get(key) ?? null,
    setItem: async (key: string, value: string) => {
      values.set(key, value);
    },
    removeItem: async (key: string) => {
      values.delete(key);
    },
    getAllKeys: async () => [...values.keys()],
    multiRemove: async (keys: string[]) => {
      keys.forEach((key) => values.delete(key));
    },
  };
};

test('deletion clears all account features, preserves other account and device theme', async () => {
  const storage = memory();
  for (const feature of [
    'backlog',
    'blacklist',
    'statuses',
    'acceptedChoice',
    'recommendationHistory',
    'installedGames',
    'pickerSync',
  ]) {
    storage.values.set(`playnow:${feature}:v1:${A}`, 'private');
    storage.values.set(`playnow:${feature}:v1:${B}`, 'other');
  }
  storage.values.set('quaeso:theme', 'light');
  await clearAccountData(A, storage);
  expect([...storage.values.keys()].filter((key) => key.endsWith(A))).toEqual([]);
  expect(storage.values.size).toBe(8);
  expect(storage.values.get('quaeso:theme')).toBe('light');
});

test('clear waits for an already-started backlog write across cache instances', async () => {
  const storage = memory();
  const started = deferred<void>();
  const release = deferred<void>();
  const slowStorage = {
    ...storage,
    setItem: async (key: string, value: string) => {
      started.resolve();
      await release.promise;
      await storage.setItem(key, value);
    },
  };
  const write = createBacklogCache(slowStorage).write(A, { games: [], updatedAt: '2026-11-13' });
  await started.promise;
  const clear = createBacklogCache(storage).clear(A);
  release.resolve();
  await Promise.all([write, clear]);
  expect(storage.values.size).toBe(0);
});

test('late blacklist prune and mutations cannot restore deleted data', async () => {
  for (const action of ['read', 'add', 'remove'] as const) {
    const storage = memory();
    const loaded = deferred<string | null>();
    const service = createBlacklistService({ ...storage, getItem: () => loaded.promise }, () => 0);
    const pending = action === 'read' ? service.read(A) : service[action](A, 1);
    await clearAccountData(A, storage);
    loaded.resolve(JSON.stringify({ '1': 999999 }));
    await pending;
    expect(storage.values.size).toBe(0);
  }
});

test('revision invalidates a previous session; failed disk operations do not block cleanup', async () => {
  const revision = accountRevision(A);
  invalidateAccount(A);
  expect(accountRevision(A)).toBeGreaterThan(revision);
  await expect(
    queueAccountWrite(A, async () => {
      throw new Error('disk');
    }),
  ).rejects.toThrow('disk');
  const cleanup = jest.fn(async () => undefined);
  await queueAccountWrite(A, cleanup);
  expect(cleanup).toHaveBeenCalledTimes(1);
});

test('cleanup errors are propagated to the caller', async () => {
  await expect(
    clearAccountData(A, {
      getAllKeys: async () => {
        throw new Error('unavailable');
      },
      multiRemove: async () => undefined,
    }),
  ).rejects.toThrow('unavailable');
});
