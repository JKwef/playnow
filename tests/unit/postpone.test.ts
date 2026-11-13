import { createBlacklistService, postponeUntil } from '@/features/picker/services/blacklist';

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
  };
};

test('tomorrow means next local midnight; a week lasts seven days', () => {
  const now = new Date(2026, 10, 13, 23, 45).getTime();
  expect(postponeUntil('tomorrow', now)).toBe(new Date(2026, 10, 14, 0, 0).getTime());
  expect(postponeUntil('week', now) - now).toBe(7 * 86400000);
});

test('parallel postponements and pruning cannot overwrite each other', async () => {
  const storage = memory();
  const first = createBlacklistService(storage, () => 0);
  const second = createBlacklistService(storage, () => 0);
  await Promise.all([first.add('A', 1, 'week'), second.read('A'), second.add('A', 2, 'week')]);
  expect([...(await first.read('A')).keys()]).toEqual([1, 2]);
});

test('a failed save leaves previous postponements intact and a retry can succeed', async () => {
  const storage = memory();
  await createBlacklistService(storage, () => 0).add('A', 1, 'week');
  const failed = createBlacklistService(
    {
      ...storage,
      setItem: async () => {
        throw new Error('disk full');
      },
    },
    () => 0,
  );
  await expect(failed.add('A', 2, 'tomorrow')).rejects.toThrow('disk full');
  expect([...(await createBlacklistService(storage, () => 0).read('A')).keys()]).toEqual([1]);
  await createBlacklistService(storage, () => 0).add('A', 2, 'week');
  expect((await createBlacklistService(storage, () => 0).read('A')).size).toBe(2);
});

test('postponement expires at its boundary and removal is available offline', async () => {
  const storage = memory();
  let now = new Date(2026, 10, 13, 23, 45).getTime();
  const service = createBlacklistService(storage, () => now);
  await service.add('A', 1, 'tomorrow');
  await service.add('A', 2, 'week');
  now = new Date(2026, 10, 14).getTime();
  expect([...(await service.read('A')).keys()]).toEqual([2]);
  await service.remove('A', 2);
  expect((await service.read('A')).size).toBe(0);
});
